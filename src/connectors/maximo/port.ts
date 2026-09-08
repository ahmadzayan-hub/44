/**
 * Maximo anti-corruption layer.
 *
 * Maximo remains authoritative. RailMind consumes the minimum records needed
 * for a decision and does not expose Maximo-specific response shapes to the
 * rest of the application.
 */

export interface MaximoAssetRecord {
  assetId: string;
  assetNumber?: string;
  name: string;
  parentAssetId?: string;
  location?: string;
  assetClass?: string;
  status?: string;
  manufacturer?: string;
  model?: string;
  commissioningDate?: string;
  criticality?: string;
}

export interface MaximoWorkOrderRecord {
  workOrderId: string;
  assetId: string;
  workType?: string;
  status: string;
  priority?: number;
  reportedAt?: string;
  targetStartAt?: string;
  actualStartAt?: string;
  completedAt?: string;
  failureCode?: string;
  problemCode?: string;
  causeCode?: string;
  remedyCode?: string;
  downtimeMinutes?: number;
  labourHours?: number;
  actualCost?: number;
}

export interface MaximoPmRecord {
  pmId: string;
  assetId: string;
  frequency?: number;
  frequencyUnit?: string;
  lastCompletedAt?: string;
  nextDueAt?: string;
  status?: string;
}

export interface MaximoMeterReading {
  assetId: string;
  meterName: string;
  reading: number;
  unit?: string;
  observedAt: string;
}

export interface MaximoInvoiceRecord {
  invoiceId: string;
  contractId?: string;
  vendorId?: string;
  status: string;
  invoiceDate?: string;
  grossAmount?: number;
  approvedAmount?: number;
  currency?: string;
  workflowState?: string;
}

export interface MaximoReadPort {
  getAsset(assetId: string): Promise<MaximoAssetRecord | null>;
  listWorkOrders(assetId: string, since?: string): Promise<readonly MaximoWorkOrderRecord[]>;
  listPreventiveMaintenance(assetId: string): Promise<readonly MaximoPmRecord[]>;
  listMeterReadings(assetId: string, since?: string): Promise<readonly MaximoMeterReading[]>;
  listInvoices(contractId: string, since?: string): Promise<readonly MaximoInvoiceRecord[]>;
}

/**
 * P0 intentionally has no execute/create/update methods. Future integrations
 * should expose a separate proposal/approval port rather than weakening this one.
 */
export type MaximoP0Port = MaximoReadPort;
