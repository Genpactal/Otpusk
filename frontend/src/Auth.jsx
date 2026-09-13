import React, { useEffect, useRef, useState } from 'react';
import { Sun, ArrowRight } from 'lucide-react';
import { api } from './api.js';
import { publishSessionChange, subscribeSessionChanges } from './session-sync.js';
import './auth.css';

export function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const authenticating = useRef(false);
  const pendingCheck = useRef(false);
  const checkSession = useRef(null);
  useEffect(() => {
    let active = true;
    async function check() {
      if (authenticating.current) { pendingCheck.current = true; return; }
      const current = ++generation.current;
      try { const value = await api('/auth/session'); if (active && current === generation.current) { setSession(value); setError(''); } }
      catch (error) { if (active && current === generation.current) { if (error.status === 401) setSession(null); else setError(error.message); } }
      finally { if (active && current === generation.current) setChecking(false); }
    }
    checkSession.current = check;
    const expired = () => { generation.current++; setSession(null); setChecking(false); setPassword(''); setError('Your session has ended. Please sign in again.'); };
    const unsubscribe = subscribeSessionChanges(() => {
      // Remove the old workspace and any open forms before adopting the shared login.
      setSession(null); setPassword(''); setChecking(true); check();
    });
    check();
    window.addEventListener('otpusk-session-expired', expired);
    // Reconcile after a suspended tab resumes, even if it missed a storage event.
    window.addEventListener('focus', check);
    return () => { active = false; generation.current++; checkSession.current = null; unsubscribe(); window.removeEventListener('otpusk-session-expired', expired); window.removeEventListener('focus', check); };
  }, []);
  async function login(event) {
    event.preventDefault(); authenticating.current = true; generation.current++; setBusy(true); setError('');
    try { const value = await api('/auth/login', null, { email, password }); generation.current++; setSession(value); setChecking(false); setPassword(''); publishSessionChange(); }
    catch (error) { setError(error.message); }
    finally { authenticating.current = false; setBusy(false); if (pendingCheck.current) { pendingCheck.current = false; checkSession.current?.(); } }
  }
  async function logout() {
    authenticating.current = true; generation.current++;
    try {
      await api('/auth/logout', null, {});
      generation.current++; setSession(null); setChecking(false); setPassword(''); setError(''); publishSessionChange();
    } finally { authenticating.current = false; if (pendingCheck.current) { pendingCheck.current = false; checkSession.current?.(); } }
  }
  if (checking) return <main className="startup"><Sun /><p>Opening your workspace…</p></main>;
  if (session) return children(session, logout);
  return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
    <div className="brand"><span className="brand-mark"><Sun size={25} /></span>otpusk<span className="brand-period">.</span></div>
    <span className="eyebrow">YOUR TIME, WELL SPENT</span>
    <h1 id="login-title">Welcome back.</h1><p>Sign in to plan your next break and keep track of your time off.</p>
    <form onSubmit={login}>
      <label htmlFor="login-email">Work email</label><input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
      <label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} /></button>
    </form><p className="login-footnote">Forma Studio · Local draft</p>
  </section></main>;
}
