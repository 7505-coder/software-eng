import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createOrder, getMenu, getOrder, listOrders, updateOrderStatus } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const statuses = ['Received', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
const orderSchema = z.object({
  studentName: z.string().trim().min(2).max(80),
  studentId: z.string().trim().min(2).max(30),
  pickupTime: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(300).default(''),
  items: z.array(z.object({
    menuItemId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20)
  })).min(1).max(30)
}).superRefine((value, context) => {
  if (new Set(value.items.map((item) => item.menuItemId)).size !== value.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Duplicate menu items are not allowed.' });
  }
});

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/menu', (_req, res) => res.json({ items: getMenu() }));
app.get('/api/orders/:id', (req, res) => {
  const order = getOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  return res.json({ order });
});
app.get('/api/orders', (req, res) => {
  const status = req.query.status;
  if (status && !statuses.includes(status)) return res.status(400).json({ error: 'Invalid order status.' });
  return res.json({ orders: listOrders(status) });
});
app.post('/api/orders', (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check the order details.', details: parsed.error.flatten() });
  try {
    return res.status(201).json({ order: createOrder(parsed.data) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Could not create order.' });
  }
});
app.patch('/api/orders/:id/status', (req, res) => {
  const parsed = z.object({ status: z.enum(statuses) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: `Status must be one of: ${statuses.join(', ')}.` });
  const order = getOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const allowed = order.status === 'Cancelled' || order.status === 'Completed'
    ? []
    : order.status === 'Received' ? ['Preparing', 'Cancelled']
      : order.status === 'Preparing' ? ['Ready', 'Cancelled']
        : ['Completed', 'Cancelled'];
  if (!allowed.includes(parsed.data.status)) {
    return res.status(409).json({ error: `Orders in ${order.status} cannot move to ${parsed.data.status}.` });
  }
  return res.json({ order: updateOrderStatus(order.id, parsed.data.status) });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Canteen API listening on http://localhost:${port}`));
export default app;
