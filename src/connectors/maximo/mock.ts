import type {
  MaximoAssetRecord,
  MaximoInvoiceRecord,
  MaximoMeterReading,
  MaximoP0Port,
  MaximoPmRecord,
  MaximoWorkOrderRecord,
} from './port.ts';

export interface MockMaximoData {
  assets: readonly MaximoAssetRecord[];
  workOrders: readonly MaximoWorkOrderRecord[];
  preventiveMaintenance?: readonly MaximoPmRecord[];
  meters?: readonly MaximoMeterReading[];
  invoices?: readonly MaximoInvoiceRecord[];
}

export class MockMaximoReadPort implements MaximoP0Port {
  private readonly data: MockMaximoData;

  constructor(data: MockMaximoData) {
    this.data = data;
  }

  async getAsset(assetId: string): Promise<MaximoAssetRecord | null> {
    return this.data.assets.find((asset) => asset.assetId === assetId) ?? null;
  }

  async listWorkOrders(assetId: string, since?: string): Promise<readonly MaximoWorkOrderRecord[]> {
    return this.data.workOrders.filter((wo) => {
      if (wo.assetId !== assetId) return false;
      if (!since || !wo.reportedAt) return true;
      return wo.reportedAt >= since;
    });
  }

  async listPreventiveMaintenance(assetId: string): Promise<readonly MaximoPmRecord[]> {
    return (this.data.preventiveMaintenance ?? []).filter((pm) => pm.assetId === assetId);
  }

  async listMeterReadings(assetId: string, since?: string): Promise<readonly MaximoMeterReading[]> {
    return (this.data.meters ?? []).filter((reading) => {
      if (reading.assetId !== assetId) return false;
      return !since || reading.observedAt >= since;
    });
  }

  async listInvoices(contractId: string, since?: string): Promise<readonly MaximoInvoiceRecord[]> {
    return (this.data.invoices ?? []).filter((invoice) => {
      if (invoice.contractId !== contractId) return false;
      return !since || !invoice.invoiceDate || invoice.invoiceDate >= since;
    });
  }
}
