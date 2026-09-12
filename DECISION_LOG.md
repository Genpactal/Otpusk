# Otpusk — Decision Journal

This journal records agreed project decisions, their context, and their consequences. Keep this file available as a downloadable project record.

## How this journal is maintained

- Add an entry when a meaningful project decision is agreed, including changes to scope, design, technology, or delivery.
- Distinguish confirmed decisions from proposals and open questions. Do not record assumptions as user-approved decisions.
- Give each decision a stable ID and a date in YYYY-MM-DD format.
- Preserve earlier entries. When a decision changes, add a new entry and mark the earlier one as superseded, linking to the replacement.
- Record the reason when known; otherwise say it has not yet been specified.
- Keep credentials, secrets, and sensitive personal information out of this journal.

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
- **Status:** Implemented draft default — assistant-selected
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

## Open questions

- What visual design, interface language, and mobile priorities should guide the project?
- What authentication, company isolation, and profile administration model should be used?
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
