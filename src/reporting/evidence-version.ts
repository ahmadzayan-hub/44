import type { KpiObservation } from './contracts.ts';

/**
 * Evidence version: a deterministic fingerprint of what an approval was given
 * for. It covers every KPI's value, formula version, readiness state and the
 * identities and timestamps of the evidence records. When the fingerprint
 * changes, the approval no longer describes the package and is superseded.
 */
export function evidenceMaterial(kpis: readonly KpiObservation[]): string {
  const parts = [...kpis]
    .sort((a, b) => a.definition.id.localeCompare(b.definition.id))
    .map((kpi) => ({
      id: kpi.definition.id,
      formulaVersion: kpi.definition.formulaVersion,
      value: kpi.value,
      readiness: kpi.readiness?.state ?? 'READY',
      evidence: [...kpi.evidence].map((ref) => `${ref.sourceSystem}:${ref.entityType}:${ref.entityId}@${ref.observedAt}`).sort(),
    }));
  return JSON.stringify(parts);
}

export async function computeEvidenceVersion(kpis: readonly KpiObservation[]): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(evidenceMaterial(kpis)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formulaVersionsOf(kpis: readonly KpiObservation[]): Readonly<Record<string, string>> {
  return Object.fromEntries(kpis.map((kpi) => [kpi.definition.id, kpi.definition.formulaVersion]));
}
