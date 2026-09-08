import type { ModelGateway, ModelRequest, ModelResponse } from '../agent-os/contracts.ts';

interface ChatCompletionChoice {
  message?: { content?: string };
  finish_reason?: string;
}

interface ChatCompletionPayload {
  model?: string;
  choices?: ChatCompletionChoice[];
}

export interface OpenAiCompatibleGatewayConfig {
  /** e.g. http://127.0.0.1:8080/v1 for llama.cpp */
  baseUrl: string;
  model: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/** Vendor-neutral adapter for local/open-source OpenAI-compatible inference servers. */
export class OpenAiCompatibleGateway implements ModelGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly config: OpenAiCompatibleGatewayConfig;

  constructor(config: OpenAiCompatibleGatewayConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      }),
    });
    if (!response.ok) throw new Error(`Model gateway failed: HTTP ${response.status}`);
    const payload = await response.json() as ChatCompletionPayload;
    const choice = payload.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      model: payload.model ?? this.config.model,
      finishReason: choice?.finish_reason,
    };
  }
}
