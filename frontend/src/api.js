import { sessionRevision } from './session-sync.js';

export async function api(path, user, body) {
  const revision = sessionRevision();
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Account-Id': user } : {}) },
    ...(body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/') && revision === sessionRevision()) window.dispatchEvent(new Event('otpusk-session-expired'));
    throw Object.assign(new Error(data.error || 'Unable to complete this action.'), { status: response.status });
  }
  return data;
}
