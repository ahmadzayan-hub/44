import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';
import { createApiHandler } from '../src/api/router.ts';
import { InMemoryAuditLog } from '../src/audit/log.ts';
import { DEMO_REPORT } from '../src/demo.ts';
import { InMemoryReportStore } from '../src/reporting/store.ts';

async function startApi() {
  const auditLog = new InMemoryAuditLog();
  const memoryStore = new InMemoryMemoryStore();
  const handler = createApiHandler({ reportStore: new InMemoryReportStore(), auditLog, memoryStore, seedReport: DEMO_REPORT, persistence: 'in-memory', now: () => '2026-09-09T12:00:00Z' });
  const server = createServer(async (req, res) => {
    if (await handler(req, res)) return;
    res.writeHead(404); res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
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
    const submitted = await api.call('POST', '/api/report/transition', { type: 'submit_for_review', actorId: 'engineer-1', actorRole: 'Reliability Engineer' });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.json.report.status, 'under_review');

    const refused = await api.call('POST', '/api/report/transition', { type: 'approve', actorId: 'mgr-1', actorRole: 'Manager' });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.ok, false);
    assert.match(refused.json.blockers.join(' '), /critical exception/);

    const approved = await api.call('POST', '/api/report/transition', { type: 'approve', actorId: 'mgr-1', actorRole: 'Manager', note: 'Mitigation reviewed.' });
    assert.equal(approved.json.report.status, 'approved');
    assert.equal(approved.json.report.approval.reviewerId, 'mgr-1');

    const locked = await api.call('POST', '/api/report/transition', { type: 'lock', actorId: 'engineer-1' });
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

test('API refuses anonymous transitions and malformed bodies without touching the report', async () => {
  const api = await startApi();
  try {
    const anonymous = await api.call('POST', '/api/report/transition', { type: 'submit_for_review' });
    assert.equal(anonymous.status, 409);
    assert.match(anonymous.json.blockers.join(' '), /actor is required/);
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
    const blocked = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', actorId: 'engineer-1', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'execute_write' });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.ok, false);
    assert.equal(blocked.json.audit.action, 'agent.run_blocked');

    const planned = await api.call('POST', '/api/agent/task', { capability: 'maintenance-kpi', actorId: 'engineer-1', goal: 'Explain MTTR', riskClass: 'operational', actionMode: 'analyse' });
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
    const reset = await api.call('POST', '/api/report/reset', { actorId: 'engineer-1' });
    assert.equal(reset.json.report.status, 'draft');
    assert.equal(reset.json.audit.action, 'report.reset');
    assert.equal(reset.json.audit.fromState, 'under_review');
    const denied = await api.call('POST', '/api/report/reset', {});
    assert.equal(denied.status, 400);
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
    const health = await (await fetch(`${base}/api/health`)).json() as { capabilities: string[] };
    assert.ok(health.capabilities.includes('maintenance-kpi'));
    const run = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability: 'maintenance-kpi', actorId: 'engineer-1', goal: 'KPIs', riskClass: 'operational', actionMode: 'analyse' }) });
    assert.equal(run.status, 200);
    const record = await run.json() as { status: string; releaseReady: boolean; toolCalls: unknown[]; auditSequences: number[] };
    assert.equal(record.status, 'completed');
    assert.equal(record.releaseReady, true);
    assert.equal(record.toolCalls.length, 4);
    const blocked = await fetch(`${base}/api/agent/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability: 'asset-health', actorId: 'engineer-1', goal: 'x', riskClass: 'operational', actionMode: 'control' }) });
    assert.equal(blocked.status, 403);
    const runs = await (await fetch(`${base}/api/runs`)).json() as { runs: unknown[] };
    assert.equal(runs.runs.length, 2);
    const audit = await (await fetch(`${base}/api/audit`)).json() as { chain: { valid: boolean } };
    assert.equal(audit.chain.valid, true);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await app.close(); }
});
