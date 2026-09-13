const KEY = 'otpusk-session-change';
let revision = 0;
export const sessionRevision = () => revision;

// Only a change marker is shared. Credentials and session tokens stay out of storage.
export function publishSessionChange() {
  revision++;
  try { localStorage.setItem(KEY, crypto.randomUUID()); } catch { /* Focus and API checks still reconcile sessions if storage is unavailable. */ }
}

export function subscribeSessionChanges(onChange) {
  const listener = event => { if (event.key === KEY) { revision++; onChange(); } };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
