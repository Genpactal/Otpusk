import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, Check, ArrowRight } from 'lucide-react';
import { api } from './api.js';

const add = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const format = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function useRequestPreview(workspace, payload, ready) {
  const [state, setState] = useState({ loading: false });
  const key = JSON.stringify(payload);
  useEffect(() => {
    let active = true;
    if (!ready) { setState({ loading: false }); return; }
    setState({ loading: true });
    const timer = setTimeout(() => {
      api('/requests/preview', workspace.user.id, JSON.parse(key)).then(data => { if (active) setState({ data, loading: false }); }).catch(error => { if (active) setState({ error: error.message, loading: false }); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [key, ready, workspace.user.id, workspace.requests]);
  return state;
}

export function FundingPreview({ state }) {
  return <div className="funding-preview" aria-live="polite">
    {state.loading && <p>Checking accrual and existing commitments…</p>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    {state.data && <><div><span>Accrued by {format(state.data.date)}</span><strong>{state.data.accrued.toFixed(2)} days</strong></div><p><Check size={16} /> Enough accrued days at each vacation’s start date, including existing commitments.</p></>}
  </div>;
}

export function BalanceForecast({ workspace }) {
  const [date, setDate] = useState(add(workspace.today, 30));
  const [state, setState] = useState({});
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    if (!date) { setState({}); return; }
    api(`/balance?date=${encodeURIComponent(date)}`, workspace.user.id).then(data => { if (active) setState({ data }); }).catch(error => { if (active) setState({ error: error.message }); });
    return () => { active = false; };
  }, [date, workspace.user.id, workspace.balance]);
  return <section className="panel forecast-panel"><div className="forecast-heading"><CalendarClock size={22} /><div><h2>Look ahead to your next break</h2><p>Today’s available balance: <strong>{workspace.balance.available.toFixed(2)} days</strong></p></div><label>Project balance to<input aria-label="Project balance to" type="date" min={workspace.today} value={date} onInput={e => setDate(e.target.value)} /></label></div>
    {workspace.balance.futureFunding > 0 && <p className="forecast-note">{workspace.balance.futureFunding.toFixed(2)} reserved days will be funded by future accrual.</p>}
    <div aria-live="polite">{state.loading ? <p className="forecast-note">Calculating your balance…</p> : state.error ? <p className="form-error" role="alert">{state.error}</p> : state.data && <div className="forecast-results"><div><span>Total accrued by selected date</span><strong>{state.data.accrued.toFixed(2)} <small>days</small></strong></div><div><span>Additional days earned from today</span><strong>+{state.data.earnedSinceToday.toFixed(2)} <small>days</small></strong></div><div><span>Available after all reservations</span><strong>{state.data.available.toFixed(2)} <small>days</small></strong></div></div>}</div>
  </section>;
}

export function TeamConflicts({ conflicts = [] }) {
  return <div className={`team-conflicts ${conflicts.length ? 'has-conflicts' : ''}`}>
    <div><AlertTriangle size={18} /><strong>{conflicts.length ? 'Approved team leave overlaps these dates' : 'No approved team leave overlaps these dates'}</strong></div>
    {conflicts.map(conflict => <p key={conflict.requestId}><strong>{conflict.employee}</strong> · {conflict.segments.map(s => `${format(s.start)} – ${format(s.end)}`).join('; ')}</p>)}
    {conflicts.length > 0 && <small>Consider team coverage before approving. Overlap is a warning, not an automatic rejection.</small>}
  </div>;
}

export function Notifications({ workspace, Modal, close, onRead, onOpen }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  return <Modal title="Your notifications" subtitle={`Leave updates and a reminder ${workspace.company.reminderDays} days before your vacation.`} close={close}>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="notifications-list">{!workspace.notifications.length && <div className="empty"><Bell /><h3>You’re all caught up</h3><p>New requests, decisions, and leave reminders will appear here.</p></div>}
      {workspace.notifications.map(n => <article key={n.id} className={n.read_at ? 'is-read' : 'is-unread'}><div><span className="notification-kind">{n.kind === 'new_request' ? 'New leave request' : n.kind === 'decision' ? 'Manager decision' : 'Upcoming leave reminder'}</span><time>{new Date(n.created_at).toLocaleDateString()}</time></div><p>{n.message}</p><div className="notification-actions"><button className="text-button" onClick={() => onOpen(n.request_id)}>View request <ArrowRight size={14} /></button>{!n.read_at && <button className="text-button" disabled={busy === n.id} onClick={async () => { setBusy(n.id); setError(''); try { await onRead(n.id); } catch (error) { setError(error.message); } finally { setBusy(null); } }}>Mark as read</button>}</div></article>)}
    </div>
  </Modal>;
}

export function ReturnDateForm({ workspace, original, Modal, close, submit }) {
  const options = original.segments.map((s, index) => ({ ...s, index })).filter(s => s.end >= workspace.today);
  const [index, setIndex] = useState(options[0]?.index ?? 0);
  const [returnDate, setReturnDate] = useState(add((options[0] || original.segments[0]).end, 1));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const retryKey = useRef(crypto.randomUUID());
  const payload = { replacesId: original.id, segmentIndex: index, returnDate };
  const preview = useRequestPreview(workspace, payload, !!returnDate);
  if (!options.length || original.status !== 'approved') return <Modal title="This leave can no longer be changed" subtitle="The request has finished or its approval status changed. Your workspace is up to date." close={close}><button className="button secondary" onClick={close}>Close</button></Modal>;
  return <Modal title="Change your return-to-work date" subtitle="Your current dates stay approved until your manager accepts the change." close={() => !busy && close()}>
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await submit({ ...payload, idempotencyKey: retryKey.current }); } catch (error) { setError(error.message); setBusy(false); } }}>
      <label className="note-label">Leave segment<select className="return-select" aria-label="Leave segment" value={index} onChange={e => { const next = Number(e.target.value); setIndex(next); setReturnDate(add(original.segments[next].end, 1)); }}>{options.map(s => <option key={s.index} value={s.index}>{format(s.start)} – {format(s.end)}</option>)}</select></label>
      <label className="note-label">First day back<input className="return-date" aria-label="First day back" type="date" required min={workspace.today > original.segments[index].start ? workspace.today : add(original.segments[index].start, 1)} value={returnDate} onInput={e => setReturnDate(e.target.value)} /></label>
      <p className="form-hint">Leave ends the day before this date. Already completed days stay used; remaining days are recalculated after approval.</p>
      {preview.data && <div className="request-summary"><div><span>Revised total leave</span><strong>{preview.data.days} days</strong></div></div>}
      <FundingPreview state={preview} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={close}>Keep my dates</button><button className="button primary" disabled={busy || preview.loading || !preview.data}>{busy ? 'Submitting…' : 'Request return date'}</button></div>
    </form>
  </Modal>;
}
