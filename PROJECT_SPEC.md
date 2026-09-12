# Otpusk — Project Specification

## Product

Otpusk is a leave tracking service for companies. Employees can view their leave entitlement and balance, request leave, and manage upcoming leave. Managers review requests and see team availability. HR sees leave and remaining balances across the company.

## Confirmed architecture

- **Architecture:** Client-server, with separate frontend and backend applications.
- **Frontend:** React.
- **Backend:** Node.js. The backend owns authorization, leave calculations, validation, and approval workflows.
- **Database:** PostgreSQL, accessed through the backend.

Backend framework, API style, ORM, authentication, hosting, and deployment setup remain to be selected.

## Required capabilities

| Area | Requirement |
| --- | --- |
| Employee profile | Store employment start date, team, and assigned manager. |
| Employee balance | Show leave entitlement and remaining days. The proposed detailed balance breakdown appears below. |
| Leave accrual | Accrue vacation entitlement proportionally to employment duration using the rules below. |
| Leave request | Submit inclusive start and end dates for a single period or multiple segments. |
| Manager review | Approve or reject a request with a comment. |
| Team calendar | Display approved leave for the employee's team. |
| HR dashboard | Display a company-wide approved-leave calendar and remaining days by employee. |
| Changes | Cancel or request rescheduling of upcoming vacation with balance and calendar updates. |

## Initial leave policy

The following are product rules selected by the assistant under the user's explicit delegation to define accrual and request-splitting rules. They are recorded in DEC-006. Related workflow defaults are recorded separately in DEC-007.

### Accrual and day counting

- Annual entitlement is **28 calendar days** per full calendar year of employment.
- Accrual starts on the employee's employment start date. Each completed calendar day of employment earns `28 / days_in_that_calendar_year` days, using 365 or 366 as appropriate.
- Accrual spans calendar years by summing each year's contribution. It is based on continuous employment duration, including weekends and approved leave; attendance and unpaid-leave deductions are outside the initial policy.
- Dates are evaluated in the company's configured time zone. Leave periods are date-only values with inclusive endpoints.
- Every date in a leave segment counts, including weekends and public holidays. For example, July 1 through July 7 costs 7 days.
- Keep full calculation precision internally and display balances to two decimal places. Validate requests against the unrounded balance.
- Unused entitlement carries forward without expiry in the initial policy. January 1 does not reset the balance.
- Future accrual cannot be borrowed: an employee must have enough available accrued days when submitting a request.

### Splitting requests

- A request contains one or more segments. Each segment must cover at least **1 whole calendar day**; half-days are outside the initial scope.
- No mandatory 14-day segment and no annual limit on the number of segments apply.
- Segments within a request must not overlap. Adjacent segments are treated as one continuous period.
- A request cannot overlap the employee's other pending or approved leave, except its own original dates when requesting a replacement schedule.
- All segments in a request are reviewed together: the manager approves or rejects the entire request.

## Initial workflow defaults

These are assistant-proposed defaults pending user confirmation; they do not change the confirmed feature requirements.

### Balances and approval

- New requests must start after today and on or after the employment start date. Pending requests expire when their first segment begins, releasing their reservation.
- Submission reserves the requested days immediately. A pending request cannot reserve days already committed to another request.
- `Available days = accrued days - used days - approved upcoming days - pending reservations`.
- Approved leave dates before today count as used; today and later approved dates count as committed upcoming days. Every date is counted exactly once.
- The assigned manager approves or rejects with a required comment. Employees cannot approve their own requests; approval routing for employees without an eligible manager remains an open question.
- Approval moves reserved days into approved leave without charging twice. Rejection releases the reservation.
- The backend revalidates permissions, request state, dates, and balance when processing a change. Concurrent submissions or approvals must not overdraw the balance.
- Approved leave appears on the team and HR calendars. Pending requests remain visible in request lists and the manager's review queue.

### Cancellation

- Employees can withdraw pending requests, releasing their reserved days.
- Employees can cancel approved requests if none of their segments has started. This releases the committed days and removes the leave from calendars; the cancellation remains in history.
- Partial cancellation and changes to already-started or past requests require a later policy decision and are excluded from the initial self-service flow.

### Rescheduling

- A pending request is withdrawn and replaced with a new submission.
- For an approved request whose segments have not started, an employee can submit one replacement schedule at a time. The manager reviews the replacement with a comment.
- The original approval and calendar dates remain effective until the replacement is approved.
- Reserve only the additional days when the replacement costs more than the original. A shorter replacement does not free days until approved.
- Approval atomically replaces the original schedule, adjusts the balance, and updates calendars. Rejection or withdrawal releases any additional reservation and preserves the original approval.
- A replacement that is still pending when the original or proposed leave begins expires, releases any additional reservation, and preserves the original approval.
- Canceling the original request also withdraws any pending replacement and releases both commitments.

### Access and history

- Employees view their own profile, balances, and requests, plus their team's approved-leave calendar.
- Managers review their direct reports' requests and view team availability.
- HR views company-wide leave and balances. HR approval overrides and profile-editing permissions remain undecided.
- Team calendar entries show employee names and approved dates. Review comments are restricted to the employee, assigned manager, and HR.
- Keep a history of submissions, decisions, cancellations, and schedule changes, including actor, timestamp, and relevant comments.

## Open decisions

The working draft implements the workflow defaults above for review. See DEC-008 through DEC-010 in [the decision journal](DECISION_LOG.md) for implementation choices. The draft uses Express, a REST API, Vite, and a local PGlite preview with a standalone PostgreSQL option. It provides a fictional single-company workspace with demo account switching. These draft defaults do not settle production authentication, branding, tenancy, or hosting.

- Visual design, interface language, and mobile layout priorities.
- Authentication, account provisioning, and whether the first release serves one company or multiple isolated companies.
- Who manages profiles, teams, manager assignments, and the company time zone.
- Approval routing for top-level managers and employees without an assigned manager.
- Confirmation or revision of the proposed workflow defaults above.
- Backend framework, API style, ORM, hosting, and deployment setup.

## Policy examples

- A full calendar year of employment earns 28 days, including in a leap year.
- After 100 completed employment days within a non-leap year, an employee has accrued `100 × 28 / 365 = 7.671232...` days, displayed as 7.67.
- A 3-day segment and a separate 4-day segment cost 7 days and receive a single approval decision.
- Under the proposed reservation workflow, submitting those 7 days against 10 accrued, otherwise uncommitted days leaves 3 available. Rejection restores 10 available.
- Under the proposed rescheduling workflow, replacing 7 approved days with 9 reserves 2 extra days until review. Rejection retains the original 7 approved days and releases the extra 2.
