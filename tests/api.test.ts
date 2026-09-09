import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';
import { createApiHandler } from '../src/api/router.ts';
import { InMemoryAuditLog } from '../src/audit/log.ts';
import { DemoTokenDirectory } from '../src/auth/token-directory.ts';
import { DEMO_REPORT } from '../src/demo.ts';
import { InMemoryReportStore } from '../src/reporting/store.ts';

async function startApi() {
  const auditLog = new InMemoryAuditLog();
  const memoryStore = new InMemoryMemoryStore();
  const handler = createApiHandler({ reportStore: new InMemoryReportStore(), auditLog, memoryStore, seedReport: DEMO_REPORT, persistence: 'in-memory', now: () => '2026-09-09T12:00:00Z', tokenDirectory: new DemoTokenDirectory() });
  const server = createServer(async (req, res) => {
    if (await handler(req, res)) return;
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown, token: string | null = 'demo-admin') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() as Record<string, any> };
  };
  return { call, auditLog, memoryStore, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test('API serves the seeded report with readiness and an empty audit trail', async () => {
  const api = await startApi();
  try {
    const health = await api.call('GET', '/api/health');
    assert.equal(health.json.persistence, 'in-memory');
    const report = await api.call('GET', '/api/report');
    assert.equal(report.status, 200);
    assert.equal(report.json.report.status, 'draft');
    assert.deepEqual(report.json.readiness.nextTransitions, ['submit_for_review']);
    assert.deepEqual(report.json.audit, []);
  } finally { await api.close(); }
});

test('API drives the full approval lifecycle and records a valid audit chain', async () => {
  const api = await startApi();
  try {
    const submitted = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-engineer');
    assert.equal(submitted.status, 200);
    assert.equal(submitted.json.report.status, 'under_review');
    assert.equal(submitted.json.audit.actorId, 'demo.engineer');
    assert.equal(submitted.json.audit.actorRole, 'engineer');

    const engineerApproval = await api.call('POST', '/api/report/transition', { type: 'approve', note: 'x' }, 'demo-engineer');
    assert.equal(engineerApproval.status, 403);

    const refused = await api.call('POST', '/api/report/transition', { type: 'approve' }, 'demo-manager');
    assert.equal(refused.status, 409);
    assert.equal(refused.json.ok, false);
    assert.match(refused.json.blockers.join(' '), /critical exception/);

    const approved = await api.call('POST', '/api/report/transition', { type: 'approve', actorId: 'spoofed', note: 'Mitigation reviewed.' }, 'demo-manager');
    assert.equal(approved.json.report.status, 'approved');
    assert.equal(approved.json.report.approval.reviewerId, 'demo.manager');

    const managerLock = await api.call('POST', '/api/report/transition', { type: 'lock' }, 'demo-manager');
    assert.equal(managerLock.status, 403);
    const locked = await api.call('POST', '/api/report/transition', { type: 'lock' }, 'demo-owner');
    assert.equal(locked.json.report.status, 'locked');
    assert.equal(locked.json.report.lockedAt, '2026-09-09T12:00:00Z');

    const persisted = await api.call('GET', '/api/report');
    assert.equal(persisted.json.report.status, 'locked');
    assert.deepEqual(persisted.json.audit.map((e: { action: string }) => e.action), ['report.submitted_for_review', 'report.transition_refused', 'report.approved', 'report.locked']);

    const audit = await api.call('GET', '/api/audit');
    assert.deepEqual(audit.json.chain, { valid: true });
    assert.equal(audit.json.events[3].previousHash, audit.json.events[2].hash);
  } finally { await api.close(); }
});

test('API refuses unauthenticated, under-privileged and malformed requests without touching the report', async () => {
  const api = await startApi();
  try {
    const anonymous = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, null);
    assert.equal(anonymous.status, 401);
    const badToken = await api.call('GET', '/api/report', undefined, 'not-a-token');
    assert.equal(badToken.status, 401);
    const viewer = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' }, 'demo-viewer');
    assert.equal(viewer.status, 403);
    const denied = (await api.auditLog.all()).find((e) => e.action === 'auth.denied');
    assert.equal(denied?.actorId, 'demo.viewer');
    const unknown = await api.call('POST', '/api/report/transition', { type: 'publish', actorId: 'x' });
    assert.equal(unknown.status, 400);
    const report = await api.call('GET', '/api/report');
    assert.equal(report.json.report.status, 'draft');
    const missing = await api.call('GET', '/api/nothing');
    assert.equal(missing.status, 404);
  } finally { await api.close(); }
});

test('API audits agent planning and blocks unsupported action modes', async () => {
  const api = await startApi();
  try {
    const blocked = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'execute_write' }, 'demo-engineer');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.ok, false);
    assert.equal(blocked.json.audit.action, 'agent.run_blocked');

    const planned = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'analyse' }, 'demo-engineer');
    assert.equal(planned.json.audit.actorId, 'demo.engineer');
    assert.equal(planned.status, 200);
    assert.equal(planned.json.plan.agent.id, 'maintenance-kpi');
    assert.equal(planned.json.audit.action, 'agent.run_planned');

    const invalid = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', actorId: 'engineer-1', goal: 'x', riskClass: 'urgent', actionMode: 'analyse' });
    assert.equal(invalid.status, 400);

    const episodic = await api.memoryStore.byKind('episodic');
    assert.equal(episodic.length, 2);
    assert.deepEqual(await api.auditLog.verifyChain(), { valid: true });
  } finally { await api.close(); }
});

test('API reset restores the seed and is itself audited', async () => {
  const api = await startApi();
  try {
    await api.call('POST', '/api/report/transition', { type: 'submit_for_review', actorId: 'engineer-1' });
    const reset = await api.call('POST', '/api/report/reset', {});
    assert.equal(reset.json.report.status, 'draft');
    assert.equal(reset.json.audit.action, 'report.reset');
    assert.equal(reset.json.audit.fromState, 'under_review');
    assert.equal(reset.json.audit.actorId, 'demo.admin');
    const denied = await api.call('POST', '/api/report/reset', {}, 'demo-owner');
    assert.equal(denied.status, 403);
  } finally { await api.close(); }
});

test('API executes a governed agent run through the composition root and audits it', async () => {
  const { composeApplication } = await import('../src/app/compose.ts');
  const { loadConfig } = await import('../src/config.ts');
  const app = await composeApplication(loadConfig({}), { now: () => '2026-09-09T12:00:00Z' });
  const handler = createApiHandler(app.api);
  const server = createServer(async (req, res) => { if (await handler(req, res)) return; res.writeHead(404); res.end(); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer demo-engineer' };
    const health = await (await fetch(`${base}/api/health`)).json() as { capabilities: string[]; auth: string };
    assert.ok(health.capabilities.includes('maintenance-kpi'));
    assert.equal(health.auth, 'demo');
    const me = await (await fetch(`${base}/api/auth/me`, { headers: auth })).json() as { principal: { principalId: string }; permissions: string[] };
    assert.equal(me.principal.principalId, 'demo.engineer');
    assert.ok(me.permissions.includes('agent.run'));
    const run = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: auth, body: JSON.stringify({ capability: 'maintenance-kpi', goal: 'KPIs', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(run.status, 200);
    const record = await run.json() as { status: string; releaseReady: boolean; toolCalls: unknown[]; auditSequences: number[]; task: { actorId: string } };
    assert.equal(record.status, 'completed');
    assert.equal(record.task.actorId, 'demo.engineer');
    assert.equal(record.releaseReady, true);
    assert.equal(record.toolCalls.length, 4);
    const viewerRun = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { ...auth, Authorization: 'Bearer demo-viewer' }, body: JSON.stringify({ capability: 'maintenance-kpi', goal: 'KPIs', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(viewerRun.status, 403);
    const blocked = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: auth, body: JSON.stringify({ capability: 'asset-health', goal: 'x', riskClass: 'operational', actionMode: 'control' }) });
    assert.equal(blocked.status, 403);
    const runs = await (await fetch(`${base}/api/runs`, { headers: auth })).json() as { runs: unknown[] };
    assert.equal(runs.runs.length, 2);
    const audit = await (await fetch(`${base}/api/audit`, { headers: auth })).json() as { chain: { valid: boolean } };
    assert.equal(audit.chain.valid, true);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await app.close(); }
});
