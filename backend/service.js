import { createHash, randomUUID } from 'node:crypto';
import { accruedDays, addDays, balanceFor, chargedSegments, fail, normalizeSegments, overlaps, todayIn, totalDays, validDate, validateFunding } from './policy.js';

export function createService(db, { today = () => todayIn(process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda'), reminderDays = Number(process.env.REMINDER_DAYS || 3) } = {}) {
  if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 30) throw new Error('REMINDER_DAYS must be an integer from 1 to 30.');
  const rows = async tx => (await tx.query('SELECT * FROM leave_requests ORDER BY created_at DESC, id')).rows;
  const employees = async tx => (await tx.query('SELECT * FROM employees ORDER BY name')).rows;
  const touch = tx => tx.query('UPDATE workspace_revision SET revision=revision+1 WHERE id=1');
  async function event(tx, id, actor, action, comment = '') {
    await tx.query('INSERT INTO request_events (request_id,actor_id,action,comment,created_at) VALUES ($1,$2,$3,$4,$5)', [id, actor, action, comment, new Date().toISOString()]);
    await touch(tx);
  }
  async function notify(tx, recipient, request, kind, key, message) {
    if (!recipient) return;
    const result = await tx.query('INSERT INTO notifications (recipient_id,request_id,kind,dedupe_key,message,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id', [recipient, request, kind, key, message, new Date().toISOString()]);
    if (result.rows.length) await touch(tx);
  }
  async function expire(tx) {
    const requests = await rows(tx);
    for (const r of requests.filter(r => r.status === 'pending')) {
      const original = requests.find(o => o.id === r.replaces_id);
      const returnChange = r.change_segment !== null && r.change_segment !== undefined;
      const tooLate = returnChange
        ? !original || original.status !== 'approved' || original.segments[r.change_segment]?.end < today() || r.segments[r.change_segment]?.end < addDays(today(), -1)
        : r.segments[0].start <= today() || (original && (original.status !== 'approved' || original.segments[0].start <= today()));
      if (tooLate) {
        await tx.query("UPDATE leave_requests SET status='expired' WHERE id=$1", [r.id]);
        await event(tx, r.id, null, 'expired');
      }
    }
  }
  async function reminders(tx) {
    await expire(tx);
    const requests = await rows(tx), people = await employees(tx);
    for (const r of requests.filter(r => r.status === 'approved' && r.segments[0].start > today() && r.segments[0].start <= addDays(today(), reminderDays))) {
      const employee = people.find(p => p.id === r.employee_id);
      let root = r;
      const visited = new Set();
      while (root.replaces_id && !visited.has(root.id)) { visited.add(root.id); root = requests.find(p => p.id === root.replaces_id) || { ...root, replaces_id: null }; }
      for (const recipient of new Set([employee.id, employee.manager_id].filter(Boolean))) {
        await notify(tx, recipient, r.id, 'reminder', `${root.id}:reminder:${recipient}`, `${employee.name}'s leave starts ${r.segments[0].start}. Return to work ${addDays(r.segments[0].end, 1)}.`);
      }
    }
  }
  async function context(tx, actorId) {
    const people = await employees(tx);
    const actor = people.find(p => p.id === actorId);
    if (!actor) fail('Choose a demo account to continue.', 401);
    await expire(tx);
    return { actor, people, requests: await rows(tx) };
  }
  function prepare(employee, requests, body, excluding) {
    const original = body.replacesId ? requests.find(r => r.id === body.replacesId && r.employee_id === employee.id) : undefined;
    let input = body.segments, changeSegment = null;
    if (body.replacesId) {
      if (!original || original.status !== 'approved') fail('Only approved leave can be changed.');
      if (requests.some(r => r.replaces_id === original.id && r.status === 'pending' && r.id !== excluding)) fail('A schedule change is already awaiting review.');
      if (body.returnDate !== undefined) {
        changeSegment = body.segmentIndex;
        if (!Number.isInteger(changeSegment) || !original.segments[changeSegment]) fail('Choose a valid leave segment.');
        const selected = original.segments[changeSegment];
        if (!validDate(body.returnDate) || body.returnDate <= selected.start || body.returnDate < today()) fail('Return to work must be a valid date after the segment starts and cannot be before today.');
        if (selected.end < today()) fail('Completed leave cannot be changed.');
        if (body.returnDate === addDays(selected.end, 1)) fail('Choose a different return-to-work date.');
        input = original.segments.map((s, i) => i === changeSegment ? { ...s, end: addDays(body.returnDate, -1) } : s);
        if (input[changeSegment + 1] && addDays(input[changeSegment].end, 1) >= input[changeSegment + 1].start) fail('The new return date must leave a gap before the next segment.');
      } else if (original.segments[0].start <= today()) fail('For leave already started, change the return-to-work date instead.');
    }
    const segments = normalizeSegments(input, today(), employee.start_date, changeSegment !== null);
    const blocking = requests.filter(r => r.employee_id === employee.id && ['pending', 'approved'].includes(r.status) && r.id !== original?.id && r.id !== excluding);
    if (blocking.some(r => overlaps(segments, r.segments))) fail('These dates overlap an existing leave request.');
    const candidate = { id: excluding || 'candidate', employee_id: employee.id, status: 'pending', segments, replaces_id: original?.id || null };
    validateFunding(employee, [...requests.filter(r => r.id !== excluding), candidate]);
    return { segments, original, changeSegment };
  }
  function conflicts(employee, request, requests, people) {
    return requests.filter(r => r.status === 'approved' && r.employee_id !== employee.id && people.find(p => p.id === r.employee_id)?.team === employee.team && overlaps(r.segments, request.segments)).map(r => ({ requestId: r.id, employee: people.find(p => p.id === r.employee_id).name, segments: r.segments }));
  }
  return {
    accounts: async () => (await employees(db)).map(({ id, name, role, color }) => ({ id, name, role, color })),
    revision: async () => String((await db.query('SELECT revision FROM workspace_revision WHERE id=1')).rows[0].revision),
    runReminders: () => db.transaction(reminders),
    snapshot: actorId => db.transaction(async tx => {
      const { actor, people } = await context(tx, actorId);
      await reminders(tx);
      const requests = await rows(tx);
      const canRead = r => r.employee_id === actor.id || actor.role === 'hr' || (actor.role === 'manager' && people.find(p => p.id === r.employee_id)?.manager_id === actor.id);
      const visible = requests.filter(canRead).map(r => ({ ...r, conflicts: conflicts(people.find(p => p.id === r.employee_id), r, requests, people) }));
      const directory = people.filter(p => actor.role === 'hr' || p.team === actor.team || p.id === actor.manager_id || p.manager_id === actor.id).map(p => {
        const full = p.id === actor.id || actor.role === 'hr' || (actor.role === 'manager' && p.manager_id === actor.id);
        return full ? { ...p, balance: balanceFor(p, requests, today()) } : { id: p.id, name: p.name, team: p.team, color: p.color, title: p.title };
      });
      const calendar = requests.filter(r => chargedSegments(r).length && (actor.role === 'hr' || people.find(p => p.id === r.employee_id)?.team === actor.team)).map(r => ({ id: r.id, employee_id: r.employee_id, segments: chargedSegments(r) }));
      const history = (await tx.query('SELECT * FROM request_events ORDER BY created_at DESC')).rows.filter(e => visible.some(r => r.id === e.request_id));
      const notifications = (await tx.query('SELECT * FROM notifications WHERE recipient_id=$1 ORDER BY id DESC', [actor.id])).rows;
      return { today: today(), company: { name: 'Forma Studio', timezone: process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda', reminderDays }, user: actor, people: directory, requests: visible, calendar, history, notifications, balance: balanceFor(actor, requests, today()), demo: true };
    }),
    forecast: (actorId, date) => db.transaction(async tx => {
      const { actor, requests } = await context(tx, actorId);
      if (!validDate(date) || date < today()) fail('Choose today or a future date.');
      return { date, ...balanceFor(actor, requests, date), earnedSinceToday: accruedDays(actor.start_date, date) - accruedDays(actor.start_date, today()) };
    }),
    preview: (actorId, body) => db.transaction(async tx => {
      const { actor, requests } = await context(tx, actorId);
      const prepared = prepare(actor, requests, body);
      const date = prepared.segments[0].start;
      return { date, accrued: accruedDays(actor.start_date, date), days: totalDays(prepared.segments), returnDates: prepared.segments.map(s => addDays(s.end, 1)), canSubmit: true };
    }),
    create: (actorId, body) => db.transaction(async tx => {
      const { actor, people, requests } = await context(tx, actorId);
      const fingerprint = createHash('sha256').update(JSON.stringify([body.segments, body.replacesId, body.returnDate, body.segmentIndex, body.note])).digest('hex');
      if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length < 8 || body.idempotencyKey.length > 100)) fail('Invalid request retry key.');
      const previous = body.idempotencyKey && requests.find(r => r.employee_id === actor.id && r.idempotency_key === body.idempotencyKey);
      if (previous) { if (previous.payload_fingerprint !== fingerprint) fail('This retry key was already used for different request details.', 409); return { id: previous.id }; }
      if (!people.some(p => p.id === actor.manager_id && p.id !== actor.id && p.role === 'manager')) fail('An eligible manager must be assigned before you can request leave.');
      const { segments, original, changeSegment } = prepare(actor, requests, body);
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length > 1000) fail('Keep your note to 1,000 characters.');
      const id = randomUUID();
      await tx.query("INSERT INTO leave_requests (id,employee_id,status,segments,note,replaces_id,created_at,idempotency_key,payload_fingerprint,change_segment) VALUES ($1,$2,'pending',$3::jsonb,$4,$5,$6,$7,$8,$9)", [id, actor.id, JSON.stringify(segments), note, original?.id || null, new Date().toISOString(), body.idempotencyKey || null, fingerprint, changeSegment]);
      await event(tx, id, actor.id, original ? 'reschedule_requested' : 'submitted', note);
      await notify(tx, actor.manager_id, id, 'new_request', `${id}:new_request`, `${actor.name} requested ${totalDays(segments)} days of leave${original ? ' with changed dates' : ''}, starting ${segments[0].start}.`);
      return { id };
    }),
    review: (actorId, id, body) => db.transaction(async tx => {
      const { actor, people, requests } = await context(tx, actorId);
      const request = requests.find(r => r.id === id);
      if (!request) fail('Request not found.', 404);
      const employee = people.find(p => p.id === request.employee_id);
      if (actor.role !== 'manager' || employee.manager_id !== actor.id || employee.id === actor.id) fail('Only the assigned manager can review this request.', 403);
      if (!['approved', 'rejected'].includes(body.status)) fail('Choose approve or reject.');
      const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
      if (!comment || comment.length > 1000) fail('Add a review comment of 1 to 1,000 characters.');
      if (request.status === body.status && request.reviewed_by === actor.id && request.comment === comment) return { id };
      if (request.status !== 'pending') fail('This request is no longer awaiting review.', 409);
      if (body.status === 'approved') {
        const returnChange = request.change_segment !== null;
        const { original } = prepare(employee, requests, { segments: request.segments, replacesId: request.replaces_id, ...(returnChange ? { returnDate: addDays(request.segments[request.change_segment].end, 1), segmentIndex: request.change_segment } : {}) }, request.id);
        if (original) { await tx.query("UPDATE leave_requests SET status='superseded' WHERE id=$1", [original.id]); await event(tx, original.id, actor.id, 'rescheduled', comment); }
      }
      await tx.query('UPDATE leave_requests SET status=$1,comment=$2,reviewed_by=$3 WHERE id=$4', [body.status, comment, actor.id, id]);
      await event(tx, id, actor.id, body.status, comment);
      await notify(tx, employee.id, id, 'decision', `${id}:decision`, `Your leave request was ${body.status} by ${actor.name}. ${comment}`);
      return { id };
    }),
    cancel: (actorId, id) => db.transaction(async tx => {
      const { actor, requests } = await context(tx, actorId);
      const r = requests.find(r => r.id === id);
      if (!r) fail('Request not found.', 404);
      if (r.employee_id !== actor.id) fail('You can only cancel your own leave.', 403);
      if (['cancelled', 'withdrawn'].includes(r.status)) return { id };
      if (!['pending', 'approved'].includes(r.status) || r.segments.every(s => s.end < today())) fail('Completed leave cannot be cancelled.');
      const status = r.status === 'pending' ? 'withdrawn' : 'cancelled';
      const consumed = r.status === 'approved' ? r.segments.filter(s => s.start <= today()).map(s => ({ start: s.start, end: s.end < today() ? s.end : today() })) : [];
      await tx.query('UPDATE leave_requests SET status=$1,charged_segments=$2::jsonb WHERE id=$3', [status, JSON.stringify(consumed), id]);
      await event(tx, id, actor.id, status, `${totalDays(consumed)} used days retained; unused days released.`);
      for (const child of requests.filter(child => child.replaces_id === id && child.status === 'pending')) {
        await tx.query("UPDATE leave_requests SET status='withdrawn' WHERE id=$1", [child.id]);
        await event(tx, child.id, actor.id, 'withdrawn', 'Original leave cancelled.');
      }
      return { id, retainedDays: totalDays(consumed), returnedDays: totalDays(r.segments) - totalDays(consumed) };
    }),
    readNotification: (actorId, id) => db.transaction(async tx => {
      await context(tx, actorId);
      if (!/^\d+$/.test(String(id))) fail('Notification not found.', 404);
      const result = await tx.query('UPDATE notifications SET read_at=COALESCE(read_at,$1) WHERE id=$2 AND recipient_id=$3 RETURNING id', [new Date().toISOString(), id, actorId]);
      if (!result.rows.length) fail('Notification not found.', 404);
      await touch(tx);
      return { id };
    }),
  };
}
