/**
 * RailMind Agent OS public contracts.
 *
 * These contracts deliberately contain no model-vendor or agent-framework types.
 * Business workflows depend on RailMind interfaces, not on a specific LLM SDK.
 */

export type RiskClass =
  | 'routine'
  | 'operational'
  | 'contractual'
  | 'financial'
  | 'safety_critical';

export type ActionMode =
  | 'read'
  | 'analyse'
  | 'draft'
  | 'propose_write'
  | 'execute_write'
  | 'control';

export type SourceSystem =
  | 'maximo'
  | 'maximo_finance'
  | 'contract_repository'
  | 'condition_monitoring'
  | 'inspection'
  | 'manual'
  | 'railmind';

export interface EvidenceRef {
  sourceSystem: SourceSystem;
  entityType: string;
  entityId: string;
  observedAt: string;
  /** Optional deep link or canonical source locator. */
  sourceUri?: string;
  /** Optional content hash for immutable evidence snapshots. */
  snapshotHash?: string;
}

export interface SourceFact<T> {
  value: T;
  evidence: EvidenceRef;
  ingestedAt: string;
  quality: 'verified' | 'provisional' | 'rejected';
  qualityNote?: string;
}

export interface AgentTask {
  taskId: string;
  actorId: string;
  goal: string;
  capability: string;
  riskClass: RiskClass;
  actionMode: ActionMode;
  requestedAt: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  purpose: string;
  capabilities: readonly string[];
  allowedActionModes: readonly ActionMode[];
  allowedToolIds: readonly string[];
  /** LLM use is optional. Deterministic agents can set this to false. */
  mayUseModel: boolean;
}

export interface HumanApproval {
  reviewerId: string;
  reviewerRole: string;
  decision: 'approved' | 'rejected';
  at: string;
  note?: string;
}

export interface ExecutionPolicyDecision {
  allowed: boolean;
  approvalRequired: boolean;
  reason: string;
}

export interface AgentExecutionPlan {
  task: AgentTask;
  agent: AgentDefinition;
  policy: ExecutionPolicyDecision;
  toolIds: readonly string[];
}

export interface GroundedAgentOutput<T> {
  taskId: string;
  agentId: string;
  value: T;
  evidence: readonly EvidenceRef[];
  assumptions: readonly string[];
  generatedAt: string;
  humanApproval?: HumanApproval;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  messages: readonly ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface ModelResponse {
  text: string;
  model: string;
  finishReason?: string;
}

/**
 * RailMind talks to this interface only. A llama.cpp, vLLM, Ollama or hosted
 * OpenAI-compatible endpoint can sit behind it without changing domain code.
 */
export interface ModelGateway {
  generate(request: ModelRequest): Promise<ModelResponse>;
}
