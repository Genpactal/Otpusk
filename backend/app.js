import express from 'express';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createService } from './service.js';

export function createApp(db, options) {
  const app = express();
  const service = createService(db, options);
  app.locals.service = service;
  const streams = new Set();
  app.locals.closeStreams = () => { for (const close of streams) close(); };
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  const actor = req => req.get('X-Demo-User');
  app.get('/api/health', (req, res) => res.json({ status: 'ok', database: db.kind, demo: true }));
  app.get('/api/accounts', async (req, res) => res.json(await service.accounts()));
  app.get('/api/workspace', async (req, res) => res.json(await service.snapshot(actor(req))));
  app.get('/api/balance', async (req, res) => res.json(await service.forecast(actor(req), req.query.date)));
  app.post('/api/requests/preview', async (req, res) => res.json(await service.preview(actor(req), req.body || {})));
  app.post('/api/notifications/:id/read', async (req, res) => res.json(await service.readNotification(actor(req), req.params.id)));
  app.get('/api/stream', async (req, res) => {
    if (!(await service.accounts()).some(user => user.id === req.query.user)) return res.status(401).json({ error: 'Choose a demo account.' });
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    let previous = '', busy = false, closed = false;
    const tick = async () => {
      if (busy || closed) return;
      busy = true;
      try {
        const revision = await service.revision();
        if (!closed && revision !== previous) { previous = revision; res.write(`event: change\ndata: ${revision}\n\n`); }
        else if (!closed) res.write(': keepalive\n\n');
      } catch { close(); }
      finally { busy = false; }
    };
    const timer = setInterval(tick, options?.streamIntervalMs || 1000);
    const close = () => { closed = true; clearInterval(timer); streams.delete(close); res.end(); };
    streams.add(close);
    req.on('close', close);
    await tick();
  });
  app.post('/api/requests', async (req, res) => res.status(201).json(await service.create(actor(req), req.body || {})));
  app.post('/api/requests/:id/review', async (req, res) => res.json(await service.review(actor(req), req.params.id, req.body || {})));
  app.post('/api/requests/:id/cancel', async (req, res) => res.json(await service.cancel(actor(req), req.params.id)));
  app.get('/api/decision-log', async (req, res) => {
    res.attachment('Otpusk-Decision-Journal.md').type('text/markdown').send(await readFile(new URL('../DECISION_LOG.md', import.meta.url), 'utf8'));
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  const frontend = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
  app.use(express.static(frontend));
  app.get('/{*path}', (req, res) => res.sendFile(`${frontend}/index.html`));
  app.use((error, req, res, next) => {
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}
