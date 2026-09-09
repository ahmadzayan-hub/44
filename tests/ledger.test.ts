import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryDecisionLedger, buildTrace, validateLedgerInput } from '../src/ledger/contracts.ts';
import { PgDecisionLedger } from '../src/persistence/postgres.ts';
import type { SqlClient, SqlDatabase, SqlRow } from '../src/persistence/sql.ts';

const evidence = [{ sourceSystem: 'maximo' as const, entityType: 'work-order', entityId: 'WO-1001', observedAt: '2026-08-03T08:00:00Z' }];
const base = { subjectType: 'report' as const, subjectId: 'R-1', actorId: 'engineer-1', evidence, kpiVersions: { mttr: 'demo-v1' } };

test('ledger refuses anonymous, undated or evidence-less decisions', () => {
  assert.throws(() => validateLedgerInput({ ...base, kind: 'decision', at: '2026-09-01T00:00:00Z', actorId: ' ', payload: {} }), /named actor/);
  assert.throws(() => validateLedgerInput({ ...base, kind: 'decision', at: 'never', payload: {} }), /valid timestamp/);
  assert.throws(() => validateLedgerInput({ ...base, kind: 'recommendation', at: '2026-09-01T00:00:00Z', payload: {}, evidence: [] }), /requires evidence/);
});

test('ledger is append-only with lineage: recommendation -> decision -> outcome, and supersession is a new record', async () => {
  const ledger = new InMemoryDecisionLedger();
  const recommendation = await ledger.append({ ...base, kind: 'recommendation', at: '2026-09-01T00:00:00Z', payload: { action: 'inspect' } });
  const decision = await ledger.append({ ...base, kind: 'decision', at: '2026-09-02T00:00:00Z', actorId: 'mgr-1', payload: { decision: 'accept' }, follows: recommendation.ledgerId });
  const outcome = await ledger.append({ ...base, kind: 'outcome', at: '2026-10-01T00:00:00Z', payload: { result: 'no repeat failure' }, follows: decision.ledgerId });
  const revised = await ledger.append({ ...base, kind: 'decision', at: '2026-10-02T00:00:00Z', actorId: 'mgr-1', payload: { decision: 'revise' }, supersedes: decision.ledgerId });
  await assert.rejects(() => ledger.append({ ...base, kind: 'decision', at: '2026-10-03T00:00:00Z', payload: {}, supersedes: 'LED-999999' }), /unknown ledger record/);

  const trace = await ledger.trace(outcome.ledgerId);
  assert.deepEqual(trace?.lineage.map((r) => r.kind), ['recommendation', 'decision']);
  assert.equal(trace?.sources.length, 3);
  const decisionTrace = await ledger.trace(decision.ledgerId);
  assert.equal(decisionTrace?.supersededBy, revised.ledgerId);
  assert.deepEqual(decisionTrace?.successors.map((r) => r.ledgerId).sort(), [outcome.ledgerId, revised.ledgerId].sort());
  assert.equal((await ledger.get(decision.ledgerId))?.payload.decision, 'accept', 'historical record is untouched');
  assert.equal((await ledger.all()).length, 4);
});

class FakeDb implements SqlDatabase {
  rows: SqlRow[] = [];
  async query(text: string, params: readonly unknown[] = []): Promise<{ rows: SqlRow[] }> {
    if (text.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (text.startsWith('SELECT sequence FROM railmind_ledger')) { const last = this.rows[this.rows.length - 1]; return { rows: last ? [last] : [] }; }
    if (text.includes('INSERT INTO railmind_ledger')) { const p = params; this.rows.push({ sequence: p[0], ledger_id: p[1], kind: p[2], subject_type: p[3], subject_id: p[4], at: new Date(String(p[5])), actor_id: p[6], actor_role: p[7], payload: JSON.parse(String(p[8])), evidence: JSON.parse(String(p[9])), kpi_versions: JSON.parse(String(p[10])), evidence_version: p[11], supersedes: p[12], follows: p[13], audit_sequence: p[14] }); return { rows: [] }; }
    if (text.includes('WHERE ledger_id = $1')) return { rows: this.rows.filter((r) => r.ledger_id === params[0]) };
    if (text.includes('WHERE subject_type = $1')) return { rows: this.rows.filter((r) => r.subject_type === params[0] && r.subject_id === params[1]) };
    if (text.includes('FROM railmind_ledger ORDER BY sequence ASC')) return { rows: [...this.rows] };
    throw new Error(`Unexpected SQL: ${text}`);
  }
  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> { return fn(this); }
  async close(): Promise<void> {}
}

test('PostgreSQL ledger adapter round-trips records and traces through SQL', async () => {
  const ledger = new PgDecisionLedger(new FakeDb());
  const first = await ledger.append({ ...base, kind: 'recommendation', at: '2026-09-01T00:00:00Z', payload: { action: 'inspect' }, evidenceVersion: 'ev-1', auditSequence: 7 });
  const second = await ledger.append({ ...base, kind: 'decision', at: '2026-09-02T00:00:00Z', actorId: 'mgr-1', actorRole: 'approver', payload: { decision: 'accept' }, follows: first.ledgerId });
  assert.equal(first.ledgerId, 'LED-000001');
  const stored = await ledger.get(second.ledgerId);
  assert.equal(stored?.follows, 'LED-000001');
  assert.equal(stored?.actorRole, 'approver');
  assert.equal(stored?.at, '2026-09-02T00:00:00.000Z');
  assert.deepEqual(stored?.kpiVersions, { mttr: 'demo-v1' });
  const trace = await ledger.trace(second.ledgerId);
  assert.equal(trace?.lineage[0]?.ledgerId, 'LED-000001');
  assert.equal(trace?.lineage[0]?.auditSequence, 7);
  assert.equal(buildTrace(second, await ledger.all()).sources.length, 2);
});
