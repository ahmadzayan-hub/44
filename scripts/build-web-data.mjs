import { writeFileSync } from 'node:fs';
import { renderDemoPackModule } from '../src/web/demo-pack.ts';

const target = new URL('../web/data/demo-pack.js', import.meta.url);
writeFileSync(target, renderDemoPackModule(), 'utf8');
console.log('Wrote web/data/demo-pack.js from the deterministic engine.');
