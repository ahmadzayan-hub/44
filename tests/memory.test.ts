import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryMemoryStore } from '../src/agent-os/memory.ts';

test('InMemoryMemoryStore retrieves only records that belong to the requested task', async () => {
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

  const taskRecords = await store.byTask('TASK-1');
  const decisionRecords = await store.byKind('decision');

  assert.equal(taskRecords.length, 1);
  assert.equal(taskRecords[0]?.id, 'MEM-1');
  assert.equal(decisionRecords.length, 1);
  assert.equal(decisionRecords[0]?.id, 'MEM-2');
});
