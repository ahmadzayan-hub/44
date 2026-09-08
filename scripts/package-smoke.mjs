import * as railmind from '../dist/index.js';

const expectedExports = [
  'AGENT_CATALOG',
  'InMemoryMemoryStore',
  'createExecutionPlan',
  'evaluateExecutionPolicy',
  'hasDecisionGradeEvidence',
  'hasApprovedHumanReview',
  'isOutputReleaseReady',
];

const missing = expectedExports.filter((name) => !(name in railmind));
if (missing.length > 0) {
  throw new Error(`Packaged module is missing exports: ${missing.join(', ')}`);
}

console.log(`Package smoke check passed: ${expectedExports.length} public exports verified.`);
