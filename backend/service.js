import { randomUUID } from 'node:crypto';
import { balanceFor, fail, normalizeSegments, overlaps, todayIn, totalDays } from './policy.js';

export function createService(db, { today = () => todayIn(process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda') } = {}) {
  const rows = async tx => (await tx.query('SELECT * FROM leave_requests ORDER BY created_at DESC, id')).rows;
  const employees = async tx => (await tx.query('SELECT * FROM employees ORDER BY name')).rows;
  const event = (tx, id, actor, action, comment = '') => tx.query('INSERT INTO request_events (request_id,actor_id,action,comment,created_at) VALUES ($1,$2,$3,$4,$5)', [id, actor, action, comment, new Date().toISOString()]);
  async function expire(tx) {
    const requests = await rows(tx);
    for (const r of requests.filter(r => r.status === 'pending')) {
      const original = requests.find(o => o.id === r.replaces_id);
      if (r.segments[0].start <= today() || (original && (original.status !== 'approved' || original.segments[0].start <= today()))) {
        await tx.query("UPDATE leave_requests SET status='expired' WHERE id=$1", [r.id]);
        await event(tx, r.id, null, 'expired');
      }
    }
  }
  async function context(tx, actorId) {
    await expire(tx);
    const people = await employees(tx);
    const actor = people.find(p => p.id === actorId);
    if (!actor) fail('Choose a demo account to continue.', 401);
    return { actor, people, requests: await rows(tx) };
  }
  async function validate(tx, employee, requests, segments, original, excluding) {
    const blocking = requests.filter(r => r.employee_id === employee.id && ['pending', 'approved'].includes(r.status) && r.id !== original?.id && r.id !== excluding);
    if (blocking.some(r => overlaps(segments, r.segments))) fail('These dates overlap an existing leave request.');
    const balance = balanceFor(employee, requests.filter(r => r.id !== excluding), today());
    const needed = Math.max(0, totalDays(segments) - (original ? totalDays(original.segments) : 0));
    if (needed > balance.available + 1e-9) fail(`Not enough available leave. You have ${Math.max(0, balance.available).toFixed(2)} days available.`);
  }
  return {
    accounts: async () => (await employees(db)).map(({ id, name, role, color }) => ({ id, name, role, color })),
    snapshot: actorId => db.transaction(async tx => {
      const { actor, people, requests } = await context(tx, actorId);
      const canRead = r => r.employee_id === actor.id || actor.role === 'hr' || (actor.role === 'manager' && people.find(p => p.id === r.employee_id)?.manager_id === actor.id);
      const visible = requests.filter(canRead);
      const directory = people.filter(p => actor.role === 'hr' || p.team === actor.team || p.id === actor.manager_id || p.manager_id === actor.id).map(p => {
        const own = p.id === actor.id;
        const full = own || actor.role === 'hr' || (actor.role === 'manager' && p.manager_id === actor.id);
        return full ? { ...p, balance: balanceFor(p, requests, today()) } : { id: p.id, name: p.name, team: p.team, color: p.color, title: p.title };
      });
      const calendar = requests.filter(r => r.status === 'approved' && (actor.role === 'hr' || people.find(p => p.id === r.employee_id)?.team === actor.team)).map(({ id, employee_id, segments }) => ({ id, employee_id, segments }));
      const history = (await tx.query('SELECT * FROM request_events ORDER BY created_at DESC')).rows.filter(e => visible.some(r => r.id === e.request_id));
      return { today: today(), company: { name: 'Forma Studio', timezone: process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda' }, user: actor, people: directory, requests: visible, calendar, history, balance: balanceFor(actor, requests, today()), demo: true };
    }),
    create: (actorId, body) => db.transaction(async tx => {
      const { actor, people, requests } = await context(tx, actorId);
      if (!people.some(p => p.id === actor.manager_id && p.id !== actor.id && p.role === 'manager')) fail('An eligible manager must be assigned before you can request leave.');
      const segments = normalizeSegments(body.segments, today(), actor.start_date);
      let original;
      if (body.replacesId) {
        original = requests.find(r => r.id === body.replacesId && r.employee_id === actor.id);
        if (!original || original.status !== 'approved' || original.segments[0].start <= today()) fail('Only upcoming approved leave can be rescheduled.');
        if (requests.some(r => r.replaces_id === original.id && r.status === 'pending')) fail('A schedule change is already awaiting review.');
      }
      await validate(tx, actor, requests, segments, original);
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length > 1000) fail('Keep your note to 1,000 characters.');
      const id = randomUUID();
      await tx.query("INSERT INTO leave_requests (id,employee_id,status,segments,note,replaces_id,created_at) VALUES ($1,$2,'pending',$3::jsonb,$4,$5,$6)", [id, actor.id, JSON.stringify(segments), note, original?.id || null, new Date().toISOString()]);
      await event(tx, id, actor.id, original ? 'reschedule_requested' : 'submitted', note);
      return { id };
    }),
    review: (actorId, id, body) => db.transaction(async tx => {
      const { actor, people, requests } = await context(tx, actorId);
      const request = requests.find(r => r.id === id);
      if (!request) fail('Request not found.', 404);
      const employee = people.find(p => p.id === request.employee_id);
      if (actor.role !== 'manager' || employee.manager_id !== actor.id || employee.id === actor.id) fail('Only the assigned manager can review this request.', 403);
      if (request.status !== 'pending') fail('This request is no longer awaiting review.', 409);
      if (!['approved', 'rejected'].includes(body.status)) fail('Choose approve or reject.');
      const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
      if (!comment || comment.length > 1000) fail('Add a review comment of 1 to 1,000 characters.');
      if (body.status === 'approved') {
        const original = requests.find(r => r.id === request.replaces_id);
        normalizeSegments(request.segments, today(), employee.start_date);
        if (original && (original.status !== 'approved' || original.segments[0].start <= today())) fail('The original leave can no longer be changed.');
        await validate(tx, employee, requests, request.segments, original, request.id);
        if (original) { await tx.query("UPDATE leave_requests SET status='superseded' WHERE id=$1", [original.id]); await event(tx, original.id, actor.id, 'rescheduled', comment); }
      }
      await tx.query('UPDATE leave_requests SET status=$1,comment=$2,reviewed_by=$3 WHERE id=$4', [body.status, comment, actor.id, id]);
      await event(tx, id, actor.id, body.status, comment);
      return { id };
    }),
    cancel: (actorId, id) => db.transaction(async tx => {
      const { actor, requests } = await context(tx, actorId);
      const r = requests.find(r => r.id === id);
      if (!r) fail('Request not found.', 404);
      if (r.employee_id !== actor.id) fail('You can only cancel your own leave.', 403);
      if (!['pending', 'approved'].includes(r.status) || r.segments[0].start <= today()) fail('Only pending or approved leave that has not started can be cancelled.');
      const status = r.status === 'pending' ? 'withdrawn' : 'cancelled';
      await tx.query('UPDATE leave_requests SET status=$1 WHERE id=$2', [status, id]);
      await event(tx, id, actor.id, status);
      for (const child of requests.filter(child => child.replaces_id === id && child.status === 'pending')) {
        await tx.query("UPDATE leave_requests SET status='withdrawn' WHERE id=$1", [child.id]);
        await event(tx, child.id, actor.id, 'withdrawn', 'Original leave cancelled.');
      }
      return { id };
    }),
  };
}
