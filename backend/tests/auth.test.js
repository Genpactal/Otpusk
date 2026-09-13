import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.js';
import { seedDatabase } from '../seed.js';
import { createApp } from '../app.js';
import { login } from './auth-helper.js';

let db, app, server, base;
before(async () => {
  db = await openDatabase({ memory: true, connectionString: null });
  await seedDatabase(db, '2026-09-12');
  app = createApp(db, { today: () => '2026-09-12', streamIntervalMs: 20 });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { app.locals.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await db.close(); });
const request = (path, cookie, target, body) => fetch(base + '/api' + path, { headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(target ? { 'X-Account-Id': target } : {}) }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });

test('anonymous users cannot access company data, streams, journal or mutate leave', async () => {
  for (const path of ['/workspace', '/accounts', '/balance?date=2026-10-01', '/stream?user=mila', '/decision-log']) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/requests', null, 'mila', {})).status, 401);
  assert.equal((await fetch(base + '/api/workspace', { headers: { 'X-Demo-User': 'mila' } })).status, 401);
});

test('login validates passwords, normalizes emails, and stores only salted hashes and session digests', async () => {
  assert.equal((await request('/auth/login', null, null, { email: 'alex@studio.example', password: 'wrong' })).status, 401);
  assert.equal((await request('/auth/login', null, null, { email: {}, password: [] })).status, 401);
  const response = await request('/auth/login', null, null, { email: ' ALEX@STUDIO.EXAMPLE ', password: 'Otpusk-alex-2026!' });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal((await response.json()).canSwitch, false);
  const rows = (await db.query('SELECT password_hash FROM account_credentials')).rows;
  assert.equal(rows.length, 8);
  assert.ok(rows.every(row => /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(row.password_hash)));
  const token = response.headers.get('set-cookie').split(';')[0].split('=')[1];
  assert.ok((await db.query('SELECT token_hash FROM account_sessions')).rows.every(row => row.token_hash !== token));
  const before = rows.map(row => row.password_hash).sort();
  await seedDatabase(db, '2026-09-13');
  assert.deepEqual((await db.query('SELECT password_hash FROM account_credentials')).rows.map(row => row.password_hash).sort(), before);
});

test('employees cannot switch through headers, live stream URLs, or access the credential journal', async () => {
  const cookie = await login(base, 'alex');
  assert.equal((await (await request('/workspace', cookie)).json()).user.id, 'alex');
  for (const id of ['mila', 'sophie', 'noah']) {
    assert.equal((await request('/workspace', cookie, id)).status, 403);
    assert.equal((await request('/stream?user=' + id, cookie)).status, 403);
    assert.equal((await request('/requests/seed-noah/review', cookie, id, { status: 'approved', comment: 'Spoofed' })).status, 403);
  }
  assert.equal((await request('/accounts', cookie)).status, 403);
  assert.equal((await request('/decision-log', cookie)).status, 403);
  const spoof = await fetch(base + '/api/workspace', { headers: { Cookie: cookie, 'X-Demo-User': 'mila' } });
  assert.equal((await spoof.json()).user.id, 'alex');
});

test('managers and HR may switch to any demo role, retain their signed-in identity, and return', async () => {
  for (const id of ['mila', 'sophie']) {
    const cookie = await login(base, id);
    assert.equal((await (await request('/accounts', cookie)).json()).length, 8);
    for (const target of ['alex', 'james', 'sophie']) assert.equal((await (await request('/workspace', cookie, target)).json()).user.id, target);
    assert.equal((await (await request('/auth/session', cookie, 'alex')).json()).user.id, id);
    assert.equal((await (await request('/workspace', cookie)).json()).user.id, id);
    assert.equal((await request('/decision-log', cookie)).status, 200);
    // Switching intentionally adopts the selected account's permissions.
    assert.equal((await request('/requests/seed-noah/review', cookie, 'alex', { status: 'approved', comment: 'No approval permission' })).status, 403);
  }
});

test('logout revokes the session and closes existing live streams', async () => {
  const cookie = await login(base, 'alex');
  const stream = await request('/stream?user=alex', cookie);
  const reader = stream.body.getReader();
  await reader.read();
  assert.equal((await request('/auth/logout', cookie, null, {})).status, 200);
  assert.equal((await request('/workspace', cookie)).status, 401);
  const closed = (async () => { while (!(await reader.read()).done) {} return true; })();
  assert.equal(await Promise.race([closed, new Promise(resolve => { const t = setTimeout(() => resolve(false), 2000); t.unref(); })]), true);
});

test('expired sessions and form or cross-site mutations are rejected', async () => {
  const cookie = await login(base, 'alex');
  await db.query('UPDATE account_sessions SET expires_at=0');
  assert.equal((await request('/auth/session', cookie)).status, 401);
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', body: 'email=alex' })).status, 415);
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' })).status, 403);
});

test('repeated unsuccessful logins are throttled', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request('/auth/login', null, null, { email: 'alex@studio.example', password: 'wrong' })).status, 401);
  assert.equal((await request('/auth/login', null, null, { email: 'alex@studio.example', password: 'wrong' })).status, 429);
});

test('corporate document library requires login, is shared by all roles, and serves real sample files', async () => {
  for (const path of ['/documents', '/documents/welcome-guide', '/documents/welcome-guide/download']) assert.equal((await request(path)).status, 401);
  for (const account of ['alex', 'mila', 'sophie']) {
    // Use a fresh app to keep this check independent of the intentional rate-limit test.
    const docsApp = createApp(db);
    const docsServer = docsApp.listen(0, '127.0.0.1');
    await new Promise(resolve => docsServer.once('listening', resolve));
    const docsBase = `http://127.0.0.1:${docsServer.address().port}`;
    try {
      const cookie = await login(docsBase, account);
      const read = path => fetch(docsBase + '/api' + path, { headers: { Cookie: cookie } });
      const catalogue = await (await read('/documents')).json();
      assert.equal(catalogue.length, 6);
      assert.equal(new Set(catalogue.map(doc => doc.folder)).size, 3);
      for (const document of catalogue) {
        assert.equal(document.file, undefined);
        const preview = await (await read('/documents/' + document.id)).json();
        assert.ok(preview.content.startsWith('# '));
        assert.match(preview.content, /Mock corporate document/);
        const download = await read('/documents/' + document.id + '/download');
        assert.equal(download.status, 200);
        assert.match(download.headers.get('content-disposition'), /attachment/);
        assert.match(download.headers.get('content-type'), /text\/markdown/);
        assert.equal(await download.text(), preview.content);
      }
      assert.equal((await read('/documents/not-a-document')).status, 404);
      assert.equal((await read('/documents/%2e%2e%2fDECISION_LOG.md/download')).status, 404);
    } finally { docsServer.closeAllConnections(); await new Promise(resolve => docsServer.close(resolve)); }
  }
});
