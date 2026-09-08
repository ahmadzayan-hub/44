import { describe, expect, it } from 'vitest';

import { InMemoryMemoryStore } from '../src/agent-os/memory.js';

describe('InMemoryMemoryStore', () => {
  it('retrieves only records that belong to the requested task', async () => {
    const store = new InMemoryMemoryStore();

    await store.append({
      id: 'MEM-1',
      kind: 'episodic',
      taskId: 'TASK-1',
      subject: 'KPI analysis run',
      content: 'Retrieved work-order evidence.',
      createdAt: '2026-09-09T00:00:00Z',
      evidence: [],
      tags: ['kpi'],
    });
    await store.append({
      id: 'MEM-2',
      kind: 'decision',
      taskId: 'TASK-2',
      subject: 'Contract review',
      content: 'Approved with a condition.',
      createdAt: '2026-09-09T00:01:00Z',
      evidence: [],
      tags: ['contract'],
    });

    await expect(store.byTask('TASK-1')).resolves.toMatchObject([{ id: 'MEM-1' }]);
    await expect(store.byKind('decision')).resolves.toMatchObject([{ id: 'MEM-2' }]);
  });
});
