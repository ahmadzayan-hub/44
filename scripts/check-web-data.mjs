import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDemoPack, renderDemoPackModule } from '../src/web/demo-pack.ts';

const target = new URL('../web/data/demo-pack.js', import.meta.url);
const committed = readFileSync(target, 'utf8');
const expected = renderDemoPackModule();
assert.equal(committed, expected, 'web/data/demo-pack.js has drifted from the engine. Run `npm run build:web-data` and commit the result.');

const pack = buildDemoPack();
assert.equal(pack.kpis.length, 5);
assert.ok(pack.timeline.length >= 2, 'Timeline must contain at least one event and the period close.');
const close = pack.timeline[pack.timeline.length - 1];
for (const kpi of pack.kpis) {
  const replayed = close.kpis.find((item) => item.id === kpi.id);
  assert.ok(replayed, `Timeline close is missing KPI ${kpi.id}.`);
  assert.equal(replayed.value, kpi.value, `Timeline close value for ${kpi.id} must equal the report value.`);
  assert.equal(replayed.status, kpi.status, `Timeline close status for ${kpi.id} must equal the report status.`);
}
for (const exception of pack.exceptions) {
  assert.ok(pack.kpis.some((kpi) => kpi.id === exception.kpiId), `Exception ${exception.id} must map to a KPI.`);
  assert.ok(exception.evidence.length > 0, `Exception ${exception.id} must carry evidence.`);
}
console.log('PASS: web data pack matches the deterministic engine.');
