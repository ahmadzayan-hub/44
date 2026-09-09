import type { AgentExecutionPlan, ToolCallRecord } from './contracts.ts';

/**
 * Governed tool registry.
 *
 * Tools are the only way an agent reaches data. Every tool is read-only in P0,
 * is registered under the id the catalog refers to, and can only be invoked
 * through a ToolInvoker scoped to an execution plan. A call outside the plan's
 * allowed tool ids is refused before any implementation runs.
 */
export interface ToolDefinition<I = unknown, O = unknown> {
  id: string;
  description: string;
  readOnly: true;
  /** Short, non-sensitive summary of a call for the audit trail. */
  summarise(input: I): string;
  invoke(input: I): Promise<O>;
}

export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition<never, unknown>>();

  register<I, O>(tool: ToolDefinition<I, O>): this {
    if (this.#tools.has(tool.id)) throw new Error(`Tool already registered: ${tool.id}`);
    if (tool.readOnly !== true) throw new Error(`P0 tools must be read-only: ${tool.id}`);
    this.#tools.set(tool.id, tool as ToolDefinition<never, unknown>);
    return this;
  }

  has(id: string): boolean {
    return this.#tools.has(id);
  }

  get(id: string): ToolDefinition<never, unknown> | undefined {
    return this.#tools.get(id);
  }

  ids(): readonly string[] {
    return [...this.#tools.keys()];
  }
}

export class ToolAccessError extends Error {
  readonly toolId: string;
  constructor(toolId: string, message: string) {
    super(message);
    this.toolId = toolId;
  }
}

export interface ToolInvoker {
  call<I, O>(toolId: string, input: I): Promise<O>;
  readonly calls: readonly ToolCallRecord[];
}

export function createScopedInvoker(
  registry: ToolRegistry,
  plan: AgentExecutionPlan,
  onCall: (record: ToolCallRecord) => Promise<void>,
  now: () => string,
): ToolInvoker {
  const calls: ToolCallRecord[] = [];
  return {
    calls,
    async call<I, O>(toolId: string, input: I): Promise<O> {
      if (!plan.toolIds.includes(toolId)) {
        throw new ToolAccessError(toolId, `${plan.agent.id} is not allowed to call tool ${toolId}.`);
      }
      const tool = registry.get(toolId) as ToolDefinition<I, O> | undefined;
      if (!tool) throw new ToolAccessError(toolId, `Tool ${toolId} is allowed by the catalog but not registered in this deployment.`);
      const record: ToolCallRecord = { toolId, at: now(), summary: tool.summarise(input) };
      calls.push(record);
      await onCall(record);
      return tool.invoke(input);
    },
  };
}
