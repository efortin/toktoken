import { describe, it, expect } from 'vitest';
import { convertAnthropicToOpenAI, convertOpenAIToAnthropic } from '../../src/transform/anthropic-to-openai.js';
import type { AnthropicRequest, OpenAIResponse } from '../../src/types/index.js';

describe('anthropic-to-openai conversion', () => {
  describe('convertAnthropicToOpenAI', () => {
    it('should convert simple text message', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.model).toBe('claude-3');
      expect(result.max_tokens).toBe(100);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should include system message', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        system: 'You are a helpful assistant',
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
      expect(result.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert text content blocks', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
          ],
        }],
        max_tokens: 100,
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.messages[0].content).toEqual([
        { type: 'text', text: 'What is this?' },
      ]);
    });

    it('should convert image content blocks to image_url format', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc123' } },
          ],
        }],
        max_tokens: 100,
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.messages[0].content).toEqual([
        { type: 'text', text: 'Describe this' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
      ]);
    });

    it('should preserve temperature and stream options', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        temperature: 0.7,
        stream: true,
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.temperature).toBe(0.7);
      expect(result.stream).toBe(true);
    });

    it('should handle multiple messages', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        max_tokens: 100,
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(result.messages[2]).toEqual({ role: 'user', content: 'How are you?' });
    });
  });

  describe('convertOpenAIToAnthropic', () => {
    it('should convert simple response', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe('claude-3');
      expect(result.stop_reason).toBe('end_turn');
      expect(result.content).toEqual([{ type: 'text', text: 'Hello!' }]);
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    });

    it('should handle non-stop finish reason', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Partial...' },
          finish_reason: 'length',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.stop_reason).toBeNull();
    });

    it('should handle empty content', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: null },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.content).toEqual([]);
    });

    it('should handle missing usage', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: undefined as unknown as OpenAIResponse['usage'],
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });

    it('should handle empty choices', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBeNull();
    });

    it('should convert tool_calls to tool_use blocks', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Paris"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.stop_reason).toBe('tool_use');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { location: 'Paris' },
      });
    });

    it('should handle invalid JSON in tool arguments', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: 'invalid json',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: {},
      });
    });

    it('should handle content with tool_calls together', () => {
      const response: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Let me check the weather',
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "Paris"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = convertOpenAIToAnthropic(response, 'claude-3');

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Let me check the weather' });
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { location: 'Paris' },
      });
    });
  });

  describe('convertAnthropicToOpenAI - tools', () => {
    it('should convert Anthropic tools to OpenAI format', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        max_tokens: 100,
        tools: [{
          name: 'get_weather',
          description: 'Get weather for a location',
          input_schema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        }],
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.tools).toHaveLength(1);
      expect(result.tools?.[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      });
    });

    it('should handle system as array of blocks', () => {
      const request: AnthropicRequest = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
        system: [
          { type: 'text', text: 'You are helpful.' },
          { type: 'text', text: 'Be concise.' },
        ],
      };

      const result = convertAnthropicToOpenAI(request);

      expect(result.messages[0]).toEqual({
        role: 'system',
        content: 'You are helpful.\nBe concise.',
      });
    });
  });
});
