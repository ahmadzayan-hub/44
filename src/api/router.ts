import { AGENT_CATALOG } from '../agent-os/catalog.ts';
import type { ActionMode, AgentTask, DataClassification, HumanApproval, RiskClass } from '../agent-os/contracts.ts';
import { createExecutionPlan } from '../agent-os/kernel.ts';
import type { MemoryStore } from '../agent-os/memory.ts';
import type { AgentRuntime } from '../agent-os/orchestrator.ts';
import { TRANSITION_PERMISSION, hasPermission, permissionsOf, type Permission, type Principal } from '../auth/principal.ts';
import type { TokenDirectory } from '../auth/token-directory.ts';
import { securityHeaders } from '../http/security-headers.ts';
import type { AuditLog } from '../audit/log.ts';
import { reportReadiness, transitionReport, type ReportTransition } from '../reporting/approval.ts';
import type { ReportPackage } from '../reporting/contracts.ts';
import type { ReportStore } from '../reporting/store.ts';

/**
 * Local decision API. It mutates RailMind-owned state only (report status,
 * audit trail, memory). It never writes to Maximo, finance or contract
 * systems.
 *
 * Every route except /api/health and /api/auth/demo-identities requires a
 * bearer token resolved by the token directory. The audit actor is always the
 * authenticated principal; actor fields in request bodies are ignored.
 */
export interface ApiDependencies {
  reportStore: ReportStore;
  auditLog: AuditLog;
  memoryStore: MemoryStore;
  /** Seed report restored by `reset` and used when the store is empty. */
  seedReport: ReportPackage;
  now?: () => string;
  persistence: 'in-memory' | 'postgres';
  /** Orchestrator for governed agent runs. Optional so the API can serve without handlers. */
  runtime?: AgentRuntime;
  /** Classification of the data this deployment handles; drives model policy. */
  classification?: DataClassification;
  /** Dependency probe (e.g. SELECT 1) used by /api/health. */
  healthCheck?: () => Promise<void>;
  /** Bearer-token directory. Required: there is no unauthenticated mode. */
  tokenDirectory: TokenDirectory;
}

/** Structural subset of Node's IncomingMessage/ServerResponse so src/ stays runtime-neutral. */
export interface ApiRequest extends AsyncIterable<Uint8Array | string> {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders() });
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

function buildTransition(body: Record<string, unknown>, now: string, principal: Principal): ReportTransition {
  const type = str(body, 'type');
  const actorId = principal.principalId;
  const actorRole = principal.role;
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

function buildTask(body: Record<string, unknown>, now: string, principal: Principal): AgentTask {
  const capability = str(body, 'capability');
  const actorId = principal.principalId;
  const goal = str(body, 'goal');
  const riskClass = str(body, 'riskClass') as RiskClass | undefined;
  const actionMode = str(body, 'actionMode') as ActionMode | undefined;
  if (!capability || !goal) throw new HttpError(400, 'capability and goal are required.');
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

function bearerToken(req: ApiRequest): string | null {
  const raw = req.headers?.authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}


export function createApiHandler(deps: ApiDependencies): ApiHandler {
  const now = deps.now ?? (() => new Date().toISOString());

  async function authenticate(req: ApiRequest): Promise<Principal> {
    const token = bearerToken(req);
    if (!token) throw new HttpError(401, 'Authentication required: send Authorization: Bearer <token>.');
    const principal = await deps.tokenDirectory.resolve(token);
    if (!principal) throw new HttpError(401, 'Invalid or unknown token.');
    return principal;
  }

  async function require(principal: Principal, permission: Permission, subjectId: string): Promise<void> {
    if (hasPermission(principal, permission)) return;
    await deps.auditLog.append({ action: 'auth.denied', actorId: principal.principalId, actorRole: principal.role, subjectType: 'principal', subjectId, at: now(), reason: `${principal.role} lacks ${permission}` });
    throw new HttpError(403, `Role ${principal.role} does not hold permission ${permission}.`);
  }

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
    if (method === 'GET' && path === '/api/auth/demo-identities') {
      if (deps.tokenDirectory.mode !== 'demo') throw new HttpError(404, 'Demo identities are not available in token mode.');
      return { status: 200, body: { mode: 'demo', identities: deps.tokenDirectory.demoIdentities().map((entry) => ({ ...entry.principal, token: entry.token, permissions: permissionsOf(entry.principal) })) } };
    }
    if (method === 'GET' && path === '/api/health') {
      let dependency: 'ok' | 'failed' | 'not-applicable' = 'not-applicable';
      if (deps.healthCheck) {
        try { await deps.healthCheck(); dependency = 'ok'; } catch { dependency = 'failed'; }
      }
      const body = { service: 'Project 44 RailMind Agent OS', status: dependency === 'failed' ? 'degraded' : 'ok', mode: 'p0-demo', persistence: deps.persistence, dependency, classification: deps.classification ?? 'synthetic', auth: deps.tokenDirectory.mode, capabilities: deps.runtime?.capabilities() ?? [] };
      return { status: dependency === 'failed' ? 503 : 200, body };
    }

    const principal = await authenticate(req);
    if (method === 'GET' && path === '/api/auth/me') {
      return { status: 200, body: { principal, permissions: permissionsOf(principal), mode: deps.tokenDirectory.mode } };
    }
    if (method === 'GET' && path === '/api/runs') {
      await require(principal, 'runs.read', 'runs');
      return { status: 200, body: { runs: deps.runtime?.runs() ?? [] } };
    }
    if (method === 'POST' && path === '/api/agent/run') {
      if (!deps.runtime) throw new HttpError(503, 'No agent runtime is configured in this deployment.');
      await require(principal, 'agent.run', 'agent');
      const body = await readJson(req);
      const task = buildTask(body, now(), principal);
      const context = body.context;
      const scoped: AgentTask = typeof context === 'object' && context !== null && !Array.isArray(context) ? { ...task, context: context as Record<string, unknown> } : task;
      const record = await deps.runtime.run(scoped, { classification: deps.classification ?? 'synthetic' });
      return { status: record.status === 'completed' ? 200 : record.status === 'blocked' ? 403 : 422, body: record };
    }
    if (method === 'GET' && path === '/api/report') {
      await require(principal, 'report.read', 'report');
      return { status: 200, body: await reportView() };
    }
    if (method === 'GET' && path === '/api/audit') {
      await require(principal, 'audit.read', 'audit');
      const events = await deps.auditLog.all();
      return { status: 200, body: { events, chain: await deps.auditLog.verifyChain(), persistence: deps.persistence } };
    }
    if (method === 'GET' && path === '/api/agents') {
      await require(principal, 'agents.read', 'agents');
      return { status: 200, body: { agents: AGENT_CATALOG } };
    }
    if (method === 'POST' && path === '/api/report/transition') {
      const body = await readJson(req);
      const transition = buildTransition(body, now(), principal);
      await require(principal, TRANSITION_PERMISSION[transition.type], deps.seedReport.reportId);
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
      await readJson(req);
      await require(principal, 'report.reset', deps.seedReport.reportId);
      const actorId = principal.principalId;
      const previous = await currentReport();
      await deps.reportStore.save(deps.seedReport);
      const audit = await deps.auditLog.append({
        action: 'report.reset',
        actorId,
        actorRole: principal.role,
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
      await require(principal, 'agent.plan', 'agent');
      const body = await readJson(req);
      const task = buildTask(body, now(), principal);
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
