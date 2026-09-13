import { readFile } from 'node:fs/promises';

// Explicit catalogue: callers select an ID, never a filesystem path.
const catalogue = [
  { id: 'welcome-guide', title: 'Welcome to Forma Studio', folder: 'Getting started', owner: 'People team', file: 'getting-started/welcome-guide.md', description: 'Your first-week checklist and a guide to the workspace.' },
  { id: 'contact-directory', title: 'Company contact directory', folder: 'Getting started', owner: 'People team', file: 'getting-started/contact-directory.md', description: 'Find the right person for onboarding, team, and IT questions.' },
  { id: 'leave-guide', title: 'Leave guide', folder: 'Policies', owner: 'People team', file: 'policies/leave-guide.md', description: 'Accrual, approvals, cancellations, and return-to-work rules.' },
  { id: 'remote-work-guide', title: 'Remote work guide', folder: 'Policies', owner: 'People team', file: 'policies/remote-work-guide.md', description: 'Sample guidance for planning and communicating remote work.' },
  { id: 'information-security', title: 'Information security checklist', folder: 'Policies', owner: 'IT team', file: 'policies/information-security.md', description: 'Everyday habits for handling company information.' },
  { id: 'leave-handover', title: 'Leave handover template', folder: 'Templates', owner: 'People team', file: 'templates/leave-handover.md', description: 'A reusable handover outline with a fictional worked example.' },
];
const metadata = ({ file, ...document }) => ({ ...document, filename: file.split('/').at(-1), format: 'Markdown', updatedAt: '2026-09-13', version: '1.0', mock: true });
export const listDocuments = () => catalogue.map(metadata);
export async function getDocument(id) {
  const document = catalogue.find(item => item.id === id);
  if (!document) throw Object.assign(new Error('Document not found.'), { status: 404 });
  return { ...metadata(document), content: await readFile(new URL(`../corporate-documents/${document.file}`, import.meta.url), 'utf8') };
}
