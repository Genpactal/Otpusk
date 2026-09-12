import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.js';
import { seedDatabase } from '../seed.js';
import { createService } from '../service.js';
import { createApp } from '../app.js';
import { accruedDays, balanceFor, normalizeSegments } from '../policy.js';

const TODAY = '2026-09-12';
let db;
before(async () => { db = await openDatabase({ memory: true, connectionString: null }); await seedDatabase(db, TODAY); });
after(async () => { await db.close(); });
const segment = (start, end = start) => ({ start, end });
const service = () => createService(db, { today: () => TODAY });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);

test('daily accrual handles leap years, completed days, and year boundaries', () => {
  near(accruedDays('2024-01-01', '2025-01-01'), 28);
  near(accruedDays('2025-01-01', '2026-01-01'), 28);
  near(accruedDays('2026-01-01', '2026-04-11'), 100 * 28 / 365);
  near(accruedDays('2024-12-31', '2025-01-02'), 28 / 366 + 28 / 365);
  near(accruedDays(TODAY, TODAY), 0);
});
test('segments validate actual dates, include both endpoints, and merge adjacency', () => {
  assert.throws(() => normalizeSegments([segment('2027-02-30')], TODAY, '2025-01-01'), /valid/);
  assert.throws(() => normalizeSegments([segment(TODAY)], TODAY, '2025-01-01'), /after today/);
  assert.throws(() => normalizeSegments([segment('2026-10-01', '2026-10-03'), segment('2026-10-03')], TODAY, '2025-01-01'), /overlap/);
  assert.deepEqual(normalizeSegments([segment('2026-10-02'), segment('2026-10-01')], TODAY, '2025-01-01'), [segment('2026-10-01', '2026-10-02')]);
});
test('leave crossing today is counted once between used and upcoming', () => {
  const employee = { id: 'test', start_date: '2025-01-01' };
  const balance = balanceFor(employee, [{ employee_id: 'test', status: 'approved', segments: [segment('2026-09-10', '2026-09-14')] }], TODAY);
  assert.equal(balance.used, 2);
  assert.equal(balance.approved, 3);
});
test('employee privacy, direct-report scope, and HR overview are enforced', async () => {
  const employee = await service().snapshot('alex');
  assert.ok(employee.requests.every(r => r.employee_id === 'alex'));
  assert.equal(employee.people.find(p => p.id === 'olivia').balance, undefined);
  assert.ok(employee.calendar.every(r => !['leo', 'emma'].includes(r.employee_id)));
  assert.ok(employee.calendar.every(r => !('comment' in r) && !('note' in r)));
  const manager = await service().snapshot('mila');
  assert.ok(manager.requests.some(r => r.employee_id === 'noah'));
  assert.ok(!manager.requests.some(r => r.employee_id === 'emma'));
  const hr = await service().snapshot('sophie');
  assert.equal(hr.people.length, 8);
  assert.ok(hr.people.every(p => p.balance));
  await assert.rejects(service().snapshot('unknown'), /demo account/);
});
test('submission reserves all segments and withdrawal restores the balance', async () => {
  const s = service();
  const before = (await s.snapshot('alex')).balance.available;
  const r = await s.create('alex', { segments: [segment('2027-01-02', '2027-01-03'), segment('2027-01-08')], note: 'Test split request' });
  near((await s.snapshot('alex')).balance.available, before - 3);
  await s.cancel('alex', r.id);
  near((await s.snapshot('alex')).balance.available, before);
});
test('invalid, overlapping, excessive, and unrouteable requests are rejected', async () => {
  const s = service();
  await assert.rejects(s.create('alex', { segments: [segment('2026-09-24')] }), /overlap/);
  await assert.rejects(s.create('alex', { segments: [segment('2027-01-01', '2027-12-31')] }), /Not enough/);
  await assert.rejects(s.create('mila', { segments: [segment('2027-01-01')] }), /eligible manager/);
  await assert.rejects(s.create('alex', { segments: null }), /segments/);
});
test('manager approval requires ownership and comment; approval does not double-charge', async () => {
  const s = service();
  const before = (await s.snapshot('alex')).balance.available;
  const r = await s.create('alex', { segments: [segment('2027-02-01', '2027-02-02')] });
  await assert.rejects(s.review('james', r.id, { status: 'approved', comment: 'OK' }), /assigned manager/);
  await assert.rejects(s.review('alex', r.id, { status: 'approved', comment: 'OK' }), /assigned manager/);
  await assert.rejects(s.review('sophie', r.id, { status: 'approved', comment: 'OK' }), /assigned manager/);
  await assert.rejects(s.review('mila', r.id, { status: 'approved', comment: ' ' }), /comment/);
  await s.review('mila', r.id, { status: 'approved', comment: 'Enjoy the break.' });
  near((await s.snapshot('alex')).balance.available, before - 2);
  await assert.rejects(s.review('mila', r.id, { status: 'approved', comment: 'Again' }), /no longer/);
  await s.cancel('alex', r.id);
  near((await s.snapshot('alex')).balance.available, before);
});
test('rejection releases reserved days and retains review comment and history', async () => {
  const s = service();
  const before = (await s.snapshot('alex')).balance.available;
  const r = await s.create('alex', { segments: [segment('2027-03-01')] });
  await s.review('mila', r.id, { status: 'rejected', comment: 'Please choose another date.' });
  const after = await s.snapshot('alex');
  near(after.balance.available, before);
  assert.equal(after.requests.find(item => item.id === r.id).comment, 'Please choose another date.');
  assert.equal(after.history.filter(item => item.request_id === r.id).length, 2);
});
test('replacement reserves only the increase; rejection preserves original dates', async () => {
  const s = service();
  const before = (await s.snapshot('alex')).balance.available;
  const r = await s.create('alex', { replacesId: 'seed-alex-upcoming', segments: [segment('2027-04-01', '2027-04-09')] });
  let state = await s.snapshot('alex');
  near(state.balance.available, before - 2);
  assert.ok(state.calendar.some(item => item.id === 'seed-alex-upcoming'));
  assert.ok(!state.calendar.some(item => item.id === r.id));
  await assert.rejects(s.create('alex', { replacesId: 'seed-alex-upcoming', segments: [segment('2027-05-01')] }), /already awaiting/);
  await s.review('mila', r.id, { status: 'rejected', comment: 'Keep the original dates.' });
  state = await s.snapshot('alex');
  near(state.balance.available, before);
  assert.ok(state.calendar.some(item => item.id === 'seed-alex-upcoming'));
});
test('shorter replacement frees days only on approval and atomically replaces calendar', async () => {
  const s = service();
  const original = await s.create('alex', { segments: [segment('2027-06-01', '2027-06-04')] });
  await s.review('mila', original.id, { status: 'approved', comment: 'Approved.' });
  const before = (await s.snapshot('alex')).balance.available;
  const replacement = await s.create('alex', { replacesId: original.id, segments: [segment('2027-06-02', '2027-06-03')] });
  near((await s.snapshot('alex')).balance.available, before);
  await s.review('mila', replacement.id, { status: 'approved', comment: 'New dates work.' });
  const state = await s.snapshot('alex');
  near(state.balance.available, before + 2);
  assert.ok(!state.calendar.some(r => r.id === original.id));
  assert.ok(state.calendar.some(r => r.id === replacement.id));
  await s.cancel('alex', replacement.id);
});
test('cancelling original leave also withdraws a pending replacement', async () => {
  const s = service();
  const before = (await s.snapshot('alex')).balance.available;
  const original = await s.create('alex', { segments: [segment('2027-07-01', '2027-07-02')] });
  await s.review('mila', original.id, { status: 'approved', comment: 'Approved.' });
  const replacement = await s.create('alex', { replacesId: original.id, segments: [segment('2027-07-05', '2027-07-08')] });
  await s.cancel('alex', original.id);
  const state = await s.snapshot('alex');
  near(state.balance.available, before);
  assert.equal(state.requests.find(r => r.id === replacement.id).status, 'withdrawn');
});
test('concurrent requests cannot spend the same remaining days', async () => {
  const s = service();
  const results = await Promise.allSettled([
    s.create('alex', { segments: [segment('2027-08-01', '2027-08-12')] }),
    s.create('alex', { segments: [segment('2027-09-01', '2027-09-12')] }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  for (const result of results) if (result.status === 'fulfilled') await s.cancel('alex', result.value.id);
  assert.ok((await s.snapshot('alex')).balance.available >= 0);
});
test('past leave cannot be cancelled and another employee cannot cancel it', async () => {
  await assert.rejects(service().cancel('alex', 'seed-alex-past'), /has not started/);
  await assert.rejects(service().cancel('noah', 'seed-alex-upcoming'), /own leave/);
});
test('pending requests expire on their first day and release reservations', async () => {
  const r = await service().create('alex', { segments: [segment('2026-09-13')] });
  const later = createService(db, { today: () => '2026-09-13' });
  const state = await later.snapshot('alex');
  assert.equal(state.requests.find(item => item.id === r.id).status, 'expired');
  assert.equal(state.balance.pending, 3);
});
test('HTTP API returns expected errors, protects role actions, and exports the journal', async () => {
  const server = createApp(db, { today: () => TODAY }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${root}/api/workspace`)).status, 401);
    const res = await fetch(`${root}/api/requests/seed-noah/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-User': 'alex' }, body: JSON.stringify({ status: 'approved', comment: 'Test' }) });
    assert.equal(res.status, 403);
    const journal = await fetch(`${root}/api/decision-log`);
    assert.match(journal.headers.get('content-disposition'), /attachment/);
    assert.match(await journal.text(), /DEC-006/);
    assert.equal((await fetch(`${root}/api/missing`)).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
