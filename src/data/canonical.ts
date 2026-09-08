import type { EvidenceRef } from '../agent-os/contracts.ts';

/**
 * Canonical decision data used inside Project 44.
 * Authoritative records stay in source systems; these shapes are normalized projections.
 */
export interface CanonicalAsset {
  assetId: string;
  name: string;
  assetClass?: string;
  location?: string;
  status?: string;
  criticality?: 'low' | 'medium' | 'high' | 'safety_critical';
  manufacturer?: string;
  model?: string;
  commissioningDate?: string;
  evidence: EvidenceRef;
}

export interface CanonicalWorkOrder {
  workOrderId: string;
  assetId: string;
  workType?: string;
  status: string;
  priority?: number;
  reportedAt?: string;
  actualStartAt?: string;
  completedAt?: string;
  downtimeMinutes: number;
  actualCost?: number;
  evidence: EvidenceRef;
}

export interface CanonicalInvoice {
  invoiceId: string;
  contractId: string;
  vendorId?: string;
  status: string;
  grossAmount?: number;
  approvedAmount?: number;
  currency?: string;
  workflowState?: string;
  evidence: EvidenceRef;
}

export interface ContractContext {
  contractId: string;
  title: string;
  ownerParty: string;
  contractorParty: string;
  startDate?: string;
  endDate?: string;
  evidence: EvidenceRef;
}

export interface DecisionDataSnapshot {
  snapshotId: string;
  generatedAt: string;
  assets: readonly CanonicalAsset[];
  workOrders: readonly CanonicalWorkOrder[];
  invoices: readonly CanonicalInvoice[];
  contracts: readonly ContractContext[];
}
