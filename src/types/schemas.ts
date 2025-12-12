import { z } from 'zod';

// Anthropic Content Block Schema
export const AnthropicContentBlockSchema = z.object({
  type: z.enum(['text', 'image', 'tool_use', 'tool_result']),
  text: z.string().optional(),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.string(),
    data: z.string(),
  }).optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  tool_use_id: z.string().optional(),
  content: z.string().optional(),
});

// Anthropic Message Schema
export const AnthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
});

// Anthropic Tool Schema
export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.string(), z.unknown()),
});

// Anthropic Request Schema
export const AnthropicRequestSchema = z.object({
  model: z.string(),
  messages: z.array(AnthropicMessageSchema),
  max_tokens: z.number(),
  system: z.string().optional(),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: z.object({
    type: z.string(),
    name: z.string().optional(),
  }).optional(),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  stop_sequences: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// OpenAI Message Content Schema
export const OpenAIMessageContentSchema = z.union([
  z.string(),
  z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
    image_url: z.object({
      url: z.string(),
    }).optional(),
  })),
]);

// OpenAI Message Schema
export const OpenAIMessageSchema = z.object({
  role: z.string(),
  content: OpenAIMessageContentSchema,
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
});

// OpenAI Request Schema
export const OpenAIRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OpenAIMessageSchema),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  stream: z.boolean().optional(),
  tools: z.array(z.object({
    type: z.string(),
    function: z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()),
    }),
  })).optional(),
  tool_choice: z.union([
    z.string(),
    z.object({
      type: z.string(),
      function: z.object({
        name: z.string(),
      }).optional(),
    }),
  ]).optional(),
});

// Token Count Request Schema
export const TokenCountRequestSchema = z.object({
  messages: z.array(z.object({
    content: z.union([
      z.string(),
      z.array(z.object({
        type: z.string(),
        text: z.string().optional(),
        input: z.unknown().optional(),
        content: z.unknown().optional(),
      })),
    ]),
  })).optional(),
  system: z.union([
    z.string(),
    z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })),
  ]).optional(),
  tools: z.array(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    input_schema: z.unknown().optional(),
  })).optional(),
});

// Backend Config Schema
export const BackendConfigSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  apiKey: z.string(),
  model: z.string(),
  anthropicNative: z.boolean().optional(),
});

// Telemetry Config Schema
export const TelemetryConfigSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().url().optional(),
});

// Router Config Schema
export const RouterConfigSchema = z.object({
  port: z.number().int().positive(),
  host: z.string(),
  apiKey: z.string(),
  defaultBackend: BackendConfigSchema,
  visionBackend: BackendConfigSchema.optional(),
  telemetry: TelemetryConfigSchema,
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

// Infer types from schemas
export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;
export type AnthropicRequest = z.infer<typeof AnthropicRequestSchema>;
export type OpenAIRequest = z.infer<typeof OpenAIRequestSchema>;
export type TokenCountRequest = z.infer<typeof TokenCountRequestSchema>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;
export type RouterConfig = z.infer<typeof RouterConfigSchema>;
