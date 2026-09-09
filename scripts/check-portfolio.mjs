import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../web/portfolio.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const restricted = /(?<![A-Z0-9])(?:RTA|RMD|DUBAI|METRO|TRAM|HITATCHI|ALSTOM|WSP|SENER|TTE|AVALON|SHARAF|WINSTAR|WAAGNER|TUV|THYSSENKRUPP|ENOVA|WILO|HEAD QUARTER|GROUP 4|G4S|KINKISHARYO|JEBEL|BUSINESS BAY|ONPASSIVE|QDP|JDP|OVPD|RAA\/RMD|RA\/RM|MAXIMO)(?![A-Z0-9])/i;
assert.equal(restricted.test(html), false, 'Portfolio workspace contains a restricted identifier.');
assert.equal(/<script\s+src=/i.test(html), false, 'Portfolio workspace must remain local and dependency-free.');

const cellsMatch = html.match(/const cells=(\[.*?\]);\nconst forecastMeta=/s);
const metaMatch = html.match(/const forecastMeta=(\{.*?\});\nconst state=/s);
const scriptMatch = html.match(/<script>\n([\s\S]*?)\n<\/script>/);
assert.ok(cellsMatch?.[1], 'Embedded aggregate cells are missing.');
assert.ok(metaMatch?.[1], 'Forecast metadata is missing.');
assert.ok(scriptMatch?.[1], 'Embedded dashboard script is missing.');
new Function(scriptMatch[1]);

const cells = JSON.parse(cellsMatch[1]);
const meta = JSON.parse(metaMatch[1]);
const total = (key) => cells.reduce((sum, cell) => sum + Number(cell[key] ?? 0), 0);
assert.equal(cells.length, 10);
assert.equal(total('count'), 30);
assert.equal(Number(total('totalCost').toFixed(2)), 364969387.46);
assert.equal(Number(total('expenditure').toFixed(2)), 72805360.17);
assert.equal(total('forecastEligibleCount'), 14);
assert.equal(Number(total('forecastP25').toFixed(2)), 11706580.01);
assert.equal(Number(total('forecastP50').toFixed(2)), 15067608.17);
assert.equal(Number(total('forecastP75').toFixed(2)), 35491353.46);
assert.equal(meta.asOf, '2026-09-09');
assert.equal(meta.horizon, '2026-12-31');
assert.equal(meta.sampleSize, 10);
assert.ok(meta.paceP25 <= meta.paceP50 && meta.paceP50 <= meta.paceP75);
for (const cell of cells) {
  assert.deepEqual(Object.keys(cell).sort(), [
    'awardStatus', 'budget2026', 'businessArea', 'count', 'expenditure',
    'forecastEligibleBudget', 'forecastEligibleCount', 'forecastP25', 'forecastP50',
    'forecastP75', 'portfolio', 'totalCost',
  ]);
}
console.log('PASS: portfolio aggregates, forecast scenarios, privacy boundary, and embedded JavaScript verified.');
