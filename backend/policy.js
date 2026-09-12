const DAY = 86400000;
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
export const dayCount = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1;
export const totalDays = segments => segments.reduce((sum, segment) => sum + dayCount(segment.start, segment.end), 0);
export const todayIn = (zone = 'Asia/Qyzylorda') => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export const chargedSegments = request => request.status === 'approved' ? request.segments : request.status === 'cancelled' ? (request.charged_segments || []) : [];

export function accruedDays(start, today) {
  if (start >= today) return 0;
  let result = 0;
  for (let year = Number(start.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
    const yearStart = `${year}-01-01`;
    const nextYear = `${year + 1}-01-01`;
    const from = start > yearStart ? start : yearStart;
    const until = today < nextYear ? today : nextYear;
    if (from < until) result += (dayCount(from, until) - 1) * 28 / (dayCount(yearStart, nextYear) - 1);
  }
  return result;
}
export function normalizeSegments(input, today, startDate, allowStarted = false) {
  if (!Array.isArray(input) || !input.length || input.length > 30) fail('Add between 1 and 30 leave segments.');
  const segments = input.map(s => {
    if (!s || !validDate(s.start) || !validDate(s.end)) fail('Enter valid start and end dates.');
    if (s.end < s.start) fail('The end date must be on or after the start date.');
    if ((!allowStarted && s.start <= today) || s.start < startDate) fail('Leave must start after today and your employment start date.');
    return { start: s.start, end: s.end };
  }).sort((a, b) => a.start.localeCompare(b.start));
  const merged = [];
  for (const s of segments) {
    const last = merged.at(-1);
    if (last && s.start <= last.end) fail('Leave segments cannot overlap.');
    if (last && s.start === addDays(last.end, 1)) last.end = s.end;
    else merged.push(s);
  }
  return merged;
}
export const overlaps = (left, right) => left.some(a => right.some(b => a.start <= b.end && b.start <= a.end));
export function balanceFor(employee, requests, today) {
  const own = requests.filter(r => r.employee_id === employee.id);
  const accrued = accruedDays(employee.start_date, today);
  let used = 0, approved = 0, pending = 0;
  for (const r of own) {
    if (['approved', 'cancelled'].includes(r.status)) {
      for (const s of chargedSegments(r)) {
        if (s.start < today) used += dayCount(s.start, s.end < today ? s.end : addDays(today, -1));
        if (s.end >= today) approved += dayCount(s.start > today ? s.start : today, s.end);
      }
    }
    if (r.status === 'pending') {
      const original = own.find(o => o.id === r.replaces_id && o.status === 'approved');
      pending += Math.max(0, totalDays(r.segments) - (original ? totalDays(original.segments) : 0));
    }
  }
  const net = accrued - used - approved - pending;
  return { accrued, used, approved, pending, available: Math.max(0, net), net, futureFunding: Math.max(0, -net), entitlement: 28 };
}

// Each entire request must be funded at its first segment, not by its last day.
// A pending replacement reserves the larger cumulative cost of either schedule.
export function obligations(requests) {
  const result = [];
  const processed = new Set();
  for (const r of requests.filter(r => ['approved', 'cancelled'].includes(r.status))) {
    const segments = chargedSegments(r);
    const replacement = r.status === 'approved' && requests.find(p => p.status === 'pending' && p.replaces_id === r.id);
    if (replacement) processed.add(replacement.id);
    const alternatives = [segments, ...(replacement ? [replacement.segments] : [])].filter(s => s.length);
    let committed = 0;
    for (const date of [...new Set(alternatives.map(s => s[0].start))].sort()) {
      const next = Math.max(...alternatives.filter(s => s[0].start <= date).map(totalDays));
      result.push({ date, days: next - committed });
      committed = next;
    }
  }
  for (const r of requests.filter(r => r.status === 'pending' && !processed.has(r.id))) result.push({ date: r.segments[0].start, days: totalDays(r.segments) });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function validateFunding(employee, requests) {
  const costs = obligations(requests.filter(r => r.employee_id === employee.id));
  let spent = 0;
  for (const date of [...new Set(costs.map(c => c.date))]) {
    spent += costs.filter(c => c.date === date).reduce((sum, c) => sum + c.days, 0);
    const earned = accruedDays(employee.start_date, date);
    if (spent > earned + 1e-9) fail(`Not enough accrued leave by ${date}: ${earned.toFixed(2)} days earned, but ${spent} days committed. Choose later dates or fewer days.`);
  }
}
