import test from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_CATALOG } from '../src/agent-os/catalog.ts';
import type { AgentTask, ModelGateway } from '../src/agent-os/contracts.ts';
import type { CapabilityHandler } from '../src/agent-os/handlers.ts';
import { createExecutionPlan } from '../src/agent-os/kernel.ts';
import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';
import { AgentRuntime } from '../src/agent-os/orchestrator.ts';
import { buildStandardTools } from '../src/agent-os/standard-tools.ts';
import { ToolRegistry } from '../src/agent-os/tools.ts';
import { createStandardHandlers } from '../src/agents/index.ts';
import { InMemoryAuditLog } from '../src/audit/log.ts';
import { InMemoryContractReadPort } from '../src/connectors/contract/port.ts';
import { MockMaximoReadPort } from '../src/connectors/maximo/mock.ts';
import { DEMO_ASSETS, DEMO_CONTRACT_KPI_SET, DEMO_SCOPE, DEMO_WORK_ORDERS } from '../src/demo.ts';

function task(overrides: Partial<AgentTask> = {}): AgentTask {
  return { taskId: 'T-1', actorId: 'engineer-1', goal: 'demo', capability: 'maintenance-kpi', riskClass: 'operational', actionMode: 'analyse', requestedAt: '2026-09-09T10:00:00Z', ...overrides };
}

function runtime(options: { handlers?: readonly CapabilityHandler[]; model?: ModelGateway | null; baseUrl?: string | null; tools?: ToolRegistry } = {}) {
  const auditLog = new InMemoryAuditLog();
  const memoryStore = new InMemoryMemoryStore();
  const tools = options.tools ?? buildStandardTools({ maximo: new MockMaximoReadPort({ assets: DEMO_ASSETS, workOrders: DEMO_WORK_ORDERS }), contract: new InMemoryContractReadPort([DEMO_CONTRACT_KPI_SET]), memory: memoryStore });
  let tick = 0;
  const rt = new AgentRuntime({ catalog: AGENT_CATALOG, tools, handlers: options.handlers ?? createStandardHandlers(DEMO_SCOPE), auditLog, memoryStore, modelGateway: options.model ?? null, modelPolicy: { baseUrl: options.baseUrl ?? null, remoteApprovedForInternal: false, remoteApprovedForConfidential: false }, now: () => new Date(Date.parse('2026-09-09T10:00:00Z') + (tick++) * 1000).toISOString() });
  return { rt, auditLog, memoryStore };
}

test('kernel escalates a task to the capability minimum risk class', () => {
  const result = createExecutionPlan(task({ capability: 'monthly-report', riskClass: 'routine', actionMode: 'draft' }), AGENT_CATALOG);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.plan.task.riskClass, 'contractual');
    assert.equal(result.plan.policy.approvalRequired, true);
  }
});

test('maintenance KPI run computes the same numbers as the engine, with evidence and an audited tool trail', async () => {
  const { rt, auditLog } = runtime();
  const record = await rt.run(task());
  assert.equal(record.status, 'completed');
  assert.equal(record.agentId, 'maintenance-kpi');
  assert.equal(record.releaseReady, true);
  const value = record.output?.value as { kpis: { id: string; value: number; status: string }[]; workOrderCount: number };
  assert.equal(value.workOrderCount, 6);
  assert.deepEqual(value.kpis.map((k) => [k.id, k.value, k.status]), [['availability', 98.522, 'breach'], ['failures', 4, 'within_target'], ['mtbf', 183.25, 'within_target'], ['mttr', 2.75, 'breach'], ['backlog', 3, 'within_target']]);
  assert.equal(record.output?.evidence.length, 7);
  assert.deepEqual(record.toolCalls.map((c) => c.toolId), ['contract.read', 'maximo.read', 'maximo.read', 'maximo.read']);
  const trail = await auditLog.bySubject('run', record.runId);
  assert.deepEqual(trail.map((e) => e.action), ['agent.run_started', 'tool.called', 'tool.called', 'tool.called', 'tool.called', 'agent.run_completed']);
  assert.deepEqual(await auditLog.verifyChain(), { valid: true });
});

test('a handler cannot reach a tool outside its plan; the violation is audited and the run fails closed', async () => {
  const rogue: CapabilityHandler = { capability: 'finance-context', execute: async (ctx) => { await ctx.tools.call('maximo.read', { kind: 'asset', assetId: 'ATC-ZC-01' }); return { value: 1, evidence: [], assumptions: [] }; } };
  const { rt, auditLog } = runtime({ handlers: [rogue] });
  const record = await rt.run(task({ capability: 'finance-context', riskClass: 'routine' }));
  assert.equal(record.status, 'failed');
  assert.match(record.reason, /Tool boundary violation/);
  assert.equal(record.toolCalls.length, 0);
  const trail = await auditLog.bySubject('run', record.runId);
  assert.equal(trail[trail.length - 1]?.action, 'agent.run_failed');
});

test('output without decision-grade evidence is discarded', async () => {
  const hollow: CapabilityHandler = { capability: 'maintenance-kpi', execute: async () => ({ value: 'availability is fine', evidence: [], assumptions: [] }) };
  const { rt } = runtime({ handlers: [hollow] });
  const record = await rt.run(task());
  assert.equal(record.status, 'failed');
  assert.equal(record.output, null);
  assert.match(record.reason, /without decision-grade evidence/);
});

test('blocked action modes never reach a handler', async () => {
  let executed = false;
  const spy: CapabilityHandler = { capability: 'asset-health', execute: async () => { executed = true; return { value: 1, evidence: [], assumptions: [] }; } };
  const { rt, auditLog } = runtime({ handlers: [spy] });
  const record = await rt.run(task({ capability: 'asset-health', actionMode: 'execute_write' }));
  assert.equal(record.status, 'blocked');
  assert.equal(executed, false);
  assert.equal((await auditLog.all())[0]?.action, 'agent.run_blocked');
});

test('catalog capability without a handler fails closed', async () => {
  const { rt } = runtime({ handlers: [] });
  const record = await rt.run(task({ capability: 'contract-context', riskClass: 'contractual' }));
  assert.equal(record.status, 'failed');
  assert.match(record.reason, /no executable handler/);
});

test('contractual report run is grounded but not release-ready until approved; deterministic narrative without a model', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'monthly-report', riskClass: 'routine', actionMode: 'draft' }));
  assert.equal(record.status, 'completed');
  assert.equal(record.approvalRequired, true);
  assert.equal(record.releaseReady, false);
  assert.equal(record.modelUsed, false);
  const value = record.output?.value as { narrativeSource: string; report: { exceptions: unknown[] } };
  assert.equal(value.narrativeSource, 'deterministic');
  assert.equal(value.report.exceptions.length, 2);
});

test('model is granted only when policy allows: confidential data and a remote endpoint are blocked', async () => {
  const model: ModelGateway = { generate: async () => ({ text: 'Model narrative (interpretation).', model: 'test' }) };
  const remote = runtime({ model, baseUrl: 'https://api.example.com/v1' });
  const blocked = await remote.rt.run(task({ capability: 'monthly-report', actionMode: 'draft' }), { classification: 'confidential' });
  assert.equal(blocked.modelUsed, false);
  assert.ok((await remote.auditLog.all()).some((e) => e.action === 'model.blocked'));

  const local = runtime({ model, baseUrl: 'http://127.0.0.1:8080/v1' });
  const allowed = await local.rt.run(task({ capability: 'monthly-report', actionMode: 'draft' }), { classification: 'confidential' });
  assert.equal(allowed.modelUsed, true);
  assert.equal((allowed.output?.value as { narrative: string }).narrative, 'Model narrative (interpretation).');
  assert.ok((await local.auditLog.all()).some((e) => e.action === 'model.invoked'));
});

test('executive briefing consumes decision memory produced by a governed exception-analysis run', async () => {
  const { rt } = runtime();
  const empty = await rt.run(task({ capability: 'executive-briefing', actionMode: 'draft' }));
  assert.equal(empty.status, 'completed');
  assert.equal((empty.output?.value as { decisions: unknown[] }).decisions.length, 0);

  await rt.run(task({ taskId: 'T-2', capability: 'exception-analysis' }));
  const briefing = await rt.run(task({ taskId: 'T-3', capability: 'executive-briefing', actionMode: 'draft' }));
  const value = briefing.output?.value as { headline: string; decisions: { severity: string; owner: string }[] };
  assert.equal(value.headline, '2 decision(s) required; 1 critical.');
  assert.deepEqual(value.decisions.map((d) => [d.severity, d.owner]), [['critical', 'contract-owner'], ['high', 'maintenance-manager']]);
  assert.deepEqual(briefing.toolCalls.map((c) => c.toolId), ['contract.read', 'memory.read']);
  assert.equal(briefing.approvalRequired, true);
});

test('data quality agent flags the open in-progress failure and missing timestamps', async () => {
  const { rt } = runtime();
  const record = await rt.run(task({ capability: 'data-quality', riskClass: 'routine' }));
  const value = record.output?.value as { findings: { code: string; workOrderId: string | null }[]; provisional: boolean };
  assert.ok(value.findings.some((f) => f.code === 'open_beyond_period' && f.workOrderId === 'WO-1004'));
  assert.equal(value.provisional, false);
});
