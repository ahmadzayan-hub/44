import test from 'node:test';
import assert from 'node:assert/strict';

import { MaximoRestClient } from '../src/connectors/maximo/client.ts';

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('Maximo P0 client uses GET only', async () => {
  let method = '';
  const fetchImpl: typeof fetch = async (_input, init) => {
    method = init?.method ?? 'GET';
    return response({ member: [{ assetnum: 'A-1', description: 'Test asset', status: 'OPERATING' }] });
  };
  const client = new MaximoRestClient({
    baseUrl: 'https://maximo.example.test/maximo',
    objectStructures: { assets: 'MXAPIASSET', workOrders: 'MXAPIWODETAIL', preventiveMaintenance: 'MXAPIPM', meters: 'MXAPIMETER', invoices: 'MXAPIINVOICE' },
    fetchImpl,
  });
  const asset = await client.getAsset('A-1');
  assert.equal(method, 'GET');
  assert.equal(asset?.assetId, 'A-1');
  assert.equal(asset?.name, 'Test asset');
});

test('Maximo error is surfaced instead of fabricated data', async () => {
  const fetchImpl: typeof fetch = async () => new Response('denied', { status: 403 });
  const client = new MaximoRestClient({
    baseUrl: 'https://maximo.example.test/maximo',
    objectStructures: { assets: 'A', workOrders: 'W', preventiveMaintenance: 'P', meters: 'M', invoices: 'I' },
    fetchImpl,
  });
  await assert.rejects(() => client.getAsset('A-1'), /HTTP 403/);
});
