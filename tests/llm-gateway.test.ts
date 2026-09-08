import test from 'node:test';
import assert from 'node:assert/strict';

import { OpenAiCompatibleGateway } from '../src/llm/openai-compatible.ts';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('open-source model gateway uses OpenAI-compatible protocol without SDK dependency', async () => {
  let requestedUrl = '';
  let body = '';
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    body = String(init?.body ?? '');
    return jsonResponse({ model: 'Qwen3-8B', choices: [{ message: { content: 'Grounded draft' }, finish_reason: 'stop' }] });
  };
  const gateway = new OpenAiCompatibleGateway({ baseUrl: 'http://127.0.0.1:8080/v1', model: 'Qwen3-8B', fetchImpl });
  const result = await gateway.generate({ messages: [{ role: 'user', content: 'hello' }] });
  assert.equal(requestedUrl, 'http://127.0.0.1:8080/v1/chat/completions');
  assert.match(body, /Qwen3-8B/);
  assert.equal(result.text, 'Grounded draft');
});
