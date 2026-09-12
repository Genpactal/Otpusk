import { addDays } from './policy.js';

export async function seedDatabase(db, today) {
  await db.transaction(async tx => {
    if ((await tx.query('SELECT id FROM employees LIMIT 1')).rows.length) return;
    const people = [
      ['mila', 'Mila Thompson', 'Head of design', 'Design', 'manager', null, '#b8a8db', -650],
      ['james', 'James Wilson', 'Engineering lead', 'Engineering', 'manager', 'mila', '#92b4d0', -700],
      ['sophie', 'Sophie Chen', 'People partner', 'People', 'hr', 'mila', '#e1b983', -520],
      ['alex', 'Alex Morgan', 'Product designer', 'Design', 'employee', 'mila', '#bfd2b0', -400],
      ['olivia', 'Olivia Rhye', 'Brand designer', 'Design', 'employee', 'mila', '#ddac9e', -430],
      ['noah', 'Noah Williams', 'UX researcher', 'Design', 'employee', 'mila', '#b8c5dc', -365],
      ['leo', 'Leo Park', 'Frontend engineer', 'Engineering', 'employee', 'james', '#b5cdbb', -480],
      ['emma', 'Emma Davis', 'Backend engineer', 'Engineering', 'employee', 'james', '#d6bd9e', -440],
    ];
    for (const [id, name, title, team, role, manager, color, offset] of people) {
      await tx.query('INSERT INTO employees (id,name,title,email,team,role,start_date,manager_id,color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, name, title, `${id}@studio.example`, team, role, addDays(today, offset), manager, color]);
    }
    const requests = [
      ['seed-alex-upcoming', 'alex', 'approved', 12, 18, 'A little time to recharge.', 'Enjoy your time away!', null],
      ['seed-alex-past', 'alex', 'approved', -45, -41, 'Summer break', 'Approved. Have a great break.', null],
      ['seed-alex-pending', 'alex', 'pending', 38, 40, 'A long weekend with family.', '', null],
      ['seed-olivia', 'olivia', 'approved', -1, 3, 'Family time', 'Enjoy!', null],
      ['seed-noah', 'noah', 'pending', 8, 11, 'A trip to the mountains.', '', null],
      ['seed-leo', 'leo', 'approved', 5, 9, 'Autumn break', 'Approved.', null],
      ['seed-emma', 'emma', 'approved', 16, 22, 'Vacation', 'Approved.', null],
      ['seed-mila', 'mila', 'approved', 26, 29, 'Time off', 'Imported demo record.', null],
    ];
    for (const [id, employee, status, from, until, note, comment, replacement] of requests) {
      await tx.query('INSERT INTO leave_requests (id,employee_id,status,segments,note,comment,replaces_id,created_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)', [id, employee, status, JSON.stringify([{ start: addDays(today, from), end: addDays(today, until) }]), note, comment, replacement, `${addDays(today, -7)}T10:00:00.000Z`]);
      await tx.query('INSERT INTO request_events (request_id,actor_id,action,comment,created_at) VALUES ($1,$2,$3,$4,$5)', [id, employee, 'imported', 'Sample request for the draft workspace.', `${addDays(today, -7)}T10:00:00.000Z`]);
    }
  });
}
