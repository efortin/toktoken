import { countTokens } from '../transform/token-counter.js';
import { TokenCountRequestSchema, type TokenCountRequest } from '../types/index.js';

export interface TokenCountResponse {
  input_tokens: number;
}

export { type TokenCountRequest };

export function handleTokenCount(body: unknown): TokenCountResponse {
  const { messages = [], system, tools = [] } = TokenCountRequestSchema.parse(body);
  
  let tokenCount = 0;
  
  for (const message of messages) {
    if (typeof message.content === 'string') {
      tokenCount += countTokens(message.content);
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text') tokenCount += countTokens(part.text || '');
        else if (part.type === 'tool_use') tokenCount += countTokens(JSON.stringify(part.input || {}));
        else if (part.type === 'tool_result') {
          tokenCount += countTokens(typeof part.content === 'string' ? part.content : JSON.stringify(part.content || ''));
        }
      }
    }
  }
  
  if (typeof system === 'string') tokenCount += countTokens(system);
  else if (Array.isArray(system)) {
    for (const item of system) {
      if (item.type === 'text' && item.text) tokenCount += countTokens(item.text);
    }
  }
  
  for (const tool of tools) {
    if (tool.name) tokenCount += countTokens(tool.name);
    if (tool.description) tokenCount += countTokens(tool.description);
    if (tool.input_schema) tokenCount += countTokens(JSON.stringify(tool.input_schema));
  }
  
  return { input_tokens: tokenCount };
}
