import type {
  MaximoAssetRecord,
  MaximoInvoiceRecord,
  MaximoMeterReading,
  MaximoP0Port,
  MaximoPmRecord,
  MaximoWorkOrderRecord,
} from './port.ts';

export interface MaximoObjectStructures {
  assets: string;
  workOrders: string;
  preventiveMaintenance: string;
  meters: string;
  invoices: string;
}

export interface MaximoRestClientConfig {
  /** Example: https://maximo.example.com/maximo */
  baseUrl: string;
  /** P0 uses a read-only integration identity. */
  apiKey?: string;
  authorizationHeader?: string;
  objectStructures: MaximoObjectStructures;
  fetchImpl?: typeof fetch;
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function text(record: JsonObject, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function numberValue(record: JsonObject, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function members(payload: unknown): readonly JsonObject[] {
  const root = asObject(payload);
  const candidate = root.member ?? root.members ?? root.items ?? root.results;
  if (Array.isArray(candidate)) return candidate.map(asObject);
  return [];
}

/**
 * Read-only Maximo REST adapter. It intentionally exposes no POST/PATCH/DELETE path.
 * Object Structure names and field aliases are deployment-specific and configured outside domain logic.
 */
export class MaximoRestClient implements MaximoP0Port {
  private readonly fetchImpl: typeof fetch;
  private readonly config: MaximoRestClientConfig;

  constructor(config: MaximoRestClientConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async get(structure: string, params: Readonly<Record<string, string>>): Promise<readonly JsonObject[]> {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}/api/os/${encodeURIComponent(structure)}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.config.apiKey) headers.apikey = this.config.apiKey;
    if (this.config.authorizationHeader) headers.Authorization = this.config.authorizationHeader;

    const response = await this.fetchImpl(url, { method: 'GET', headers });
    if (!response.ok) throw new Error(`Maximo read failed: HTTP ${response.status}`);
    return members(await response.json());
  }

  async getAsset(assetId: string): Promise<MaximoAssetRecord | null> {
    const rows = await this.get(this.config.objectStructures.assets, {
      'oslc.where': `assetnum=\"${assetId.replaceAll('"', '')}\"`,
      'oslc.pageSize': '1',
    });
    const row = rows[0];
    if (!row) return null;
    return {
      assetId: text(row, 'assetid', 'assetnum', 'id') ?? assetId,
      assetNumber: text(row, 'assetnum'),
      name: text(row, 'description', 'name') ?? assetId,
      parentAssetId: text(row, 'parent', 'parentasset'),
      location: text(row, 'location'),
      assetClass: text(row, 'classstructureid', 'assetclass'),
      status: text(row, 'status'),
      manufacturer: text(row, 'manufacturer'),
      model: text(row, 'modelnum', 'model'),
      commissioningDate: text(row, 'installdate', 'commissioningdate'),
      criticality: text(row, 'priority', 'criticality'),
    };
  }

  async listWorkOrders(assetId: string, since?: string): Promise<readonly MaximoWorkOrderRecord[]> {
    const where = [`assetnum=\"${assetId.replaceAll('"', '')}\"`];
    if (since) where.push(`reportdate>=\"${since.replaceAll('"', '')}\"`);
    const rows = await this.get(this.config.objectStructures.workOrders, {
      'oslc.where': where.join(' and '),
      'oslc.pageSize': '500',
    });
    return rows.map((row) => ({
      workOrderId: text(row, 'wonum', 'workorderid', 'id') ?? 'unknown',
      assetId,
      workType: text(row, 'worktype'),
      status: text(row, 'status') ?? 'UNKNOWN',
      priority: numberValue(row, 'wopriority', 'priority'),
      reportedAt: text(row, 'reportdate', 'reportedat'),
      targetStartAt: text(row, 'targstartdate', 'targetstartat'),
      actualStartAt: text(row, 'actstart', 'actualstartat'),
      completedAt: text(row, 'actfinish', 'completedat'),
      failureCode: text(row, 'failurecode'),
      problemCode: text(row, 'problemcode'),
      causeCode: text(row, 'causecode'),
      remedyCode: text(row, 'remedycode'),
      downtimeMinutes: numberValue(row, 'downtimeminutes', 'downtime'),
      labourHours: numberValue(row, 'labhrs', 'labourhours'),
      actualCost: numberValue(row, 'acttotalcost', 'actualcost'),
    }));
  }

  async listPreventiveMaintenance(assetId: string): Promise<readonly MaximoPmRecord[]> {
    const rows = await this.get(this.config.objectStructures.preventiveMaintenance, {
      'oslc.where': `assetnum=\"${assetId.replaceAll('"', '')}\"`,
      'oslc.pageSize': '200',
    });
    return rows.map((row) => ({
      pmId: text(row, 'pmnum', 'pmid', 'id') ?? 'unknown',
      assetId,
      frequency: numberValue(row, 'frequency'),
      frequencyUnit: text(row, 'frequnit', 'frequencyunit'),
      lastCompletedAt: text(row, 'laststartdate', 'lastcompletedat'),
      nextDueAt: text(row, 'nextdate', 'nextdueat'),
      status: text(row, 'status'),
    }));
  }

  async listMeterReadings(assetId: string, since?: string): Promise<readonly MaximoMeterReading[]> {
    const where = [`assetnum=\"${assetId.replaceAll('"', '')}\"`];
    if (since) where.push(`readingdate>=\"${since.replaceAll('"', '')}\"`);
    const rows = await this.get(this.config.objectStructures.meters, {
      'oslc.where': where.join(' and '),
      'oslc.pageSize': '500',
    });
    return rows.map((row) => ({
      assetId,
      meterName: text(row, 'metername', 'meter') ?? 'unknown',
      reading: numberValue(row, 'reading', 'readingvalue') ?? 0,
      unit: text(row, 'measureunitid', 'unit'),
      observedAt: text(row, 'readingdate', 'observedat') ?? new Date(0).toISOString(),
    }));
  }

  async listInvoices(contractId: string, since?: string): Promise<readonly MaximoInvoiceRecord[]> {
    const where = [`contractref=\"${contractId.replaceAll('"', '')}\"`];
    if (since) where.push(`invoicedate>=\"${since.replaceAll('"', '')}\"`);
    const rows = await this.get(this.config.objectStructures.invoices, {
      'oslc.where': where.join(' and '),
      'oslc.pageSize': '500',
    });
    return rows.map((row) => ({
      invoiceId: text(row, 'invoicenum', 'invoiceid', 'id') ?? 'unknown',
      contractId,
      vendorId: text(row, 'vendor'),
      status: text(row, 'status') ?? 'UNKNOWN',
      invoiceDate: text(row, 'invoicedate'),
      grossAmount: numberValue(row, 'totalcost', 'grossamount'),
      approvedAmount: numberValue(row, 'approvedamount'),
      currency: text(row, 'currencycode', 'currency'),
      workflowState: text(row, 'workflowstate', 'wfstatus'),
    }));
  }
}
