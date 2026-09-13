# Otpusk — Decision Journal

This journal records agreed project decisions, their context, and their consequences. Keep this file available as a downloadable project record.

## How this journal is maintained

- Add an entry when a meaningful project decision is agreed, including changes to scope, design, technology, or delivery.
- Distinguish confirmed decisions from proposals and open questions. Do not record assumptions as user-approved decisions.
- Give each decision a stable ID and a date in YYYY-MM-DD format.
- Preserve earlier entries. When a decision changes, add a new entry and mark the earlier one as superseded, linking to the replacement.
- Record the reason when known; otherwise say it has not yet been specified.
- Keep real credentials, secrets, and sensitive personal information out of this journal. DEC-013 explicitly permits fictional local-demo login examples at the user's request.
- Update the journal when requested, and do not reproduce or link it in chat unless the user explicitly asks to see or download it (DEC-014).

## Decisions

### DEC-001 — Project name and type

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Start a new web project named **Otpusk**.
- **Context / reason:** The user initiated the project with this name and type.
- **Consequences:** Use Otpusk as the project name. Product purpose, features, design, technology stack, and hosting remain undecided.
- **Source:** User's project kickoff request.

### DEC-002 — Maintain a downloadable decision journal

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Maintain an ongoing decision journal for Otpusk that the user can download whenever needed.
- **Context / reason:** The user requested an accessible record of project decisions from the start.
- **Consequences:** Update this journal as decisions are made and retain the history of changed decisions.
- **Source:** User's project kickoff request.
- **Implementation note:** The assistant selected Markdown and the project-root file `DECISION_LOG.md` as the initial portable format and location. These can be changed on request.

### DEC-003 — Use the Otpusk GitHub repository

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Connect the project and its decision journal to [Genpactal/Otpusk](https://github.com/Genpactal/Otpusk).
- **Context / reason:** The user provided this repository and requested that the journal be connected to it.
- **Consequences:** Store the journal and its maintenance instructions in Git so their history can be tracked in the repository.
- **Source:** User's repository connection request.

### DEC-004 — Separate React frontend and Node.js backend with PostgreSQL

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Use a client-server architecture with separate React frontend and Node.js backend applications, backed by PostgreSQL.
- **Context / reason:** The user explicitly specified this architecture and stack; additional rationale was not specified.
- **Consequences:** Business rules and database access belong to the backend. Backend framework, API style, ORM, authentication, and deployment choices remain open.
- **Source:** User's architecture and product description.

### DEC-005 — Company leave tracking product and required features

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Build a company leave tracking service with employee profiles (start date, team, manager), proportional leave accrual, single-period or segmented requests, manager approval or rejection with comments, team calendars, an HR company calendar and employee balances, cancellation, and rescheduling.
- **Context / reason:** Employees need to track entitlement and request leave, managers need to review requests, and HR needs a company-wide overview.
- **Consequences:** Maintain the detailed requirements in [PROJECT_SPEC.md](PROJECT_SPEC.md). The product purpose and initial feature scope left open at kickoff are now defined.
- **Source:** User's architecture and product description.

### DEC-006 — Initial accrual and request-splitting policy

- **Date:** 2026-09-12
- **Status:** Superseded by DEC-011 for funding timing; accrual rate, calendar-day counting, carry-forward, and splitting rules retained
- **Decision:** Accrue 28 calendar days per full year, daily from the employment start date using each calendar year's actual length. Count all dates in inclusive leave segments, including weekends and holidays. Carry unused days forward without expiry and disallow borrowing future accrual. Allow one or more non-overlapping whole-day segments of at least 1 day each, reviewed as a single request; no mandatory 14-day segment applies.
- **Context / reason:** The user explicitly delegated definition of accrual and splitting rules. These defaults make proportional accrual and flexible segmentation straightforward to explain and calculate.
- **Alternatives considered:** The user offered a mandatory 14-day segment as an example, not a requirement. It is not adopted in this initial policy.
- **Consequences:** Use precise balances internally and two decimals for display. The initial policy has no holiday-calendar dependency or half-day requests. Detailed rules and examples are in [PROJECT_SPEC.md](PROJECT_SPEC.md).
- **Source:** User delegation for policy selection; concrete policy selected by the assistant.

### DEC-007 — Proposed approval, reservation, and change workflows

- **Date:** 2026-09-12
- **Status:** Superseded by DEC-011 and DEC-012 for the updated implemented workflows
- **Decision:** Reserve days on submission, require a manager comment for either review outcome, allow withdrawal and cancellation before leave starts, and retain original approved dates while replacement dates await approval. Apply the balance, access, and history defaults described in [PROJECT_SPEC.md](PROJECT_SPEC.md).
- **Context / reason:** These proposed details keep balances consistent and avoid losing approved leave while a reschedule is under review.
- **Consequences:** Implementation needs request history, atomic balance updates, and separate tracking of pending replacements. These workflow details remain subject to user confirmation.
- **Source:** Assistant proposal derived from the required features; not yet user-approved.

### DEC-008 — Build the first working draft

- **Date:** 2026-09-12
- **Status:** Confirmed
- **Decision:** Begin implementing a draft website using the documented architecture and leave tracking requirements.
- **Context / reason:** The user approved moving from specification into a draft build.
- **Consequences:** Implement the employee, manager, and HR views and their leave workflows. Use DEC-007 as the initial draft workflow baseline while retaining its proposed status for future refinement.
- **Source:** User: "Great Now you can start building draft version of website."

### DEC-009 — Draft tooling and local database setup

- **Date:** 2026-09-12
- **Status:** Implemented draft default — assistant-selected
- **Decision:** Use Vite for the React frontend, Express with a REST API for the separate Node.js backend, and SQL shared by a standalone PostgreSQL adapter (`pg`) and an embedded PostgreSQL adapter (PGlite) for the local preview. Use pnpm with a committed lockfile.
- **Context / reason:** The draft should run immediately in the current environment, where no standalone PostgreSQL or Docker executable was found. PGlite allows the same PostgreSQL schema and workflow logic to run locally without additional database setup.
- **Consequences:** Local data persists under ignored `.data/`; setting `DATABASE_URL` selects a standalone PostgreSQL development database. Include Docker Compose and setup instructions. Embedded storage is a preview convenience, not a change to the agreed PostgreSQL architecture. Test the standalone adapter in its target environment before deployment.
- **Source:** Assistant implementation choices within the authorized draft build.

### DEC-010 — Visual direction and demo identity model

- **Date:** 2026-09-12
- **Status:** Identity model superseded by DEC-013; visual direction retained
- **Decision:** Build an English-language, responsive workspace with forest-green accents, neutral surfaces, balance cards, leave lists, and monthly calendars. Use the fictional Forma Studio company and eight sample employees, with a visible demo account switcher.
- **Context / reason:** Make the employee, manager, and HR flows easy to review before selecting production authentication, branding, or account administration.
- **Consequences:** Demo identities are not secure sign-in. Bind the preview to localhost and refuse production mode until authentication is implemented. Preserve profile administration, multi-company isolation, hosting, and top-level manager approval routing as open decisions. Add a direct journal download in the website.
- **Source:** Assistant implementation defaults, subject to user refinement.

### DEC-011 — Projected accrual, live calendars, and leave changes

- **Date:** 2026-09-12
- **Status:** Confirmed requirements — implementation details noted below
- **Decision:** Show remaining days today and accrued/available days for a selected future date. Validate the entire request against accrual at its first segment's start, including existing commitments; reject invalid splitting or insufficient accrual with a clear explanation. Show managers overlapping approved leave in the employee's team. Update calendars for connected viewers without page refresh. Allow cancellation after leave starts, returning only unused days, and recalculate balances when the return-to-work date changes.
- **Context / reason:** The user provided explicit expected behavior, replacing the initial prohibition on future accrual and on cancelling started leave.
- **Implementation details:** Retain 28 calendar days annually, daily proportional accrual, carry-forward, and whole-day segments of at least one day. Check every booking deadline transactionally, so another request cannot spend entitlement needed by an existing booking. Display a nonnegative available balance and identify reservations funded by future accrual. Use Server-Sent Events with a shared database revision for live updates and reconnect catch-up.
- **Cancellation convention (assistant-selected):** Before the first segment, release all days. Once leave has begun, retain dates through today and release dates from tomorrow onward, including later segments. Keep consumed dates in calendar history. Completed vacations cannot be edited.
- **Return-date convention (assistant-selected):** The selected date is the first calendar day back, and leave ends the preceding day. Employees may request a return-date change for an upcoming or active segment, subject to manager approval and funding checks; past dates stay intact. Changes recalculate used/committed/remaining days. Gross accrual remains proportional to employment duration because paid leave still earns entitlement.
- **Source:** User's expected-behavior list; conventions selected by the assistant to make the rules executable.

### DEC-012 — One-time notifications and reminders

- **Date:** 2026-09-12
- **Status:** Confirmed notification requirements — channel and timing are assistant-selected defaults
- **Decision:** Notify the manager once per new request and the employee once per approval/rejection. Remind both employee and manager once before approved vacation begins.
- **Implementation details:** Use a persistent in-app inbox, with read state per recipient. Default reminder lead time is 3 calendar days, configurable via `REMINDER_DAYS` (1–30). Send one reminder per recipient for the whole vacation, before its first segment; replacement schedules share the original reminder identity, preventing another reminder for the same vacation. A 60-second server job runs without browser viewers, with startup and workspace-read catch-up while still before leave starts. Late approval within the lead window produces the reminder at the next check.
- **Consequences:** Unique database deduplication keys and transactional writes prevent duplicate notifications. Request retry keys and idempotent decision retries prevent repeat delivery. The backend must be running for scheduled reminders; if restarted during the pre-start window it catches up. Cancelled, rejected, pending, or already-started requests do not receive new reminders. Email, SMS, and operating-system notifications are outside this implementation.
- **Source:** User's expected-behavior list; delivery channel and reminder lead time selected by the assistant.

### DEC-013 — Password login and privileged demo account switching

- **Date:** 2026-09-13
- **Status:** Confirmed behavior — implementation details are assistant-selected
- **Decision:** Require password login. Employees access only their own account; HR and managers keep account switching. Record login/password examples for each role in this journal, as explicitly requested.
- **Context / reason:** Replace unrestricted demo identity selection with employee login while retaining convenient role testing for HR and managers. Supersedes the identity model in DEC-010.
- **Implementation details:** All eight fictional accounts sign in with their email and password. Store salted scrypt password hashes and hashed random session tokens in PostgreSQL. Use an HttpOnly, SameSite=Strict cookie with an eight-hour expiry, server-side logout, JSON-only mutations, and a per-process limit of ten unsuccessful login attempts per IP in fifteen minutes. Existing employee and leave data are preserved; missing credentials are added without resetting existing passwords. Live streams require the same session and recheck it for logout/expiry.
- **Switching scope (assistant-selected interpretation):** A signed-in HR or manager may act as any of the eight demo accounts, including another manager or HR account. The selected account's existing leave permissions apply. Switching privilege comes from the original signed-in identity, so it remains available while viewing an employee. A visible banner identifies both accounts and offers a return action. Employees cannot switch through UI, headers, or stream URLs. The former `X-Demo-User` header no longer authenticates a request.
- **Journal access (assistant-selected):** The website's journal download is available only to signed-in HR/managers because it contains the requested demonstration passwords. The repository journal remains a source file and these credentials are intentionally public demo examples.
- **Consequences:** This remains a local fictional workspace; production startup remains disabled because credentials are documented and broad account switching is intentionally retained. Account invitations, password reset/change, disabling accounts, company isolation, and production hardening remain future work. Existing leave history records actions under the selected account; separate attribution to the original signed-in account is not yet implemented.
- **Source:** User request to add employee login, keep switching for HR/managers, and document role login examples.

#### Local demo login examples

These are deliberately shared examples for fictional local accounts, not real company credentials. Do not reuse these passwords elsewhere.

| Role | Account | Login email | Demo password |
| --- | --- | --- | --- |
| Employee | Alex Morgan | alex@studio.example | `Otpusk-alex-2026!` |
| Employee | Olivia Rhye | olivia@studio.example | `Otpusk-olivia-2026!` |
| Employee | Noah Williams | noah@studio.example | `Otpusk-noah-2026!` |
| Employee | Leo Park | leo@studio.example | `Otpusk-leo-2026!` |
| Employee | Emma Davis | emma@studio.example | `Otpusk-emma-2026!` |
| Manager | Mila Thompson | mila@studio.example | `Otpusk-mila-2026!` |
| Manager | James Wilson | james@studio.example | `Otpusk-james-2026!` |
| HR | Sophie Chen | sophie@studio.example | `Otpusk-sophie-2026!` |

### DEC-014 — Journal updates without displaying it in chat

- **Date:** 2026-09-13
- **Status:** Confirmed
- **Decision:** Make requested journal edits and updates without showing the journal, its credentials, or a journal link in chat for now. Provide it when the user explicitly asks to view or download it.
- **Context / reason:** The user asked to keep the journal maintained but not display it in the current conversation.
- **Consequences:** Supplements DEC-002's downloadable journal requirement; changes remain in the project file and its history. A brief completion notice may mention that the journal was updated.
- **Source:** User: "Edit and update journal when i ask but dont show in chat for now".

### DEC-015 — Simultaneous clients with a shared browser login

- **Date:** 2026-09-13
- **Status:** Confirmed
- **Decision:** Support two simultaneously open clients, including browser tabs. Tabs in the same browser share one login; independent accounts per tab are not required.
- **Context / reason:** The user requested concurrent clients and explicitly selected "No, share one login across tabs" when asked about separate employee/manager logins.
- **Implementation details:** Retain DEC-013's shared HttpOnly session cookie. After a successful login/logout, publish a random change marker through browser storage; other same-origin tabs immediately discard the old workspace/forms and check the server session. The marker contains no credentials or session token. Focus and API checks cover suspended tabs or unavailable storage. Ignore stale authentication checks and old-session API failures when a newer session change has already occurred.
- **Consequences:** Logging out in either tab signs out both; logging in from either tab opens that account in both. Each tab keeps independent navigation and, for HR/managers, its own selected account view. Authorized leave changes continue to refresh connected views through Server-Sent Events. Concurrent retries retain one request/reservation and one notification per event through the existing transactional checks. Different browsers or browser profiles can still use separate sessions.
- **Source:** User's simultaneous-client requirement and explicit shared-login preference.

### DEC-016 — Shared corporate document folder with mock content

- **Date:** 2026-09-13
- **Status:** Confirmed feature — content and organization are assistant-selected
- **Decision:** Add a corporate document folder for employees with mock data.
- **Implementation details:** Add Corporate documents to the website navigation for all signed-in roles. Organize six fictional Forma Studio documents into Getting started, Policies, and Templates. Include a welcome guide, contact directory, leave guide, remote-work guide, information security checklist, and a completed example handover template. Provide search, folder filters, readable previews, and downloads. Store the actual Markdown files in the repository's `corporate-documents/` folder and serve them through authenticated API routes using an explicit document catalogue.
- **Scope interpretation (assistant-selected):** These are shared company documents, not private employee personnel files. All content is labeled as mock data. The leave guide follows the draft's existing leave rules; other sample guidance does not establish a real company policy. Uploads, editing, version administration, and employee-specific file permissions are outside this initial folder.
- **Consequences:** Users can read/download the sample library after login; anonymous access and arbitrary filesystem paths are rejected. The journal and its demo passwords remain separate from this employee library. Sample handover dates do not create leave requests.
- **Source:** User: "Also add folder for employees corporate dcuments with mock data".

### DEC-017 — Draft status, onboarding guidance, and future scope

- **Date:** 2026-09-13
- **Status:** Confirmed project communication
- **Decision:** Label Otpusk as a working draft, explain how to start it locally, and document the completed core criteria, planned next work, and current omissions in the main README and every mock corporate document.
- **Context / reason:** The user requested a clear project-stage block in the corporate documents and described the current progress, future ideas, and reasons for deferred work.
- **Current state:** The draft covers the main leave-tracking criteria: employee profiles, accrual, requests, manager approval, team and HR calendars, notifications, reminders, cancellation, rescheduling, password login, shared browser sessions, and a mock corporate document library. Local startup is `pnpm install` then `pnpm dev`; a built preview uses `pnpm build` then `pnpm start`.
- **Future scope:** Email reminders through an external channel; corporate events and parties; private employee documents such as medical certificates and employment contracts; employee financial transparency for current salary and possible promotions; and integrations with Teams, Jira, banking systems, and other company tools.
- **Deferred scope and reason:** Cloud account connections, financial data, production database concerns, and mandatory corporate functions were deferred because they require additional security, product decisions, permissions, and complex integration work. The current draft is intentionally ready for local review and straightforward deployment after those decisions.
- **Communication note:** The user's personal explanation about a recent laptop purchase and illness is treated as context for the project update, not as a product requirement or a claim in user-facing corporate policy content. Mock documents explicitly state that they are examples and do not create real policy, employment terms, leave requests, or assignments.
- **Source:** User's request to add draft status/getting-started blocks and their description of what is planned, complete, and deferred.

## Open questions

- What visual design, interface language, and mobile priorities should guide the project?
- What production authentication, company isolation, and profile administration model should be used beyond DEC-013's local password login and privileged switching?
- Who approves requests when an employee has no eligible assigned manager?
- Should the default reminder lead time, cancellation cutoff, or notification channel be changed?
- What backend framework, API style, ORM, hosting, and deployment setup should be used?

## Entry template

### DEC-NNN — Short decision title

- **Date:** YYYY-MM-DD
- **Status:** Proposed / Confirmed / Superseded by DEC-NNN
- **Decision:** What was decided.
- **Context / reason:** Why it was decided, or "Not yet specified."
- **Alternatives considered:** Include only if discussed.
- **Consequences:** Relevant effects, tradeoffs, and follow-up work.
- **Source:** User instruction or other basis for the decision.
