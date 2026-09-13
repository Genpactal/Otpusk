import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.js';
import { seedDatabase } from '../seed.js';
import { createApp } from '../app.js';
import { login } from './auth-helper.js';

test('two clients sharing a login receive live approvals with one reservation and notification per event', async () => {
  const db = await openDatabase({ memory: true, connectionString: null });
  await seedDatabase(db, '2026-09-12');
  const app = createApp(db, { today: () => '2026-09-12', streamIntervalMs: 20 });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const controller = new AbortController();
  try {
    const cookie = await login(base, 'mila');
    const request = (path, target, body) => fetch(base + '/api' + path, { signal: controller.signal, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Account-Id': target }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    const streams = await Promise.all(['alex', 'mila'].map(id => request('/stream?user=' + id, id)));
    const readers = streams.map(stream => stream.body.getReader());
    const nextRevision = async reader => {
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        assert.equal(chunk.done, false);
        buffer += new TextDecoder().decode(chunk.value);
        const matches = [...buffer.matchAll(/event: change\ndata: (\d+)\n\n/g)];
        if (matches.length) return Number(matches.at(-1)[1]);
      }
    };
    await Promise.all(readers.map(nextRevision));
    const before = (await (await request('/workspace', 'alex')).json()).balance;
    const payload = { segments: [{ start: '2026-11-10', end: '2026-11-11' }], idempotencyKey: 'two-tabs-same-submission' };
    const responses = await Promise.all([request('/requests', 'alex', payload), request('/requests', 'alex', payload)]);
    for (const response of responses) assert.equal(response.status, 201);
    const [first, retry] = await Promise.all(responses.map(response => response.json()));
    assert.equal(first.id, retry.id);
    const pending = await (await request('/workspace', 'mila')).json();
    assert.ok(pending.requests.some(r => r.id === first.id && r.status === 'pending'));
    assert.equal(pending.notifications.filter(n => n.request_id === first.id && n.kind === 'new_request').length, 1);
    const decisions = await Promise.all([request(`/requests/${first.id}/review`, 'mila', { status: 'approved', comment: 'Two-client approval' }), request(`/requests/${first.id}/review`, 'mila', { status: 'approved', comment: 'Two-client approval' })]);
    for (const response of decisions) assert.equal(response.status, 200);
    const requiredRevision = Number(await app.locals.service.revision());
    const timeout = setTimeout(() => controller.abort(), 5000);
    try { await Promise.all(readers.map(async reader => { while (await nextRevision(reader) < requiredRevision) {} })); }
    finally { clearTimeout(timeout); }
    const [employee, manager] = await Promise.all(['alex', 'mila'].map(async id => (await request('/workspace', id)).json()));
    for (const workspace of [employee, manager]) assert.ok(workspace.calendar.some(r => r.id === first.id));
    assert.equal(employee.balance.approved, before.approved + 2);
    assert.equal(employee.notifications.filter(n => n.request_id === first.id).length, 1);
    // A logout invalidates the common session for both clients, regardless of selected view.
    await request('/auth/logout', 'mila', {});
    assert.equal((await request('/workspace', 'alex')).status, 401);
    assert.equal((await request('/workspace', 'mila')).status, 401);
  } finally { controller.abort(); app.locals.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); }
});
