# Campus Canteen Pre-Order System

A practical MVP for campus food pre-orders. Students can browse the live menu, build a cart, submit pickup details, and receive an order confirmation. Staff can monitor the incoming queue, filter by status, and move orders through **Received → Preparing → Ready → Completed** or cancel them.

## Setup

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

The React client is at `http://localhost:5173`; the API is at `http://localhost:3000`. The first server start creates `data/canteen.db` and seeds sample menu items. Copy `.env.example` to `.env` to customise `PORT` or the client API URL.

## Development and production

- `npm run dev` starts the Vite client and watch-mode API together.
- `npm run build` creates the production client bundle in `client/dist`.
- `NODE_ENV=production npm start` serves the built client and API from Express.
- `npm test` runs representative API tests.
- `npm run lint` runs ESLint.

## Database

SQLite is stored locally at `data/canteen.db` (ignored by git). The schema has `menu_items`, `orders`, and `order_items` tables. Menu data is seeded only when the menu is empty. Order totals are calculated server-side from current available menu prices.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/menu` | List available menu items |
| POST | `/api/orders` | Validate and create an order |
| GET | `/api/orders?status=Ready` | List orders, optionally filtered |
| GET | `/api/orders/:id` | Get one order with line items |
| PATCH | `/api/orders/:id/status` | Transition an order to a valid next status |

All invalid input returns a JSON `400` response with an error message. Missing resources return `404`; invalid status transitions return `409`.

## Demo walkthrough

1. Open **Order food**, add items from multiple categories, and continue to checkout.
2. Submit a name, student ID, and pickup window to see the confirmation screen.
3. Open **Staff dashboard**, locate the new order, and transition it through the preparation states.
4. Use the status chips to focus on one part of the queue.

## Scope and limitations

This MVP intentionally has no authentication, payments, notifications, menu administration, or external services. Staff access is a client-side view for demonstration; production deployment should add authentication and role-based authorization.
