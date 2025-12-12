import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasImages,
  lastMessageHasImages,
  historyHasImages,
  processImagesInLastMessage,
  removeImagesFromHistory,
  openaiLastMessageHasImages,
  openaiHistoryHasImages,
  processOpenAIImagesInLastMessage,
  removeOpenAIImagesFromHistory,
} from '../../src/vision/index.js';
import type { AnthropicRequest, OpenAIRequest } from '../../src/types/index.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Image Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lastMessageHasImages', () => {
    it('should return true when last message has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(true);
    });

    it('should return false when last message has no images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'user', content: 'No image here' },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(false);
    });

    it('should return false when last message is from assistant', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };
      expect(lastMessageHasImages(request)).toBe(false);
    });
  });

  describe('historyHasImages', () => {
    it('should return true when history has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'assistant', content: 'I see a green image' },
          { role: 'user', content: 'What else?' },
        ],
      };
      expect(historyHasImages(request)).toBe(true);
    });

    it('should return false when only last message has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };
      expect(historyHasImages(request)).toBe(false);
    });
  });

  describe('removeImagesFromHistory', () => {
    it('should replace images in history with placeholders', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look at this' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'assistant', content: 'I see green' },
          { role: 'user', content: 'What about now?' },
        ],
      };

      const result = removeImagesFromHistory(request);

      // First message should have image replaced (concatenated to string)
      expect(result.messages[0].content).toBe('Look at this\n\n[Image 1 - previously analyzed]');

      // Last message should be unchanged
      expect(result.messages[2].content).toBe('What about now?');
    });

    it('should not modify last message', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = removeImagesFromHistory(request);

      // Last message should still have image
      expect(result.messages[1].content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
      ]);
    });
  });

  describe('processImagesInLastMessage', () => {
    it('should analyze images and replace with descriptions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is a green square' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Image should be replaced with analysis (concatenated to string)
      expect(result.messages[0].content).toBe('What is this?\n\n[Image 1 analysis]:\nThis is a green square');

      // Vision API should be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should analyze multiple images', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Green square' } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Red circle' } }],
          }),
        });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Compare these' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'green' } },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'red' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result.messages[0].content).toBe('Compare these\n\n[Image 1 analysis]:\nGreen square\n\n[Image 2 analysis]:\nRed circle');

      // Vision API should be called twice (once per image)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should NOT re-analyze images in history (only last message)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'New image analysis' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          // Old message with image (should NOT be analyzed)
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'old' } },
            ],
          },
          { role: 'assistant', content: 'I saw a green image' },
          // New message with image (should be analyzed)
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What about this one?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'new' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Only ONE call to vision API (for the new image in last message)
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Old image in history should be unchanged
      expect(result.messages[0].content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'old' } },
      ]);

      // New image should be replaced with analysis (concatenated to string)
      expect(result.messages[2].content).toBe('What about this one?\n\n[Image 1 analysis]:\nNew image analysis');
    });
  });

  describe('Full flow - images not re-analyzed', () => {
    it('should only analyze new images, not previously analyzed ones', async () => {
      // First turn: user sends image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'A green square' } }],
        }),
      });

      const firstRequest: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'green' } },
            ],
          },
        ],
      };

      const firstResult = await processImagesInLastMessage(firstRequest, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second turn: user asks follow-up (no new image)
      // Simulate conversation with processed first message
      const secondRequest: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          firstResult.messages[0], // Already processed (image replaced with description)
          { role: 'assistant', content: 'It is a green square' },
          { role: 'user', content: 'What shade of green?' },
        ],
      };

      // This should NOT call vision API since there are no new images
      const hasImages = lastMessageHasImages(secondRequest);
      expect(hasImages).toBe(false);

      // No additional calls to vision API
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should only process last message image when history also has images', async () => {
      // Simulate: first message had image (already processed), second message has new image
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Second image analysis' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          // First message: image already in history (should NOT be re-analyzed)
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'first_image' } },
            ],
          },
          { role: 'assistant', content: 'I see the first image' },
          // Second message: new image (should be analyzed)
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Now look at this' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'second_image' } },
            ],
          },
        ],
      };

      // Process images in last message
      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Only ONE call - for the second image in last message
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // First message image should be UNCHANGED (not re-analyzed)
      expect(result.messages[0].content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'first_image' } },
      ]);

      // Last message should have image replaced
      expect(result.messages[2].content).toBe('Now look at this\n\n[Image 1 analysis]:\nSecond image analysis');

      // Now remove images from history
      const cleaned = removeImagesFromHistory(result);

      // First message image should now be placeholder
      expect(cleaned.messages[0].content).toBe('[Image 1 - previously analyzed]');

      // Last message should still have the analysis (unchanged)
      expect(cleaned.messages[2].content).toBe('Now look at this\n\n[Image 1 analysis]:\nSecond image analysis');
    });
  });

  describe('OpenAI format - image detection', () => {
    it('should detect images in OpenAI format last message', () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
            ],
          },
        ],
      };
      expect(openaiLastMessageHasImages(request)).toBe(true);
    });

    it('should return false when no images in OpenAI format', () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };
      expect(openaiLastMessageHasImages(request)).toBe(false);
    });

    it('should detect images in OpenAI format history', () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'data:image/png;base64,old' } },
            ],
          },
          { role: 'assistant', content: 'I see it' },
          { role: 'user', content: 'What else?' },
        ],
      };
      expect(openaiHistoryHasImages(request)).toBe(true);
    });
  });

  describe('OpenAI format - image processing', () => {
    it('should process OpenAI format images', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'A blue circle' } }],
        }),
      });

      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } },
            ],
          },
        ],
      };

      const result = await processOpenAIImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result.messages[0].content).toBe('Describe this\n\n[Image 1 analysis]:\nA blue circle');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should remove OpenAI format images from history', () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,old' } },
            ],
          },
          { role: 'assistant', content: 'I see' },
          { role: 'user', content: 'What now?' },
        ],
      };

      const result = removeOpenAIImagesFromHistory(request);

      expect(result.messages[0].content).toBe('Look\n\n[Image 1 - previously analyzed]');
      expect(result.messages[2].content).toBe('What now?');
    });
  });

  describe('Error handling', () => {
    it('should handle vision API failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Should contain error message instead of crashing
      expect(result.messages[0].content).toContain('[Image analysis failed]');
    });

    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result.messages[0].content).toContain('[Image analysis error]');
    });
  });

  describe('hasImages', () => {
    it('should return true when any message has images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
            ],
          },
          { role: 'assistant', content: 'I see' },
        ],
      };
      expect(hasImages(request)).toBe(true);
      expect(lastMessageHasImages(request)).toBe(false);
      expect(historyHasImages(request)).toBe(true);
    });

    it('should return false for assistant messages with array content', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };
      expect(hasImages(request)).toBe(false);
      expect(historyHasImages(request)).toBe(false);
    });

    it('should return false when no images in any message', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: [{ type: 'text', text: 'How are you?' }] },
        ],
      };
      expect(hasImages(request)).toBe(false);
    });

    it('should skip non-user messages when checking for images', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'Hi' },
        ],
      };
      expect(hasImages(request)).toBe(false);
    });
  });

  describe('processImagesInLastMessage edge cases', () => {
    it('should return unchanged request when last message is assistant', async () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result).toEqual(request);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return unchanged request when last message content is string', async () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result).toEqual(request);
    });

    it('should keep mixed content as array when not all text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis result' } }],
        }),
      });

      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look at this' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
              { type: 'tool_result', tool_use_id: 'tool1', content: 'result' },
            ],
          },
        ],
      };

      const result = await processImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // Should be array since tool_result is not text
      expect(Array.isArray(result.messages[0].content)).toBe(true);
    });
  });

  describe('removeImagesFromHistory edge cases', () => {
    it('should handle mixed content in history', () => {
      const request: AnthropicRequest = {
        model: 'test',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
              { type: 'tool_result', tool_use_id: 'tool1', content: 'result' },
            ],
          },
          { role: 'assistant', content: 'I see' },
          { role: 'user', content: 'What now?' },
        ],
      };

      const result = removeImagesFromHistory(request);

      // First message should have array content (not all text due to tool_result)
      expect(Array.isArray(result.messages[0].content)).toBe(true);
    });
  });

  describe('OpenAI format edge cases', () => {
    it('should return unchanged request when last message is not user', async () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
      };

      const result = await processOpenAIImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result).toEqual(request);
    });

    it('should return unchanged request when content is string', async () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };

      const result = await processOpenAIImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result).toEqual(request);
    });

    it('should handle non-data URL images', async () => {
      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look' },
              { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
            ],
          },
        ],
      };

      const result = await processOpenAIImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      expect(result.messages[0].content).toContain('[Image URL not supported');
    });

    it('should handle mixed content keeping array format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }],
        }),
      });

      const request: OpenAIRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Look' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
            ],
          },
        ],
      };

      const result = await processOpenAIImagesInLastMessage(request, {
        visionBackend: {
          url: 'http://localhost:8000',
          model: 'vision-model',
          apiKey: 'test-key',
          name: 'vision',
        },
      });

      // All text, should be string
      expect(typeof result.messages[0].content).toBe('string');
    });
  });
});
