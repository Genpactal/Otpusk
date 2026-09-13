import { openDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { todayIn } from './policy.js';
import { createApp } from './app.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE === 'false') {
  throw new Error('This local draft includes published demo credentials and privileged account switching. Production setup is not enabled.');
}
const db = await openDatabase();
await seedDatabase(db, todayIn(process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
const app = createApp(db);
await app.locals.service.runReminders();
let reminderBusy = false;
const reminderTimer = setInterval(async () => {
  if (reminderBusy) return;
  reminderBusy = true;
  try { await app.locals.service.runReminders(); } catch (error) { console.error('Reminder check failed:', error.message); }
  finally { reminderBusy = false; }
}, 60000);
const server = app.listen(port, host, () => console.log(`Otpusk API: http://${host}:${port} (${db.kind}, demo workspace)`));
async function shutdown() { clearInterval(reminderTimer); app.locals.closeStreams(); server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
