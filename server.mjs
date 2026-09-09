import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApiHandler } from './src/api/router.ts';
import { composeApplication } from './src/app/compose.ts';
import { describeConfig, loadConfig } from './src/config.ts';

const config = loadConfig(process.env);
const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const securityHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN', 'Cache-Control': 'no-store' };

/** The `pg` driver is loaded here, in the host, so the domain layer never depends on it. */
const overrides = {};
if (config.databaseUrl) {
  const { createPgDatabase } = await import('./src/persistence/pg-database.ts');
  overrides.database = await createPgDatabase(config.databaseUrl);
}
const app = await composeApplication(config, overrides);
const api = createApiHandler(app.api);

const log = (level, message, fields = {}) => console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...fields }));

const server = createServer(async (req, res) => {
  const started = Date.now();
  res.on('finish', () => { if ((req.url ?? '').startsWith('/api/')) log('info', 'request', { method: req.method, path: (req.url ?? '').split('?')[0], status: res.statusCode, ms: Date.now() - started }); });
  if (await api(req, res)) return;
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const safe = normalize(raw).replace(/^[/\\]+/, '').replace(/^(\.\.(\/|\\|$))+/, '');
  let file = join(root, safe === '/' ? 'index.html' : safe);
  if (!file.startsWith(root)) file = join(root, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const type = types[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, ...securityHeaders });
  createReadStream(file).pipe(res);
});

server.listen(config.port, '0.0.0.0', () => log('info', 'RailMind Agent OS started', { url: `http://localhost:${config.port}`, ...describeConfig(config) }));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log('info', 'shutting down', { signal });
    server.close(() => { app.close().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
