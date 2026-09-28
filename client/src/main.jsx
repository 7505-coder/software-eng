import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || '/api';
const money = (cents) => `₹${(cents / 100).toFixed(2)}`;
const statuses = ['All', 'Received', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

async function request(path, options) {
  const response = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function Header({ view, setView, cartCount }) {
  return <header className="topbar">
    <div className="brand"><span className="brand-mark">✦</span><span>Campus Canteen</span></div>
    <nav aria-label="Main navigation">
      <button className={view === 'student' ? 'nav-link active' : 'nav-link'} onClick={() => setView('student')}>Order food <span className="cart-badge">{cartCount}</span></button>
      <button className={view === 'staff' ? 'nav-link active' : 'nav-link'} onClick={() => setView('staff')}>Staff dashboard</button>
    </nav>
  </header>;
}

function Menu({ items, cart, setCart }) {
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items]);
  const change = (item, delta) => {
    setCart((current) => {
      const quantity = (current[item.id] || 0) + delta;
      const next = { ...current };
      if (quantity > 0) next[item.id] = Math.min(quantity, 20);
      else delete next[item.id];
      return next;
    });
  };
  return <main className="content">
    <div className="page-heading"><div><p className="eyebrow">Today at the canteen</p><h1>What are you craving?</h1><p className="muted">Order ahead and skip the queue. Pick up when it suits you.</p></div></div>
    {categories.map((category) => <section className="menu-section" key={category}><h2>{category}</h2><div className="menu-grid">
      {items.filter((item) => item.category === category).map((item) => <article className="menu-card" key={item.id}>
        <div className="food-icon">{item.category === 'Drinks' ? '☕' : item.category === 'Snacks' ? '◈' : '◉'}</div>
        <div className="menu-card-body"><h3>{item.name}</h3><p>{item.description}</p><strong>{money(item.priceCents)}</strong></div>
        <div className="quantity-control" aria-label={`Quantity for ${item.name}`}><button onClick={() => change(item, -1)} disabled={!cart[item.id} || undefined} aria-label={`Remove one ${item.name}`}>−</button><span>{cart[item.id] || 0}</span><button onClick={() => change(item, 1)} aria-label={`Add one ${item.name}`}>+</button></div>
      </article>)}
    </div></section>)}
  </main>;
}

function Cart({ items, cart, setCart, onCheckout }) {
  const selected = items.filter((item) => cart[item.id]);
  const total = selected.reduce((sum, item) => sum + item.priceCents * cart[item.id], 0);
  if (!selected.length) return <aside className="cart-panel empty-cart"><div className="cart-empty-icon">🛍</div><h2>Your cart is empty</h2><p className="muted">Add something delicious from the menu to get started.</p></aside>;
  return <aside className="cart-panel"><div className="cart-title"><h2>Your order</h2><span>{selected.reduce((sum, item) => sum + cart[item.id], 0)} items</span></div><div className="cart-items">
    {selected.map((item) => <div className="cart-item" key={item.id}><div><strong>{item.name}</strong><span>{money(item.priceCents)} each</span></div><div className="cart-item-actions"><button onClick={() => { const next = { ...cart }; if (cart[item.id] <= 1) delete next[item.id]; else next[item.id] -= 1; setCart(next); }}>−</button><span>{cart[item.id]}</span><button onClick={() => setCart({ ...cart, [item.id]: cart[item.id] + 1 })}>+</button></div><b>{money(item.priceCents * cart[item.id])}</b></div>)}
  </div><div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div><button className="primary-button full-width" onClick={onCheckout}>Continue to checkout</button></aside>;
}

function Checkout({ items, cart, onBack, onPlaced }) {
  const [form, setForm] = useState({ studentName: '', studentId: '', pickupTime: '12:30 PM – 1:00 PM', notes: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const data = await request('/orders', { method: 'POST', body: JSON.stringify({ ...form, items: items.filter((item) => cart[item.id]).map((item) => ({ menuItemId: item.id, quantity: cart[item.id] })) }) }); onPlaced(data.order); } catch (err) { setError(err.message); } finally { setSaving(false); } };
  return <main className="content narrow"><button className="back-link" onClick={onBack}>← Back to menu</button><div className="page-heading"><p className="eyebrow">Almost there</p><h1>Confirm your order</h1><p className="muted">Tell us where to send your order updates.</p></div><form className="checkout-form" onSubmit={submit}><label>Full name<input name="studentName" value={form.studentName} onChange={update} required minLength="2" placeholder="e.g. Priya Sharma" /></label><label>Student ID<input name="studentId" value={form.studentId} onChange={update} required placeholder="e.g. CS2024012" /></label><label>Pickup window<select name="pickupTime" value={form.pickupTime} onChange={update}><option>11:30 AM – 12:00 PM</option><option>12:30 PM – 1:00 PM</option><option>1:30 PM – 2:00 PM</option><option>4:30 PM – 5:00 PM</option></select></label><label>Notes <span className="optional">(optional)</span><textarea name="notes" value={form.notes} onChange={update} maxLength="300" placeholder="Any preferences or allergies?"></textarea></label>{error && <div className="error-message" role="alert">{error}</div>}<button className="primary-button full-width" disabled={saving}>{saving ? 'Placing order…' : 'Place order'}</button></form></main>;
}

function Confirmation({ order, onNewOrder }) { return <main className="content confirmation"><div className="success-icon">✓</div><p className="eyebrow">Order placed</p><h1>Thanks, {order.studentName.split(' ')[0]}!</h1><p className="muted">Your order <strong>#{order.id}</strong> will be ready for pickup during <strong>{order.pickupTime}</strong>.</p><div className="confirmation-card"><div><span>Order status</span><strong className="status-pill received">{order.status}</strong></div><div><span>Order total</span><strong>{money(order.totalCents)}</strong></div><div><span>Student ID</span><strong>{order.studentId}</strong></div></div><button className="primary-button" onClick={onNewOrder}>Place another order</button></main>; }

function StaffDashboard() {
  const [orders, setOrders] = useState([]); const [filter, setFilter] = useState('All'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const data = await request(`/orders${filter === 'All' ? '' : `?status=${filter}`}`); setOrders(data.orders); setError(''); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [filter]);
  const advance = async (order) => { const next = order.status === 'Received' ? 'Preparing' : order.status === 'Preparing' ? 'Ready' : 'Completed'; try { await request(`/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); load(); } catch (err) { setError(err.message); } };
  const cancel = async (order) => { try { await request(`/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Cancelled' }) }); load(); } catch (err) { setError(err.message); } };
  return <main className="content staff"><div className="page-heading"><p className="eyebrow">Canteen operations</p><h1>Incoming orders</h1><p className="muted">Keep an eye on the queue and move orders along as they’re prepared.</p></div><div className="filter-row" role="group" aria-label="Filter orders">{statuses.map((status) => <button className={filter === status ? 'filter active' : 'filter'} key={status} onClick={() => setFilter(status)}>{status}</button>)}<button className="refresh" onClick={load}>↻ Refresh</button></div>{error && <div className="error-message" role="alert">{error}</div>}{loading ? <div className="loading">Loading orders…</div> : !orders.length ? <div className="empty-state"><div>☕</div><h2>No orders here</h2><p className="muted">New orders will appear in this view.</p></div> : <div className="orders-table">{orders.map((order) => <article className="order-row" key={order.id}><div className="order-main"><div className="order-id">#{order.id} <span className={`status-pill ${order.status.toLowerCase()}`}>{order.status}</span></div><h3>{order.studentName} <small>({order.studentId})</small></h3><p>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}</p>{order.notes && <p className="order-note">Note: {order.notes}</p>}</div><div className="order-meta"><strong>{money(order.totalCents)}</strong><span>Pickup: {order.pickupTime}</span><div>{order.status !== 'Completed' && order.status !== 'Cancelled' && <><button className="small-button" onClick={() => advance(order)}>{order.status === 'Ready' ? 'Mark completed' : `Mark ${order.status === 'Received' ? 'preparing' : 'ready'}`}</button><button className="cancel-button" onClick={() => cancel(order)}>Cancel</button></>}</div></div></article>)}</div>}</main>;
}

function App() {
  const [view, setView] = useState('student'); const [screen, setScreen] = useState('menu'); const [items, setItems] = useState([]); const [cart, setCart] = useState({}); const [order, setOrder] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { request('/menu').then((data) => setItems(data.items)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const switchView = (next) => { setView(next); setScreen('menu'); };
  return <><Header view={view} setView={switchView} cartCount={Object.values(cart).reduce((sum, value) => sum + value, 0)} />{error ? <main className="content"><div className="error-message" role="alert">{error}</div></main> : view === 'staff' ? <StaffDashboard /> : loading ? <main className="content"><div className="loading" aria-live="polite">Loading today’s menu…</div></main> : screen === 'checkout' ? <Checkout items={items} cart={cart} onBack={() => setScreen('menu')} onPlaced={(placed) => { setOrder(placed); setCart({}); setScreen('confirmation'); }} /> : screen === 'confirmation' ? <Confirmation order={order} onNewOrder={() => setScreen('menu')} /> : <div className="app-layout"><Menu items={items} cart={cart} setCart={setCart} /><Cart items={items} cart={cart} setCart={setCart} onCheckout={() => setScreen('checkout')} /></div>}</>;
}

createRoot(document.getElementById('root')).render(<App />);
