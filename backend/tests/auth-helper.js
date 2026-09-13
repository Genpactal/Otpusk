import assert from 'node:assert/strict';

export async function login(base, id) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${id}@studio.example`, password: `Otpusk-${id}-2026!` }) });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}
