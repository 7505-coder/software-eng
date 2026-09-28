import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const dataDirectory = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new Database(path.join(dataDirectory, 'canteen.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    pickup_time TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Received',
    total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
  );
`);

const menuCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
if (menuCount === 0) {
  const seed = db.prepare(`
    INSERT INTO menu_items (name, description, category, price_cents)
    VALUES (@name, @description, @category, @priceCents)
  `);
  const seedMany = db.transaction((items) => items.forEach((item) => seed.run(item)));
  seedMany([
    { name: 'Masala Dosa', description: 'Crispy dosa with spiced potato filling and chutney.', category: 'Breakfast', priceCents: 650 },
    { name: 'Idli Sambar', description: 'Steamed rice cakes served with warm lentil sambar.', category: 'Breakfast', priceCents: 450 },
    { name: 'Veggie Rice Bowl', description: 'Seasonal vegetables, fragrant rice, and house dressing.', category: 'Lunch', priceCents: 850 },
    { name: 'Paneer Wrap', description: 'Grilled paneer, salad, and mint sauce in a soft wrap.', category: 'Lunch', priceCents: 750 },
    { name: 'Chicken Biryani', description: 'Aromatic basmati rice with tender chicken and raita.', category: 'Lunch', priceCents: 1050 },
    { name: 'Samosa (2 pcs)', description: 'Golden pastry filled with potato and peas.', category: 'Snacks', priceCents: 300 },
    { name: 'Fresh Lime Soda', description: 'Refreshing lime, soda, and a hint of mint.', category: 'Drinks', priceCents: 250 },
    { name: 'Filter Coffee', description: 'South Indian filter coffee with milk.', category: 'Drinks', priceCents: 220 },
    { name: 'Fruit Cup', description: 'A seasonal selection of freshly cut fruit.', category: 'Snacks', priceCents: 350 }
  ]);
}

export function getMenu() {
  return db.prepare(`
    SELECT id, name, description, category, price_cents AS priceCents, available
    FROM menu_items WHERE available = 1 ORDER BY category, name
  `).all();
}

export function getOrder(id) {
  const order = db.prepare(`
    SELECT id, student_name AS studentName, student_id AS studentId,
      pickup_time AS pickupTime, notes, status, total_cents AS totalCents,
      created_at AS createdAt, updated_at AS updatedAt
    FROM orders WHERE id = ?
  `).get(id);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT menu_item_id AS menuItemId, item_name AS name, quantity,
      unit_price_cents AS unitPriceCents
    FROM order_items WHERE order_id = ? ORDER BY id
  `).all(id);
  return order;
}

export function listOrders(status) {
  const query = status
    ? `SELECT id, student_name AS studentName, student_id AS studentId, pickup_time AS pickupTime,
         notes, status, total_cents AS totalCents, created_at AS createdAt, updated_at AS updatedAt
       FROM orders WHERE status = ? ORDER BY created_at DESC`
    : `SELECT id, student_name AS studentName, student_id AS studentId, pickup_time AS pickupTime,
         notes, status, total_cents AS totalCents, created_at AS createdAt, updated_at AS updatedAt
       FROM orders ORDER BY created_at DESC`;
  const orders = db.prepare(query).all(...(status ? [status] : []));
  const items = db.prepare(`
    SELECT menu_item_id AS menuItemId, item_name AS name, quantity, unit_price_cents AS unitPriceCents
    FROM order_items WHERE order_id = ? ORDER BY id
  `);
  return orders.map((order) => ({ ...order, items: items.all(order.id) }));
}

export function createOrder({ studentName, studentId, pickupTime, notes, items }) {
  const ids = items.map((item) => item.menuItemId);
  const menuItems = db.prepare(`
    SELECT id, name, price_cents AS priceCents FROM menu_items
    WHERE available = 1 AND id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  if (menuItems.length !== items.length) {
    const error = new Error('One or more selected menu items are unavailable.');
    error.statusCode = 400;
    throw error;
  }
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const detailedItems = items.map((item) => ({ ...item, ...byId.get(item.menuItemId) }));
  const totalCents = detailedItems.reduce((total, item) => total + item.priceCents * item.quantity, 0);
  const create = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO orders (student_name, student_id, pickup_time, notes, total_cents)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentName, studentId, pickupTime, notes, totalCents);
    const addItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_cents)
      VALUES (?, ?, ?, ?, ?)
    `);
    detailedItems.forEach((item) => addItem.run(result.lastInsertRowid, item.id, item.name, item.quantity, item.priceCents));
    return Number(result.lastInsertRowid);
  });
  return getOrder(create());
}

export function updateOrderStatus(id, status) {
  const result = db.prepare(`
    UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(status, id);
  return result.changes ? getOrder(id) : null;
}
