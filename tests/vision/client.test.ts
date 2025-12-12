import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImageWithVision } from '../../src/vision/client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('analyzeImageWithVision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultOptions = {
    visionBackend: {
      url: 'http://localhost:8000',
      model: 'vision-model',
      apiKey: 'test-key',
      name: 'vision',
    },
  };

  it('should use clientAuthHeader when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test analysis' } }],
      }),
    });

    await analyzeImageWithVision('abc123', 'image/png', 'Describe', {
      ...defaultOptions,
      clientAuthHeader: 'Bearer custom-token',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer custom-token',
        }),
      })
    );
  });

  it('should use default apiKey when no clientAuthHeader', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test analysis' } }],
      }),
    });

    await analyzeImageWithVision('abc123', 'image/png', 'Describe', defaultOptions);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('should use default task when empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Default task result' } }],
      }),
    });

    await analyzeImageWithVision('abc123', 'image/png', '', defaultOptions);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages[1].content[0].text).toBe('Describe this image in detail.');
  });

  it('should return [No analysis available] when choices empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [],
      }),
    });

    const result = await analyzeImageWithVision('abc123', 'image/png', 'Describe', defaultOptions);

    expect(result).toBe('[No analysis available]');
  });

  it('should return [No analysis available] when content is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    const result = await analyzeImageWithVision('abc123', 'image/png', 'Describe', defaultOptions);

    expect(result).toBe('[No analysis available]');
  });
});
