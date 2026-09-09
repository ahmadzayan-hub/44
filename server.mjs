import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { InMemoryMemoryStore } from './src/agent-os/memory.ts';
import { createApiHandler } from './src/api/router.ts';
import { InMemoryAuditLog } from './src/audit/log.ts';
import { DEMO_REPORT } from './src/demo.ts';
import { InMemoryReportStore } from './src/reporting/store.ts';

const port = Number(process.env.PORT ?? 4173);
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

/**
 * Persistence is selected by environment. Without DATABASE_URL everything is
 * in memory and resets on restart. With DATABASE_URL the PostgreSQL adapters
 * are used through the same interfaces (optional `pg` driver required).
 */
async function buildDependencies() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { reportStore: new InMemoryReportStore(), auditLog: new InMemoryAuditLog(), memoryStore: new InMemoryMemoryStore(), seedReport: DEMO_REPORT, persistence: 'in-memory' };
  }
  const { createPgDatabase } = await import('./src/persistence/pg-database.ts');
  const { PgAuditLog, PgMemoryStore, PgReportStore, ensureSchema } = await import('./src/persistence/postgres.ts');
  const db = await createPgDatabase(connectionString);
  await ensureSchema(db);
  return { reportStore: new PgReportStore(db), auditLog: new PgAuditLog(db), memoryStore: new PgMemoryStore(db), seedReport: DEMO_REPORT, persistence: 'postgres' };
}

const deps = await buildDependencies();
const api = createApiHandler(deps);

createServer(async (req, res) => {
  if (await api(req, res)) return;
  const raw = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const safe = normalize(raw).replace(/^(\.\.(\/|\\|$))+/, '');
  let file = join(root, safe === '/' ? 'index.html' : safe);
  if (!file.startsWith(root)) file = join(root, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  const type = types[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '0.0.0.0', () => console.log(`RailMind Agent OS preview: http://localhost:${port} (persistence: ${deps.persistence})`));
