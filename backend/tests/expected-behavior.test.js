import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db.js';
import { seedDatabase } from '../seed.js';
import { createService } from '../service.js';
import { createApp } from '../app.js';
import { login } from './auth-helper.js';
import { accruedDays } from '../policy.js';

const today = '2026-09-12';
const seg = (start, end = start) => ({ start, end });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
let db;
before(async () => { db = await openDatabase({ memory: true, connectionString: null }); });
beforeEach(async () => { await db.query('TRUNCATE notifications, request_events, leave_requests, employees RESTART IDENTITY CASCADE'); await seedDatabase(db, today); });
after(async () => db.close());
const service = date => createService(db, { today: () => date || today });
async function newHire() { await db.query("INSERT INTO employees(id,name,title,email,team,role,start_date,manager_id,color) VALUES ('newhire','New Employee','Designer','new@example.test','Design','employee','2026-09-01','mila','#ccddaa')"); }
async function approve(s, id) { return s.review('mila', id, { status: 'approved', comment: 'Enjoy your leave.' }); }

test('selected-date forecast shows today, future accrued entitlement, and reservations', async () => {
  await newHire(); const s = service();
  const now = await s.forecast('newhire', today), later = await s.forecast('newhire', '2026-11-01');
  near(now.accrued, 11 * 28 / 365);
  near(later.accrued, 61 * 28 / 365);
  near(later.earnedSinceToday, 50 * 28 / 365);
  await assert.rejects(s.forecast('newhire', '2026-02-30'), /Choose today/);
  const r = await s.create('newhire', { segments: [seg('2026-11-01', '2026-11-03')] });
  await approve(s, r.id);
  const future = await s.forecast('newhire', '2026-11-01');
  near(future.available, later.accrued - 3);
  assert.equal((await s.snapshot('newhire')).balance.available, 0);
});
test('approval uses accrual by the start date, never the end date', async () => {
  await newHire(); const s = service();
  await assert.rejects(s.create('newhire', { segments: [seg('2026-09-20', '2026-09-21')] }), /2026-09-20/);
  const r = await s.create('newhire', { segments: [seg('2026-11-01', '2026-11-03')] });
  await db.query("UPDATE employees SET start_date='2026-10-15' WHERE id='newhire'");
  await assert.rejects(approve(s, r.id), /Not enough accrued/);
  assert.equal((await s.snapshot('newhire')).requests.find(x => x.id === r.id).status, 'pending');
  assert.equal((await s.snapshot('newhire')).notifications.length, 0);
});
test('approval revalidates splitting rules with an actionable explanation', async () => {
  const s = service();
  await assert.rejects(s.preview('alex', { segments: [seg('2026-11-01', '2026-10-31')] }), /end date/);
  const r = await s.create('alex', { segments: [seg('2026-11-01')] });
  await db.query('UPDATE leave_requests SET segments=$1::jsonb WHERE id=$2', [JSON.stringify([seg('2026-11-01', '2026-11-03'), seg('2026-11-03')]), r.id]);
  await assert.rejects(approve(s, r.id), /segments cannot overlap/);
});
test('retried submissions and decisions create one notification per recipient/event', async () => {
  const s = service(), payload = { segments: [seg('2026-11-01')], idempotencyKey: 'notification-retry-key' };
  const [first, second] = await Promise.all([s.create('alex', payload), s.create('alex', payload)]);
  assert.equal(first.id, second.id);
  assert.equal((await s.snapshot('mila')).notifications.filter(n => n.request_id === first.id && n.kind === 'new_request').length, 1);
  await Promise.all([approve(s, first.id), approve(s, first.id)]);
  const inbox = (await s.snapshot('alex')).notifications;
  assert.equal(inbox.filter(n => n.request_id === first.id && n.kind === 'decision').length, 1);
  await assert.rejects(s.create('alex', { ...payload, segments: [seg('2026-11-02')] }), /retry key/);
  await assert.rejects(s.readNotification('noah', inbox[0].id), /not found/);
  await s.readNotification('alex', inbox[0].id);
  await s.readNotification('alex', inbox[0].id);
  assert.ok((await s.snapshot('alex')).notifications[0].read_at);
});
test('rejection produces a single decision notification with the manager comment', async () => {
  const s = service(); const r = await s.create('alex', { segments: [seg('2026-11-01')] });
  const decision = { status: 'rejected', comment: 'Please choose dates with more coverage.' };
  await s.review('mila', r.id, decision); await s.review('mila', r.id, decision);
  const notices = (await s.snapshot('alex')).notifications.filter(n => n.request_id === r.id);
  assert.equal(notices.length, 1); assert.match(notices[0].message, /more coverage/);
});
test('manager sees overlapping approved leave from the employee team only', async () => {
  const s = service(); const r = await s.create('noah', { segments: [seg('2026-09-24', '2026-09-25')] });
  const request = (await s.snapshot('mila')).requests.find(x => x.id === r.id);
  assert.ok(request.conflicts.some(c => c.employee === 'Alex Morgan'));
  assert.ok(!request.conflicts.some(c => c.employee === 'Emma Davis'));
  await approve(s, r.id); // Advisory conflict warning, not a blanket rejection.
});
test('reminders run once for employee and manager, including repeated jobs and restarts', async () => {
  const s = service(); const r = await s.create('alex', { segments: [seg('2026-09-15', '2026-09-16')] });
  await approve(s, r.id);
  await Promise.all([s.runReminders(), s.runReminders(), service().runReminders()]);
  const reminders = (await db.query("SELECT * FROM notifications WHERE request_id=$1 AND kind='reminder'", [r.id])).rows;
  assert.deepEqual(reminders.map(n => n.recipient_id).sort(), ['alex', 'mila']);
  const change = await s.create('alex', { replacesId: r.id, segments: [seg('2026-09-16', '2026-09-17')] });
  await approve(s, change.id); await service('2026-09-13').runReminders();
  assert.equal((await db.query("SELECT * FROM notifications WHERE request_id IN ($1,$2) AND kind='reminder'", [r.id, change.id])).rows.length, 2);
});
test('reminders respect configuration and skip cancelled or pending requests', async () => {
  const s = service(); const r = await s.create('alex', { segments: [seg('2026-09-18')] });
  await approve(s, r.id); await s.runReminders();
  assert.equal((await db.query("SELECT * FROM notifications WHERE request_id=$1 AND kind='reminder'", [r.id])).rows.length, 0);
  await s.cancel('alex', r.id); await service('2026-09-15').runReminders();
  assert.equal((await db.query("SELECT * FROM notifications WHERE request_id=$1 AND kind='reminder'", [r.id])).rows.length, 0);
  const configured = createService(db, { today: () => today, reminderDays: 10 });
  const p = await s.create('alex', { segments: [seg('2026-09-19')] });
  await configured.runReminders();
  assert.equal((await db.query("SELECT * FROM notifications WHERE request_id=$1 AND kind='reminder'", [p.id])).rows.length, 0);
  await approve(s, p.id);
  await configured.runReminders();
  assert.equal((await db.query("SELECT * FROM notifications WHERE request_id=$1 AND kind='reminder'", [p.id])).rows.length, 2);
});
test('cancellation after start refunds only future dates and retains calendar history', async () => {
  const s = service(), before = await s.snapshot('olivia');
  const result = await s.cancel('olivia', 'seed-olivia');
  assert.equal(result.retainedDays, 2); assert.equal(result.returnedDays, 3);
  const after = await s.snapshot('olivia');
  near(after.balance.available, before.balance.available + 3);
  assert.deepEqual(after.calendar.find(r => r.id === 'seed-olivia').segments, [seg('2026-09-11', '2026-09-12')]);
  await s.cancel('olivia', 'seed-olivia');
  near((await s.snapshot('olivia')).balance.available, after.balance.available);
  const later = await service('2026-09-20').snapshot('olivia');
  assert.equal(later.balance.used, 2);
});
test('return-date change during leave recalculates balances after manager approval', async () => {
  const s = service(), before = await s.snapshot('olivia');
  const payload = { replacesId: 'seed-olivia', segmentIndex: 0, returnDate: '2026-09-14' };
  const preview = await s.preview('olivia', payload); assert.equal(preview.days, 3);
  const r = await s.create('olivia', payload);
  near((await s.snapshot('olivia')).balance.available, before.balance.available);
  await approve(s, r.id);
  const after = await s.snapshot('olivia');
  near(after.balance.available, before.balance.available + 2);
  near(after.balance.accrued, before.balance.accrued);
  assert.equal(after.balance.used, 1); assert.equal(after.balance.approved, 2);
  assert.deepEqual(after.calendar.find(c => c.id === r.id).segments, [seg('2026-09-11', '2026-09-13')]);
  await assert.rejects(s.create('olivia', { replacesId: r.id, segmentIndex: 0, returnDate: '2026-09-11' }), /cannot be before today|valid date/);
});
test('new earlier requests cannot consume accrual promised to later bookings', async () => {
  await newHire(); const s = service();
  const later = await s.create('newhire', { segments: [seg('2026-11-01', '2026-11-04')] });
  await approve(s, later.id);
  await assert.rejects(s.create('newhire', { segments: [seg('2026-10-01', '2026-10-02')] }), /2026-11-01/);
});
test('SSE notifies every connected viewer after an approved calendar change', async () => {
  const app = createApp(db, { today: () => today, streamIntervalMs: 20 });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const controllers = [new AbortController(), new AbortController()];
  try {
    const streams = await Promise.all(['alex', 'noah'].map(async (id, index) => fetch(`${base}/api/stream?user=${id}`, { headers: { Cookie: await login(base, id) }, signal: controllers[index].signal })));
    const readers = streams.map(r => r.body.getReader());
    for (const reader of readers) assert.match(new TextDecoder().decode((await reader.read()).value), /event: change/);
    const s = app.locals.service, r = await s.create('alex', { segments: [seg('2026-11-01')] });
    await approve(s, r.id);
    await Promise.all(readers.map(async reader => {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) { const chunk = new TextDecoder().decode((await reader.read()).value); if (chunk.includes('event: change')) return; }
      assert.fail('Live change event not received');
    }));
    for (const id of ['alex', 'noah']) assert.ok((await s.snapshot(id)).calendar.some(c => c.id === r.id));
    assert.equal((await fetch(`${base}/api/stream?user=invalid`)).status, 401);
  } finally { controllers.forEach(c => c.abort()); app.locals.closeStreams(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
