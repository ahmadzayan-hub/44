import test from 'node:test';
import assert from 'node:assert/strict';

import { sha256Hex } from '../src/audit/log.ts';
import { ROLE_PERMISSIONS, hasPermission, inScope, isRole, runPermissionFor } from '../src/auth/principal.ts';
import { DEMO_IDENTITIES, DemoTokenDirectory, StaticTokenDirectory, createTokenDirectory, parseDirectoryEntries } from '../src/auth/token-directory.ts';

const p = (role: Parameters<typeof hasPermission>[0]['role'], scopes: Parameters<typeof hasPermission>[0]['scopes'] = [{ type: 'system' }]) => ({ principalId: role, displayName: role, role, scopes });

test('roles map to distinct permission sets; only administrators reset; only approvers and administrators approve', () => {
  assert.equal(hasPermission(p('viewer'), 'report.read'), true);
  assert.equal(hasPermission(p('viewer'), 'agent.run:maintenance'), false);
  assert.equal(hasPermission(p('maintenance_engineer'), 'agent.run:maintenance'), true);
  assert.equal(hasPermission(p('maintenance_engineer'), 'agent.run:contract'), false);
  assert.equal(hasPermission(p('reliability_engineer'), 'agent.run:asset'), true);
  assert.equal(hasPermission(p('reliability_engineer'), 'report.submit'), false);
  assert.equal(hasPermission(p('contract_manager'), 'agent.run:contract'), true);
  assert.equal(hasPermission(p('contract_manager'), 'report.approve'), false);
  assert.equal(hasPermission(p('finance_reviewer'), 'agent.run:finance'), true);
  assert.equal(hasPermission(p('finance_reviewer'), 'agent.run:asset'), false);
  assert.equal(hasPermission(p('approver'), 'report.approve'), true);
  assert.equal(hasPermission(p('approver'), 'report.lock'), true);
  assert.equal(hasPermission(p('approver'), 'agent.run:maintenance'), false);
  assert.equal(hasPermission(p('approver'), 'report.reset'), false);
  assert.equal(hasPermission(p('administrator'), 'report.reset'), true);
  for (const role of Object.keys(ROLE_PERMISSIONS)) assert.equal(isRole(role), true);
  assert.equal(isRole('superuser'), false);
  assert.equal(runPermissionFor('failure-risk'), 'agent.run:asset');
  assert.equal(runPermissionFor('monthly-report'), 'agent.run:contract');
});

test('scopes: system covers everything; a contract scope covers only its contract', () => {
  assert.equal(inScope(p('viewer'), { type: 'contract', id: 'X' }), true);
  assert.equal(inScope(p('maintenance_engineer', [{ type: 'contract', id: 'X' }]), { type: 'contract', id: 'X' }), true);
  assert.equal(inScope(p('maintenance_engineer', [{ type: 'contract', id: 'X' }]), { type: 'contract', id: 'Y' }), false);
  assert.equal(inScope(p('maintenance_engineer', [{ type: 'line', id: 'Red Line' }]), { type: 'contract', id: 'X' }), false);
  assert.equal(inScope(p('maintenance_engineer', []), { type: 'contract', id: 'X' }), false);
});

test('static directory resolves hashed tokens and never a wrong or empty token', async () => {
  const hash = await sha256Hex('s3cret-token');
  const directory = new StaticTokenDirectory([{ principalId: 'a.zaian', displayName: 'Ahmed Zaian', role: 'approver', scopes: [{ type: 'contract', id: 'C-1' }], tokenSha256: hash }]);
  assert.equal(directory.mode, 'token');
  assert.deepEqual(await directory.resolve('s3cret-token'), { principalId: 'a.zaian', displayName: 'Ahmed Zaian', role: 'approver', scopes: [{ type: 'contract', id: 'C-1' }] });
  assert.equal(await directory.resolve('s3cret-tokeN'), null);
  assert.equal(await directory.resolve(''), null);
  assert.deepEqual(directory.demoIdentities(), []);
});

test('static directory rejects malformed configuration at start', async () => {
  const hash = await sha256Hex('x');
  assert.throws(() => new StaticTokenDirectory([]), /at least one principal/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'boss' as never, scopes: [], tokenSha256: hash }]), /Unknown role/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', scopes: [], tokenSha256: 'abc' }]), /64-hex/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', scopes: [], tokenSha256: hash }, { principalId: 'a', displayName: 'B', role: 'viewer', scopes: [], tokenSha256: hash }]), /Duplicate/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', scopes: [{ type: 'galaxy' as never }], tokenSha256: hash }]), /Unknown scope type/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', scopes: [{ type: 'contract' }], tokenSha256: hash }]), /requires an id/);
  assert.throws(() => parseDirectoryEntries('{'), /not valid JSON/);
  assert.throws(() => parseDirectoryEntries('[{"displayName":"x"}]'), /missing principalId/);
});

test('demo directory is used only when no users are configured; demo tokens are refused in token mode', async () => {
  const demo = createTokenDirectory(null);
  assert.equal(demo.mode, 'demo');
  assert.equal((await demo.resolve('demo-engineer'))?.role, 'maintenance_engineer');
  assert.equal(demo.demoIdentities().length, DEMO_IDENTITIES.length);
  const hash = await sha256Hex('real');
  const real = createTokenDirectory(JSON.stringify([{ principalId: 'u', displayName: 'U', role: 'approver', scopes: [{ type: 'contract', id: 'C' }], tokenSha256: hash }]));
  assert.equal(real.mode, 'token');
  assert.equal(await real.resolve('demo-engineer'), null);
  assert.equal((await real.resolve('real'))?.principalId, 'u');
  assert.deepEqual((await real.resolve('real'))?.scopes, [{ type: 'contract', id: 'C' }]);
  assert.equal(new DemoTokenDirectory().mode, 'demo');
});
