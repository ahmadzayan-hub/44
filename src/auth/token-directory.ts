import { sha256Hex } from '../audit/log.ts';
import { isRole, type Principal, type Role } from './principal.ts';

/**
 * Bearer-token directory.
 *
 * Tokens are never stored in clear: the directory holds SHA-256 hashes and
 * compares the hash of the presented token. Two modes exist:
 *
 * - `token`: principals and hashes come from RAILMIND_USERS (JSON). Use
 *   `node scripts/hash-token.mjs` to produce a hash for a new token.
 * - `demo`: fixed, documented demo identities for the synthetic preview. The
 *   demo directory is refused when RAILMIND_USERS is set, so a production
 *   deployment can never fall back to demo tokens silently.
 */
export type AuthMode = 'demo' | 'token';

export interface TokenDirectory {
  readonly mode: AuthMode;
  resolve(token: string): Promise<Principal | null>;
  /** Demo identities with their tokens. Only the demo directory returns entries. */
  demoIdentities(): readonly { principal: Principal; token: string }[];
}

export interface DirectoryEntry {
  principalId: string;
  displayName: string;
  role: Role;
  tokenSha256: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class StaticTokenDirectory implements TokenDirectory {
  readonly mode: AuthMode = 'token';
  readonly #entries: readonly DirectoryEntry[];

  constructor(entries: readonly DirectoryEntry[]) {
    if (entries.length === 0) throw new Error('Token directory requires at least one principal.');
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!entry.principalId.trim() || !entry.displayName.trim()) throw new Error('Directory entries require principalId and displayName.');
      if (!isRole(entry.role)) throw new Error(`Unknown role for ${entry.principalId}: ${String(entry.role)}`);
      if (!/^[0-9a-f]{64}$/.test(entry.tokenSha256)) throw new Error(`tokenSha256 for ${entry.principalId} must be a 64-hex SHA-256.`);
      if (ids.has(entry.principalId)) throw new Error(`Duplicate principalId: ${entry.principalId}`);
      ids.add(entry.principalId);
    }
    this.#entries = entries;
  }

  async resolve(token: string): Promise<Principal | null> {
    if (!token) return null;
    const hash = await sha256Hex(token);
    for (const entry of this.#entries) {
      if (constantTimeEqual(entry.tokenSha256, hash)) {
        return { principalId: entry.principalId, displayName: entry.displayName, role: entry.role };
      }
    }
    return null;
  }

  demoIdentities(): readonly { principal: Principal; token: string }[] {
    return [];
  }
}

/** Synthetic-preview identities. Tokens are public by design and only valid in demo mode. */
export const DEMO_IDENTITIES: readonly { principal: Principal; token: string }[] = [
  { principal: { principalId: 'demo.viewer', displayName: 'Demo Viewer', role: 'viewer' }, token: 'demo-viewer' },
  { principal: { principalId: 'demo.engineer', displayName: 'Demo Reliability Engineer', role: 'engineer' }, token: 'demo-engineer' },
  { principal: { principalId: 'demo.manager', displayName: 'Demo Maintenance Manager', role: 'manager' }, token: 'demo-manager' },
  { principal: { principalId: 'demo.owner', displayName: 'Demo Contract Owner', role: 'contract-owner' }, token: 'demo-owner' },
  { principal: { principalId: 'demo.admin', displayName: 'Demo Administrator', role: 'admin' }, token: 'demo-admin' },
];

export class DemoTokenDirectory implements TokenDirectory {
  readonly mode: AuthMode = 'demo';

  async resolve(token: string): Promise<Principal | null> {
    const found = DEMO_IDENTITIES.find((entry) => constantTimeEqual(entry.token, token));
    return found ? { ...found.principal } : null;
  }

  demoIdentities(): readonly { principal: Principal; token: string }[] {
    return DEMO_IDENTITIES;
  }
}

/** Parses RAILMIND_USERS JSON. Throws on malformed input so misconfiguration fails at start. */
export function parseDirectoryEntries(json: string): readonly DirectoryEntry[] {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('RAILMIND_USERS is not valid JSON.'); }
  if (!Array.isArray(parsed)) throw new Error('RAILMIND_USERS must be a JSON array.');
  return parsed.map((item, index) => {
    const row = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
    const entry = { principalId: String(row.principalId ?? ''), displayName: String(row.displayName ?? ''), role: row.role as Role, tokenSha256: String(row.tokenSha256 ?? '') };
    if (!entry.principalId) throw new Error(`RAILMIND_USERS[${index}] is missing principalId.`);
    return entry;
  });
}

export function createTokenDirectory(usersJson: string | null): TokenDirectory {
  return usersJson ? new StaticTokenDirectory(parseDirectoryEntries(usersJson)) : new DemoTokenDirectory();
}
