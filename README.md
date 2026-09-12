# Otpusk

A working draft of a company leave tracking service, with a separate **React frontend**, **Node.js / Express backend**, and **PostgreSQL** data model.

## Run the draft

Requires Node.js 22.12+ and pnpm. From the repository root:

```sh
pnpm install
pnpm dev
```

Open [the frontend](http://127.0.0.1:5173). The API runs separately at `http://127.0.0.1:3001`; Vite proxies `/api` during development.

For a built preview:

```sh
pnpm build
pnpm start
```

Open [the built preview](http://127.0.0.1:3001). Express serves the built React assets along with the API. The frontend and backend remain separate applications in the source and can be deployed independently once production authentication is added.

## Try the roles

The top-right **demo account switcher** lets you explore the fictional Forma Studio workspace:

| Account | Role | Try this |
| --- | --- | --- |
| Alex Morgan | Employee | Request leave, add segments, view balances, cancel or reschedule upcoming leave. |
| Mila Thompson | Manager | Open Approvals and review Alex's or Noah's request with a comment. |
| Sophie Chen | HR | View all employees' balances, search people, and filter the company calendar by team. |
| James Wilson | Manager | Review requests from Engineering employees Leo and Emma. |

The workspace seeds eight fictional employees and sample requests only when the database is empty. Seed dates are relative to the first launch date. Changes persist across reloads and restarts.

Mila has no assigned manager and therefore cannot submit her own new requests. Her sample approved leave is an imported record. Approval routing for top-level managers is still a product decision.

## Database

The default local preview uses **PGlite**, an embedded PostgreSQL engine running in the Node.js backend. It persists data in the ignored `.data/otpusk/` directory, so Docker or a separate PostgreSQL installation is not needed to try the draft. Run one backend process when using this mode.

For a standalone PostgreSQL server, copy `.env.example` to `.env` and set `DATABASE_URL` to an **empty development database**. The server creates the tables and seeds the demo workspace on first use. Both modes use the SQL in `backend/schema.sql` and the same service layer.

An optional Docker configuration is included:

```sh
docker compose up -d
```

Then set:

```dotenv
DATABASE_URL=postgresql://otpusk:otpusk@127.0.0.1:5432/otpusk
```

Restart the backend after changing `.env`. The Docker database is bound to localhost, and its sample password is only for local development. Switching storage modes does not migrate existing records.

## Implemented workflows

- Profiles with start date, team, manager, and annual entitlement.
- Daily accrual of 28 calendar days per year, correct across leap years and year boundaries, with carry-forward.
- Whole-day, multi-segment requests, overlap validation, and immediate balance reservations.
- Manager approval/rejection with a required comment and request history.
- Team calendars and an HR company calendar; only approved leave appears.
- Withdrawal, cancellation, and replacement schedules that retain the original approval while under review.
- Employee balance overview, searchable HR balances, and downloadable decision journal.
- Responsive layouts, keyboard-operable native dialogs, loading/error/empty states.

Company dates default to `Asia/Qyzylorda`, configurable with `COMPANY_TIMEZONE`. Balances use completed employment days and unrounded calculations; display values have two decimals. Pending requests expire on their first leave day, evaluated when the workspace is read or a request changes.

## Project structure

```text
frontend/          React interface, CSS, favicon, and Vite configuration
backend/           Express API, database adapters, schema, seed, and leave rules
backend/tests/     Policy, workflow, authorization, concurrency, and API tests
scripts/dev.mjs    Starts the separate frontend and backend development processes
DECISION_LOG.md    Dated project decisions and implementation assumptions
PROJECT_SPEC.md    Product requirements and leave policy
```

## Verification

```sh
pnpm test
pnpm build
```

Tests run against an isolated, in-memory PostgreSQL engine. They cover accrual, inclusive dates, segmentation, role permissions, reservations, reviews, replacement schedules, cancellation, expiry, concurrent balance use, and HTTP behavior. The standalone `pg` adapter requires a configured PostgreSQL server for deployment-environment testing.

## Draft boundaries

This is a **local demo**, with an explicit `X-Demo-User` identity header and fictional data. It has role checks but no real sign-in: anyone with access to the demo can select an account. The server defaults to localhost and refuses `NODE_ENV=production` or `DEMO_MODE=false`. Real authentication and session management must replace the demo identities before deployment.

The first version serves one company. Account provisioning, profile administration, notifications, multi-company isolation, HR overrides, and changes to already-started leave are not implemented. Schema creation is idempotent setup, not a versioned migration system. Workflow defaults remain open to refinement. Google Fonts are optional network-loaded assets; system fonts are used when unavailable.

See [the specification](PROJECT_SPEC.md) and [decision journal](DECISION_LOG.md) for the agreed scope and assumptions.
