import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { ActionMode, AgentTask, HumanApproval, RiskClass } from '../agent-os/contracts.ts';
import { createExecutionPlan } from '../agent-os/kernel.ts';
import type { MemoryStore } from '../agent-os/memory.ts';
import type { AuditLog } from '../audit/log.ts';
import { reportReadiness, transitionReport, type ReportTransition } from '../reporting/approval.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import type { ReportStore } from '../reporting/store.ts';

/**
 * Local decision API. It mutates RailMind-owned state only (report status,
 * audit trail, memory). It never writes to Maximo, finance or contract
 * systems. P0 has no authentication: the named actor is supplied by the
 * caller and recorded as given. Authentication and RBAC are release gates
 * before any live data (see docs/P0_IMPLEMENTATION_STATUS.md).
 */
export interface ApiDependencies {
  reportStore: ReportStore;
  auditLog: AuditLog;
  memoryStore: MemoryStore;
  /** Seed report restored by `reset` and used when the store is empty. */
  seedReport: ReportPackage;
  now?: () => string;
  persistence: 'in-memory' | 'postgres';
}

/** Structural subset of Node's IncomingMessage/ServerResponse so src/ stays runtime-neutral. */
export interface ApiRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  url?: string;
}

export interface ApiResponse {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: string): unknown;
}

export interface ApiHandler {
  (req: ApiRequest, res: ApiResponse): Promise<boolean>;
}

const MAX_BODY_BYTES = 64 * 1024;
const RISK_CLASSES: readonly RiskClass[] = ['routine', 'operational', 'contractual', 'financial', 'safety_critical'];
const ACTION_MODES: readonly ActionMode[] = ['read', 'analyse', 'draft', 'propose_write', 'execute_write', 'control'];

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ApiResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: ApiRequest): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder();
  let text = '';
  for await (const chunk of req) {
    text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large.');
  }
  text += decoder.decode();
  if (text.trim().length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new HttpError(400, 'Body must be a JSON object.');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Body is not valid JSON.');
  }
}

function str(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function buildTransition(body: Record<string, unknown>, now: string): ReportTransition {
  const type = str(body, 'type');
  const actorId = str(body, 'actorId') ?? '';
  const actorRole = str(body, 'actorRole');
  const at = str(body, 'at') ?? now;
  const note = str(body, 'note');
  switch (type) {
    case 'submit_for_review':
      return { type, actorId, actorRole, at };
    case 'lock':
      return { type, actorId, actorRole, at };
    case 'approve':
    case 'reject': {
      const approval: HumanApproval = {
        reviewerId: actorId,
        reviewerRole: actorRole ?? '',
        decision: type === 'approve' ? 'approved' : 'rejected',
        at,
        note,
      };
      return { type, approval };
    }
    default:
      throw new HttpError(400, 'Unknown transition type. Use submit_for_review, approve, reject or lock.');
  }
}

function buildTask(body: Record<string, unknown>, now: string): AgentTask {
  const capability = str(body, 'capability');
  const actorId = str(body, 'actorId');
  const goal = str(body, 'goal');
  const riskClass = str(body, 'riskClass') as RiskClass | undefined;
  const actionMode = str(body, 'actionMode') as ActionMode | undefined;
  if (!capability || !actorId || !goal) throw new HttpError(400, 'capability, actorId and goal are required.');
  if (!riskClass || !RISK_CLASSES.includes(riskClass)) throw new HttpError(400, `riskClass must be one of ${RISK_CLASSES.join(', ')}.`);
  if (!actionMode || !ACTION_MODES.includes(actionMode)) throw new HttpError(400, `actionMode must be one of ${ACTION_MODES.join(', ')}.`);
  return {
    taskId: str(body, 'taskId') ?? `T-${Date.parse(now).toString(36).toUpperCase()}`,
    actorId,
    goal,
    capability,
    riskClass,
    actionMode,
    requestedAt: now,
  };
}

export function createApiHandler(deps: ApiDependencies): ApiHandler {
  const now = deps.now ?? (() => new Date().toISOString());

  async function currentReport(): Promise<ReportPackage> {
    const stored = await deps.reportStore.get(deps.seedReport.reportId);
    if (stored) return stored;
    await deps.reportStore.save(deps.seedReport);
    return deps.seedReport;
  }

  async function reportView(): Promise<unknown> {
    const report = await currentReport();
    const audit = await deps.auditLog.bySubject('report', report.reportId);
    return { report, readiness: reportReadiness(report), audit, persistence: deps.persistence };
  }

  async function route(method: string, path: string, req: ApiRequest): Promise<{ status: number; body: unknown }> {
    if (method === 'GET' && path === '/api/health') {
      return { status: 200, body: { service: 'Project 44 RailMind Agent OS', status: 'ok', mode: 'p0-demo', persistence: deps.persistence } };
    }
    if (method === 'GET' && path === '/api/report') {
      return { status: 200, body: await reportView() };
    }
    if (method === 'GET' && path === '/api/audit') {
      const events = await deps.auditLog.all();
      return { status: 200, body: { events, chain: await deps.auditLog.verifyChain(), persistence: deps.persistence } };
    }
    if (method === 'GET' && path === '/api/agents') {
      return { status: 200, body: { agents: AGENT_CATALOG } };
    }
    if (method === 'POST' && path === '/api/report/transition') {
      const body = await readJson(req);
      const transition = buildTransition(body, now());
      const report = await currentReport();
      const result = transitionReport(report, transition);
      const audit = await deps.auditLog.append(result.audit);
      if (result.ok) await deps.reportStore.save(result.report);
      return {
        status: result.ok ? 200 : 409,
        body: { ok: result.ok, blockers: result.blockers, audit, report: result.report, readiness: reportReadiness(result.report) },
      };
    }
    if (method === 'POST' && path === '/api/report/reset') {
      const body = await readJson(req);
      const actorId = str(body, 'actorId');
      if (!actorId) throw new HttpError(400, 'actorId is required.');
      const previous = await currentReport();
      await deps.reportStore.save(deps.seedReport);
      const audit = await deps.auditLog.append({
        action: 'report.reset',
        actorId,
        actorRole: str(body, 'actorRole'),
        subjectType: 'report',
        subjectId: deps.seedReport.reportId,
        at: now(),
        fromState: previous.status,
        toState: deps.seedReport.status,
        reason: 'Demo package restored to its seed state.',
      });
      return { status: 200, body: { ok: true, audit, report: deps.seedReport, readiness: reportReadiness(deps.seedReport) } };
    }
    if (method === 'POST' && path === '/api/agent/task') {
      const body = await readJson(req);
      const task = buildTask(body, now());
      const planning = createExecutionPlan(task, AGENT_CATALOG);
      const audit = await deps.auditLog.append({
        action: planning.ok ? 'agent.run_planned' : 'agent.run_blocked',
        actorId: task.actorId,
        subjectType: 'task',
        subjectId: task.taskId,
        at: task.requestedAt,
        toState: planning.ok ? planning.plan.agent.id : undefined,
        reason: planning.ok ? `${task.capability} via ${planning.plan.agent.id}: ${planning.plan.policy.reason}` : `${planning.reason}: ${planning.detail}`,
      });
      await deps.memoryStore.append({
        id: `MEM-${audit.sequence}`,
        kind: 'episodic',
        taskId: task.taskId,
        subject: planning.ok ? `Planned ${task.capability}` : `Blocked ${task.capability}`,
        content: audit.reason ?? '',
        createdAt: task.requestedAt,
        evidence: [],
        tags: [task.capability, task.actionMode, task.riskClass],
      });
      return { status: planning.ok ? 200 : 403, body: { ...planning, task, audit } };
    }
    if (path.startsWith('/api/')) throw new HttpError(404, 'Unknown API route.');
    return { status: 0, body: null };
  }

  return async (req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    if (!path.startsWith('/api/')) return false;
    try {
      const result = await route(req.method ?? 'GET', path, req);
      send(res, result.status, result.body);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      send(res, status, { error: error instanceof Error ? error.message : 'Unexpected error.' });
    }
    return true;
  };
}
