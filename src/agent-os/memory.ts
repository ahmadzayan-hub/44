import type { EvidenceRef } from './contracts.js';

export type MemoryKind = 'working' | 'episodic' | 'semantic' | 'decision';

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  taskId?: string;
  subject: string;
  content: string;
  createdAt: string;
  evidence: readonly EvidenceRef[];
  tags: readonly string[];
}

export interface MemoryStore {
  append(record: MemoryRecord): Promise<void>;
  byTask(taskId: string): Promise<readonly MemoryRecord[]>;
  byKind(kind: MemoryKind): Promise<readonly MemoryRecord[]>;
}

/**
 * Zero-infrastructure P0 adapter. Replace with PostgreSQL/pgvector through the
 * same interface when persistence is introduced.
 */
export class InMemoryMemoryStore implements MemoryStore {
  readonly #records: MemoryRecord[] = [];

  async append(record: MemoryRecord): Promise<void> {
    this.#records.push(record);
  }

  async byTask(taskId: string): Promise<readonly MemoryRecord[]> {
    return this.#records.filter((record) => record.taskId === taskId);
  }

  async byKind(kind: MemoryKind): Promise<readonly MemoryRecord[]> {
    return this.#records.filter((record) => record.kind === kind);
  }
}
