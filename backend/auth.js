import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
const COOKIE = 'otpusk_session';
const LIFETIME = 8 * 60 * 60 * 1000;
export const canSwitch = user => ['manager', 'hr'].includes(user.role);
const publicUser = ({ id, name, role, color }) => ({ id, name, role, color });

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}

export async function seedDemoCredentials(db) {
  // Only provision the known fictional accounts; never overwrite an existing password.
  for (const id of ['alex', 'olivia', 'noah', 'leo', 'emma', 'mila', 'james', 'sophie']) {
    const result = await db.query('SELECT id FROM employees WHERE id=$1 AND email=$2 AND NOT EXISTS (SELECT 1 FROM account_credentials WHERE employee_id=$1)', [id, `${id}@studio.example`]);
    if (result.rows.length) await db.query('INSERT INTO account_credentials (employee_id,password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, await hashPassword(`Otpusk-${id}-2026!`)]);
  }
}

export function createAuth(db) {
  const attempts = new Map();
  const tokenFrom = req => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const cookieOptions = req => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/' });
  return {
    async login(req, res) {
      const now = Date.now();
      for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
      const key = req.ip;
      const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
      if (entry.count >= 10) fail('Too many sign-in attempts. Try again in 15 minutes.', 429);
      entry.count++; attempts.set(key, entry);
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 256) fail('Email or password is incorrect.', 401);
      const user = (await db.query('SELECT e.id,e.name,e.role,e.color,c.password_hash FROM employees e JOIN account_credentials c ON c.employee_id=e.id WHERE lower(e.email)=$1', [email.trim().toLowerCase()])).rows[0];
      const [salt, expected] = (user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
      const actual = await scrypt(password, salt, 64);
      if (!user || !timingSafeEqual(actual, Buffer.from(expected, 'hex'))) fail('Email or password is incorrect.', 401);
      attempts.delete(key);
      const token = randomBytes(32).toString('hex');
      await db.transaction(async tx => {
        const old = tokenFrom(req);
        if (old) await tx.query('DELETE FROM account_sessions WHERE token_hash=$1', [digest(old)]);
        await tx.query('DELETE FROM account_sessions WHERE expires_at <= $1', [now]);
        await tx.query('INSERT INTO account_sessions (token_hash,employee_id,expires_at) VALUES ($1,$2,$3)', [digest(token), user.id, now + LIFETIME]);
      });
      res.cookie(COOKIE, token, { ...cookieOptions(req), maxAge: LIFETIME });
      return { user: publicUser(user), canSwitch: canSwitch(user) };
    },
    async authenticate(req) {
      const token = tokenFrom(req);
      if (!token || !/^[a-f0-9]{64}$/.test(token)) fail('Please sign in to continue.', 401);
      const user = (await db.query('SELECT e.id,e.name,e.role,e.color FROM account_sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token_hash=$1 AND s.expires_at>$2', [digest(token), Date.now()])).rows[0];
      if (!user) fail('Your session has expired. Please sign in again.', 401);
      return user;
    },
    async logout(req, res) {
      const token = tokenFrom(req);
      if (token) await db.query('DELETE FROM account_sessions WHERE token_hash=$1', [digest(token)]);
      res.clearCookie(COOKIE, cookieOptions(req));
      return { ok: true };
    },
    async actor(req, principal) {
      const target = req.get('X-Account-Id') || (req.originalUrl.split('?')[0] === '/api/stream' ? req.query.user : null) || principal.id;
      if (typeof target !== 'string') fail('Invalid account.', 400);
      if (target !== principal.id && !canSwitch(principal)) fail('Employees can only access their own account.', 403);
      if (!(await db.query('SELECT id FROM employees WHERE id=$1', [target])).rows.length) fail('Account not found.', 404);
      return target;
    },
  };
}
