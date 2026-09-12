import { openDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { todayIn } from './policy.js';
import { createApp } from './app.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE === 'false') {
  throw new Error('This draft uses demo identities. Add real authentication before running in production.');
}
const db = await openDatabase();
await seedDatabase(db, todayIn(process.env.COMPANY_TIMEZONE || 'Asia/Qyzylorda'));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
const server = createApp(db).listen(port, host, () => console.log(`Otpusk API: http://${host}:${port} (${db.kind}, demo workspace)`));
async function shutdown() { server.close(async () => { await db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
