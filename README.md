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

Sign in with a fictional account's email and password. The role-specific demo credentials are recorded in `DECISION_LOG.md`. Employees see only their own account. Signed-in HR and managers retain the top-right **account switcher** and can explore any account in the fictional Forma Studio workspace:

| Account | Role | Try this |
| --- | --- | --- |
| Alex Morgan | Employee | Request leave, add segments, view balances, cancel or reschedule upcoming leave. |
| Mila Thompson | Manager | Open Approvals and review Alex's or Noah's request with a comment. |
| Sophie Chen | HR | View all employees' balances, search people, and filter the company calendar by team. |
| James Wilson | Manager | Review requests from Engineering employees Leo and Emma. |

The workspace seeds eight fictional employees and sample requests only when the database is empty. Seed dates are relative to the first launch date. Changes persist across reloads and restarts. Existing databases receive missing demo password hashes automatically without resetting passwords or leave data. Sessions last eight hours and survive server restarts; Sign out revokes the session. When switching, a banner shows the signed-in and selected accounts and offers a return action.

Mila has no assigned manager and therefore cannot submit her own new requests. Her sample approved leave is an imported record. Approval routing for top-level managers is still a product decision.

### Use two tabs together

Open the same local website URL in two tabs in the same browser. Both tabs share one login: signing in or out in either tab updates the other automatically. Each tab can stay on its own page; HR/managers can also select a different account view in each tab. Leave requests, decisions, notifications, and calendars update live across connected tabs. Separate browsers or profiles can have independent logins.

## Corporate documents

Open **Corporate documents** in the sidebar after signing in. The shared mock library contains six readable/downloadable Markdown files across Getting started, Policies, and Templates, with search and folder filters. The actual files live in `corporate-documents/`; their catalogue is in `backend/documents.js`. All roles can read the library. Uploads and private employee files are not part of this draft.

## Current project status and roadmap

Otpusk is a working draft. The core leave-tracking criteria are covered, including profiles, accrual, requests, manager approval, calendars, HR overview, notifications, reminders, cancellation, rescheduling, login, shared browser sessions, and the mock corporate document library.

To get started, run `pnpm install`, then `pnpm dev` from the repository root and open http://127.0.0.1:5173. Sign in with a fictional account from the project decision journal. Use `pnpm build` followed by `pnpm start` to run the built local preview.

Planned next work includes email reminders; corporate events and parties; private employee records such as medical certificates and employment contracts; financial transparency for current salary and possible promotions; and integrations with Teams, Jira, banking systems, and other company tools. These areas were left for a later stage because cloud accounts, financial data, production databases, and mandatory corporate functions require additional security, product decisions, and complex integration work. The current draft is ready for local review and straightforward deployment once those decisions are made.

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
- Selected-date accrual forecasts and funding checks at each vacation's first day, protecting other bookings.
- Persistent in-app request/decision notifications, with transactionally enforced deduplication and read state.
- One reminder per recipient before the first segment; the default is 3 calendar days (`REMINDER_DAYS`).
- Manager review warnings for overlapping approved leave in the employee's team.
- Live calendar updates via Server-Sent Events, including reconnect catch-up.
- Cancellation of active leave that retains consumed days and returns only unused dates; manager-reviewed return-to-work changes.

Company dates default to `Asia/Qyzylorda`, configurable with `COMPANY_TIMEZONE`. Balances use completed employment days and unrounded calculations; display values have two decimals. Pending requests expire on their first leave day, evaluated when the workspace is read or a request changes.

The reminder job runs every 60 seconds in the backend, plus startup and workspace-read catch-up. Keep the server running to generate reminders on time. Reminders appear in the bell inbox; no email, SMS, or external messages are sent. Replacement requests share a reminder identity with the original vacation. Cancellation during leave keeps today charged and returns dates from tomorrow; an approved return-date change ends leave the day before the selected date.

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

This is a **local demo** with password sign-in, salted scrypt hashes, database-backed sessions, and fictional data. Employee sessions cannot switch accounts. HR and manager sessions can intentionally act as any demo account; business actions use that selected account's permissions and existing audit identity. `X-Demo-User` no longer grants access. The journal download is restricted to HR/managers because it contains intentionally shared demo passwords. The server defaults to localhost and refuses `NODE_ENV=production` or `DEMO_MODE=false`. Published demo passwords, broad switching, and missing account lifecycle controls mean production setup remains future work.

The first version serves one company. Account provisioning, profile administration, external notification channels, multi-company isolation, and HR overrides are not implemented. Schema setup applies additive, repeatable changes that preserve existing data, but is not yet a versioned migration system. Notification deduplication is enforced in PostgreSQL; standalone database deployment still needs its own environment verification. Workflow defaults remain open to refinement. Google Fonts are optional network-loaded assets; system fonts are used when unavailable.

See [the specification](PROJECT_SPEC.md) and [decision journal](DECISION_LOG.md) for the agreed scope and assumptions.
