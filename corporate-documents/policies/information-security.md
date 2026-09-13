# Information security checklist

Mock corporate document · Version 1.0 · Updated 13 September 2026
Owner: IT team · Audience: All employees

## Everyday habits

- Use a unique password for each work account and approved multifactor sign-in.
- Lock your device when you step away.
- Install updates through your organization's approved process.
- Check the recipient before sharing a file or sending a message.
- Keep company files in approved work storage.
- Report suspicious messages or lost devices to your IT contact promptly.

## Before sharing a document

Confirm that the recipient needs the information and that its sharing settings
match the intended audience. Ask the document owner if you are unsure.

## Demo boundary

This checklist is sample training material. The current Otpusk draft uses
documented fictional credentials and does not implement multifactor sign-in.
Do not put real employee records or company secrets in the demo document folder.

## Otpusk project status and getting started

Otpusk is a working draft focused on the core leave-tracking criteria. Run
`pnpm install` and `pnpm dev` from the repository root, open
http://127.0.0.1:5173, and sign in with a fictional account from the project
decision journal. Use `pnpm build` and `pnpm start` to inspect the built local
preview.

Email reminders, corporate events, private medical certificates and employment
contracts, financial transparency, and Teams, Jira, banking, or other tool
integrations are planned extensions. They were left for later because cloud
accounts, financial data, production databases, and corporate-mandatory functions
need more security and integration work. This local draft is designed to be easy
to deploy once those decisions are complete.
