import type { OpenAIRequest } from '../types/index.js';
import { logger } from '../init.js';
import { analyzeImageWithVision } from './client.js';
import type { OpenAIImageUrlBlock, VisionClientOptions } from './types.js';

function isOpenAIImageBlock(block: unknown): block is OpenAIImageUrlBlock {
  return typeof block === 'object' && block !== null && 
    (block as OpenAIImageUrlBlock).type === 'image_url' && 
    'image_url' in block;
}

function extractBase64FromDataUrl(url: string): { data: string; media_type: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { media_type: match[1], data: match[2] };
  }
  return null;
}

/**
 * Check if OpenAI request has images in last message
 */
export function openaiLastMessageHasImages(request: OpenAIRequest): boolean {
  const lastMessage = request.messages[request.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  if (!Array.isArray(lastMessage.content)) return false;
  return lastMessage.content.some(block => isOpenAIImageBlock(block));
}

/**
 * Check if OpenAI request has images in history
 */
export function openaiHistoryHasImages(request: OpenAIRequest): boolean {
  for (let i = 0; i < request.messages.length - 1; i++) {
    const msg = request.messages[i];
    if (msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    if (msg.content.some(block => isOpenAIImageBlock(block))) {
      return true;
    }
  }
  return false;
}

/**
 * Analyze image from OpenAI format (data URL)
 */
async function analyzeOpenAIImage(
  imageUrl: string,
  task: string,
  options: VisionClientOptions
): Promise<string> {
  const extracted = extractBase64FromDataUrl(imageUrl);
  if (!extracted) {
    logger.warn({ imageUrl: imageUrl.substring(0, 50) }, 'Cannot process non-data URL image');
    return '[Image URL not supported - only base64 data URLs are processed]';
  }
  
  return analyzeImageWithVision(extracted.data, extracted.media_type, task, options);
}

/**
 * Process images in OpenAI request last message
 */
export async function processOpenAIImagesInLastMessage(
  request: OpenAIRequest,
  options: VisionClientOptions
): Promise<OpenAIRequest> {
  const lastIndex = request.messages.length - 1;
  const lastMessage = request.messages[lastIndex];
  
  if (!lastMessage || lastMessage.role !== 'user' || !Array.isArray(lastMessage.content)) {
    return request;
  }
  
  let imageCount = 0;
  const newContent: { type: string; text?: string; image_url?: { url: string } }[] = [];
  
  const textContext = lastMessage.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text || '')
    .join(' ') || 'Describe this image';
  
  for (const block of lastMessage.content) {
    if (isOpenAIImageBlock(block)) {
      imageCount++;
      logger.info({ imageCount }, 'Analyzing OpenAI format image');
      
      const description = await analyzeOpenAIImage(block.image_url.url, textContext, options);
      
      newContent.push({
        type: 'text',
        text: `[Image ${imageCount} analysis]:\n${description}`,
      });
    } else {
      newContent.push(block as { type: string; text?: string });
    }
  }
  
  const allText = newContent.every(b => b.type === 'text');
  const finalContent = allText
    ? newContent.map(b => b.text || '').join('\n\n')
    : newContent;
  
  const newMessages = [...request.messages];
  newMessages[lastIndex] = { ...lastMessage, content: finalContent };
  
  return { ...request, messages: newMessages };
}

/**
 * Remove images from OpenAI request history
 */
export function removeOpenAIImagesFromHistory(request: OpenAIRequest): OpenAIRequest {
  let globalImageCount = 0;
  
  const newMessages = request.messages.map((msg, index) => {
    if (index === request.messages.length - 1) return msg;
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
    
    const newContent = msg.content.map(block => {
      if (isOpenAIImageBlock(block)) {
        globalImageCount++;
        return {
          type: 'text' as const,
          text: `[Image ${globalImageCount} - previously analyzed]`,
        };
      }
      return block;
    });
    
    const allText = newContent.every(b => b.type === 'text');
    const finalContent = allText
      ? newContent.map(b => (b as { text?: string }).text || '').join('\n\n')
      : newContent;
    
    return { ...msg, content: finalContent };
  });
  
  return { ...request, messages: newMessages };
}
