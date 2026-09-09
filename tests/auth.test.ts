import test from 'node:test';
import assert from 'node:assert/strict';

import { sha256Hex } from '../src/audit/log.ts';
import { ROLE_PERMISSIONS, hasPermission, isRole } from '../src/auth/principal.ts';
import { DEMO_IDENTITIES, DemoTokenDirectory, StaticTokenDirectory, createTokenDirectory, parseDirectoryEntries } from '../src/auth/token-directory.ts';

test('roles are cumulative and only admin can reset', () => {
  assert.equal(hasPermission({ principalId: 'v', displayName: 'V', role: 'viewer' }, 'report.read'), true);
  assert.equal(hasPermission({ principalId: 'v', displayName: 'V', role: 'viewer' }, 'agent.run'), false);
  assert.equal(hasPermission({ principalId: 'e', displayName: 'E', role: 'engineer' }, 'report.approve'), false);
  assert.equal(hasPermission({ principalId: 'm', displayName: 'M', role: 'manager' }, 'report.lock'), false);
  assert.equal(hasPermission({ principalId: 'o', displayName: 'O', role: 'contract-owner' }, 'report.lock'), true);
  assert.equal(hasPermission({ principalId: 'o', displayName: 'O', role: 'contract-owner' }, 'report.reset'), false);
  assert.equal(hasPermission({ principalId: 'a', displayName: 'A', role: 'admin' }, 'report.reset'), true);
  for (const role of Object.keys(ROLE_PERMISSIONS)) assert.equal(isRole(role), true);
  assert.equal(isRole('superuser'), false);
});

test('static directory resolves hashed tokens and never a wrong or empty token', async () => {
  const hash = await sha256Hex('s3cret-token');
  const directory = new StaticTokenDirectory([{ principalId: 'a.zaian', displayName: 'Ahmed Zaian', role: 'contract-owner', tokenSha256: hash }]);
  assert.equal(directory.mode, 'token');
  assert.deepEqual(await directory.resolve('s3cret-token'), { principalId: 'a.zaian', displayName: 'Ahmed Zaian', role: 'contract-owner' });
  assert.equal(await directory.resolve('s3cret-tokeN'), null);
  assert.equal(await directory.resolve(''), null);
  assert.deepEqual(directory.demoIdentities(), []);
});

test('static directory rejects malformed configuration at start', async () => {
  const hash = await sha256Hex('x');
  assert.throws(() => new StaticTokenDirectory([]), /at least one principal/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'boss' as never, tokenSha256: hash }]), /Unknown role/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', tokenSha256: 'abc' }]), /64-hex/);
  assert.throws(() => new StaticTokenDirectory([{ principalId: 'a', displayName: 'A', role: 'viewer', tokenSha256: hash }, { principalId: 'a', displayName: 'B', role: 'viewer', tokenSha256: hash }]), /Duplicate/);
  assert.throws(() => parseDirectoryEntries('{'), /not valid JSON/);
  assert.throws(() => parseDirectoryEntries('[{"displayName":"x"}]'), /missing principalId/);
});

test('demo directory is used only when no users are configured; demo tokens are refused in token mode', async () => {
  const demo = createTokenDirectory(null);
  assert.equal(demo.mode, 'demo');
  assert.equal((await demo.resolve('demo-engineer'))?.role, 'engineer');
  assert.equal(demo.demoIdentities().length, DEMO_IDENTITIES.length);
  const hash = await sha256Hex('real');
  const real = createTokenDirectory(JSON.stringify([{ principalId: 'u', displayName: 'U', role: 'manager', tokenSha256: hash }]));
  assert.equal(real.mode, 'token');
  assert.equal(await real.resolve('demo-engineer'), null);
  assert.equal((await real.resolve('real'))?.principalId, 'u');
  assert.equal(new DemoTokenDirectory().mode, 'demo');
});
