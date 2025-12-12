// Re-export Zod schemas and inferred types
export {
  AnthropicContentBlockSchema,
  AnthropicMessageSchema,
  AnthropicToolSchema,
  AnthropicRequestSchema,
  OpenAIRequestSchema,
  TokenCountRequestSchema,
  BackendConfigSchema,
  TelemetryConfigSchema,
  RouterConfigSchema,
  type AnthropicContentBlock,
  type AnthropicMessage,
  type AnthropicTool,
  type AnthropicRequest,
  type OpenAIRequest,
  type TokenCountRequest,
  type BackendConfig,
  type TelemetryConfig,
  type RouterConfig,
} from './schemas.js';

import type { AnthropicContentBlock } from './schemas.js';

// Response types (not validated, just for typing responses)
export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicStreamEvent {
  type: string;
  message?: Partial<AnthropicResponse>;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface TokenUsage {
  requestId: string;
  timestamp: Date;
  model: string;
  backend: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  hasToolCalls: boolean;
  hasVision: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
