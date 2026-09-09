import test from 'node:test';
import assert from 'node:assert/strict';

import { describeConfig, loadConfig } from '../src/config.ts';
import { evaluateModelInvocation, isLocalEndpoint } from '../src/llm/policy.ts';

test('local endpoint detection covers loopback and private ranges', () => {
  assert.equal(isLocalEndpoint('http://127.0.0.1:8080/v1'), true);
  assert.equal(isLocalEndpoint('http://localhost:11434/v1'), true);
  assert.equal(isLocalEndpoint('http://10.20.30.40:8000/v1'), true);
  assert.equal(isLocalEndpoint('https://api.example.com/v1'), false);
  assert.equal(isLocalEndpoint('not a url'), false);
});

test('confidential data never reaches a remote endpoint without explicit approval', () => {
  const remote = { baseUrl: 'https://api.example.com/v1', remoteApprovedForInternal: false, remoteApprovedForConfidential: false };
  assert.equal(evaluateModelInvocation('confidential', remote).allowed, false);
  assert.equal(evaluateModelInvocation('internal', remote).allowed, false);
  assert.equal(evaluateModelInvocation('synthetic', remote).allowed, true);
  assert.equal(evaluateModelInvocation('confidential', { ...remote, remoteApprovedForConfidential: true }).allowed, true);
  assert.equal(evaluateModelInvocation('confidential', { ...remote, baseUrl: 'http://127.0.0.1:8080/v1' }).allowed, true);
  assert.equal(evaluateModelInvocation('synthetic', { ...remote, baseUrl: null }).endpoint, 'none');
});

test('configuration falls back to the synthetic in-memory demo and never exposes secrets in its summary', () => {
  const config = loadConfig({});
  assert.equal(config.port, 4173);
  assert.equal(config.databaseUrl, null);
  assert.equal(config.classification, 'synthetic');
  assert.equal(config.llm.baseUrl, null);
  const configured = loadConfig({ PORT: '5000', DATABASE_URL: 'postgres://u:secret@db/x', LLM_BASE_URL: 'http://127.0.0.1:8080/v1', LLM_API_KEY: 'k', DATA_CLASSIFICATION: 'confidential', LLM_REMOTE_APPROVED_FOR_INTERNAL: 'true', MAXIMO_BASE_URL: 'https://maximo.example.com/maximo', MAXIMO_API_KEY: 'mk' });
  assert.equal(configured.port, 5000);
  assert.equal(configured.classification, 'confidential');
  assert.equal(configured.llm.remoteApprovedForInternal, true);
  const summary = JSON.stringify(describeConfig(configured));
  assert.doesNotMatch(summary, /secret|"k"|mk/);
  assert.match(summary, /postgres/);
});
