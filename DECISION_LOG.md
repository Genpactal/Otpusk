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

## Open questions

- What is Otpusk's purpose, and who will use it?
- What should the first release include?
- What design, technology, and hosting constraints should guide the project?

## Entry template

### DEC-NNN — Short decision title

- **Date:** YYYY-MM-DD
- **Status:** Proposed / Confirmed / Superseded by DEC-NNN
- **Decision:** What was decided.
- **Context / reason:** Why it was decided, or "Not yet specified."
- **Alternatives considered:** Include only if discussed.
- **Consequences:** Relevant effects, tradeoffs, and follow-up work.
- **Source:** User instruction or other basis for the decision.
