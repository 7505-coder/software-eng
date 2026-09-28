import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/index.js';

test('health endpoint is available', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  server.close();
});

test('menu endpoint returns seeded available items', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/menu`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.items.length >= 5);
  assert.ok(data.items.every((item) => item.priceCents >= 0 && item.available === 1));
  server.close();
});

test('order validation rejects an empty cart', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const response = await fetch(`http://localhost:${port}/api/orders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studentName: 'A Student', studentId: 'S1', pickupTime: '12:00', items: [] }) });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Please check the order details.');
  server.close();
});
