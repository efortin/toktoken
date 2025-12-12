import { logger } from '../init.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resizeImageIfNeeded } from './resize.js';
import type { VisionClientOptions } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadSystemPrompt(): string {
  const defaultPrompt = 'Analyze this image and describe what you see.';
  try {
    const possiblePaths = [
      join(__dirname, 'prompt.md'),
      join(__dirname, '..', '..', 'src', 'vision', 'prompt.md'),
    ];
    
    for (const mdPath of possiblePaths) {
      try {
        const content = readFileSync(mdPath, 'utf-8');
        const match = content.match(/## System Prompt\n\n([\s\S]*?)(?=\n## |$)/);
        if (match?.[1]) {
          return match[1].trim();
        }
      } catch {
        continue;
      }
    }
    return defaultPrompt;
  } catch {
    return defaultPrompt;
  }
}

const VISION_SYSTEM_PROMPT = loadSystemPrompt();

/**
 * Analyze an image using the vision model (always OpenAI format)
 */
export async function analyzeImageWithVision(
  base64Data: string,
  mediaType: string,
  task: string,
  options: VisionClientOptions
): Promise<string> {
  const { visionBackend, clientAuthHeader } = options;
  
  const resized = await resizeImageIfNeeded(base64Data, mediaType);
  const authHeader = clientAuthHeader || `Bearer ${visionBackend.apiKey}`;
  
  try {
    const response = await fetch(`${visionBackend.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        model: visionBackend.model,
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: task || 'Describe this image in detail.' },
              {
                type: 'image_url',
                image_url: { url: `data:${resized.media_type};base64,${resized.data}` },
              },
            ],
          },
        ],
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, status: response.status }, 'Vision analysis failed');
      return '[Image analysis failed]';
    }

    const result = await response.json() as { choices: Array<{ message: { content: string } }> };
    return result.choices?.[0]?.message?.content || '[No analysis available]';
  } catch (error) {
    logger.error({ error }, 'Vision analysis error');
    return '[Image analysis error]';
  }
}
