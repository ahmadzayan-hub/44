/**
 * Authenticated principals and role-based permissions.
 *
 * P0 rule: every mutating API call is attributed to an authenticated principal.
 * The audit trail records the principal id and role from the token directory,
 * never a caller-supplied name.
 */
export type Role = 'viewer' | 'engineer' | 'manager' | 'contract-owner' | 'admin';

export type Permission =
  | 'report.read'
  | 'report.submit'
  | 'report.approve'
  | 'report.reject'
  | 'report.lock'
  | 'report.reset'
  | 'agent.plan'
  | 'agent.run'
  | 'audit.read'
  | 'runs.read'
  | 'agents.read';

export interface Principal {
  principalId: string;
  displayName: string;
  role: Role;
}

const VIEWER: readonly Permission[] = ['report.read', 'audit.read', 'runs.read', 'agents.read'];
const ENGINEER: readonly Permission[] = [...VIEWER, 'agent.plan', 'agent.run', 'report.submit'];
const MANAGER: readonly Permission[] = [...ENGINEER, 'report.approve', 'report.reject'];
const CONTRACT_OWNER: readonly Permission[] = [...MANAGER, 'report.lock'];
const ADMIN: readonly Permission[] = [...CONTRACT_OWNER, 'report.reset'];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  viewer: VIEWER,
  engineer: ENGINEER,
  manager: MANAGER,
  'contract-owner': CONTRACT_OWNER,
  admin: ADMIN,
};

export const ROLES: readonly Role[] = ['viewer', 'engineer', 'manager', 'contract-owner', 'admin'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function permissionsOf(principal: Principal): readonly Permission[] {
  return ROLE_PERMISSIONS[principal.role];
}

export function hasPermission(principal: Principal, permission: Permission): boolean {
  return ROLE_PERMISSIONS[principal.role].includes(permission);
}

/** Maps report transitions to the permission they require. */
export const TRANSITION_PERMISSION: Readonly<Record<'submit_for_review' | 'approve' | 'reject' | 'lock', Permission>> = {
  submit_for_review: 'report.submit',
  approve: 'report.approve',
  reject: 'report.reject',
  lock: 'report.lock',
};
