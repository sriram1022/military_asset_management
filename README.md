# Fieldstock | Military Asset Management

A role-based inventory and movement register for military equipment across multiple bases. The React client supports opening and closing stock, purchases, transfers, assignments, expenditures, dashboard filters, and the net-movement detail view. The Express API uses MongoDB, JWT authentication, Mongoose validation, transactional stock changes, and an audit trail.

## Requirements

- Node.js 20 or newer
- MongoDB Atlas (or a MongoDB replica set; inventory operations use multi-document transactions)
- An Atlas database user and network access configured for the development machine

## Local setup

1. Configure the backend environment:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

2. Edit `backend/.env`. Put the Atlas URI in `MONGO_URI`, replace both credential placeholders, and use a database password that has not been shared publicly. Set a unique `JWT_SECRET` of at least 32 characters, plus an email and unique password of at least 12 characters for each role. The provided cluster URI can be used as the host; rotate the password previously shared in chat before connecting. Set `ROLE_BASE_ID` or `ROLE_BASE_NAME` to select an existing base; otherwise, the oldest base in the database is used.

3. Create the first administrator and start the API:

   ```powershell
   cd backend
   npm install
   npm run seed
   npm run dev
   ```

   The API listens on `http://localhost:5000`; `GET /api/health` is the health check. The seed creates the Admin and one user for each other role. Existing accounts are not given new passwords when the seed is rerun. In local development, if either non-admin password is omitted, the seed generates a random temporary password and prints it once; copy it into a password manager. Production seeding requires explicit role emails and passwords.

4. In a second terminal, start the client:

   ```powershell
   cd frontend
   Copy-Item .env.example .env
   npm install
   npm run dev
   ```

   Open `http://localhost:5173`. Set `VITE_API_URL` in `frontend/.env` if the API is hosted somewhere other than `http://localhost:5000/api`. Set `CLIENT_URL` in `backend/.env` to the frontend origin for production.

5. Sign in with each seeded role account to verify page and API permissions. Admin can add further bases, equipment, and users from the system menu. User provisioning is admin-only; there is no public registration endpoint.

## Roles

- **Admin**: global read/write access, base and equipment setup, account provisioning, and audit history.
- **Base Commander**: reads and records stock activity for their assigned base. A transfer must originate at their base; the destination can be any known base.
- **Logistics Officer**: reads and records purchases and transfers for their base. Assignment and expenditure pages and APIs are forbidden.

Authorization is enforced by API middleware, not just by hiding navigation. Base scope is derived from the authenticated account rather than trusted from the request. Logistics Officers can only access dashboard movement summaries, purchases, and transfers; inventory and assignment/expenditure APIs are denied. Authenticated read requests (including denied reads), successful logins, account changes, and inventory-changing operations are recorded in the audit trail. Transfers, purchases, assignments, and expenditures update inventory and write their audit entry inside the same MongoDB transaction.

## Collections

`users`, `bases`, `assets`, `inventory`, `purchases`, `transfers`, `assignments`, `expenditures`, and `auditlogs` are modeled in `backend/src/models`. Inventory stores its opening balance and current stock per asset/base pair. Date-range dashboard balances are reconstructed from that opening amount and dated transactions; assignments and expenditures reduce stock, while net movement is purchases plus transfers in minus transfers out.

MongoDB transactions require a replica set. Atlas clusters provide this; a standalone local `mongod` does not.

## API outline

Authenticated endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/auth/me` | Authenticated |
| `GET`, `POST` | `/api/auth/users` | Admin |
| `GET`, `POST` | `/api/bases` | Authenticated read; Admin write |
| `GET`, `POST` | `/api/assets` | Authenticated read; Admin write |
| `GET` | `/api/inventory` | Authenticated, base-scoped |
| `POST` | `/api/inventory/opening-balance` | Admin, Base Commander |
| `GET` | `/api/dashboard` | Authenticated, supports `startDate`, `endDate`, `baseId`, `type` |
| `GET`, `POST` | `/api/purchases` | Authenticated read; all roles write |
| `GET`, `POST` | `/api/transfers` | Authenticated read; all roles write |
| `GET`, `POST` | `/api/assignments` | Admin, Base Commander |
| `GET`, `POST` | `/api/expenditures` | Admin, Base Commander |
| `GET` | `/api/audit-logs` | Admin |

Example purchase body:

```json
{
  "assetId": "<asset-id>",
  "baseId": "<base-id>",
  "quantity": 24,
  "purchaseDate": "2026-09-27",
  "supplier": "Regional Supply",
  "remarks": "Quarterly replenishment"
}
```

Example transfer body:

```json
{
  "assetId": "<asset-id>",
  "fromBaseId": "<source-base-id>",
  "toBaseId": "<destination-base-id>",
  "quantity": 6,
  "remarks": "Scheduled redistribution"
}
```

## Checks and deployment

Run backend checks with `cd backend; npm test` and build the production client with `cd frontend; npm run build`. Deploy the `frontend` directory to Vercel or Netlify and the `backend` directory to Render or Railway; configure the same environment values in the hosting provider. For the backend, set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run `npm run seed` once against the production database before launching `npm start`.

The repository does not include database dumps, hosted demo links, or a walkthrough video; these require the target database and hosting accounts. Do not commit `.env` files or share deployment credentials.