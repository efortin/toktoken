import type { AnthropicRequest, AnthropicContentBlock } from '../types/index.js';
import { logger } from '../init.js';
import { analyzeImageWithVision } from './client.js';
import type { ImageBlock, VisionClientOptions } from './types.js';

function isImageBlock(block: AnthropicContentBlock): block is ImageBlock {
  return block.type === 'image' && 'source' in block;
}

/**
 * Check if request has images in any message
 */
export function hasImages(request: AnthropicRequest): boolean {
  for (const msg of request.messages) {
    if (msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    if (msg.content.some(block => isImageBlock(block as AnthropicContentBlock))) {
      return true;
    }
  }
  return false;
}

/**
 * Check if last message has images
 */
export function lastMessageHasImages(request: AnthropicRequest): boolean {
  const lastMessage = request.messages[request.messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') return false;
  if (!Array.isArray(lastMessage.content)) return false;
  return lastMessage.content.some(block => isImageBlock(block as AnthropicContentBlock));
}

/**
 * Check if history (excluding last message) has images
 */
export function historyHasImages(request: AnthropicRequest): boolean {
  for (let i = 0; i < request.messages.length - 1; i++) {
    const msg = request.messages[i];
    if (msg.role !== 'user') continue;
    if (!Array.isArray(msg.content)) continue;
    if (msg.content.some(block => isImageBlock(block as AnthropicContentBlock))) {
      return true;
    }
  }
  return false;
}

/**
 * Process images in last message: analyze and replace with descriptions
 */
export async function processImagesInLastMessage(
  request: AnthropicRequest,
  options: VisionClientOptions
): Promise<AnthropicRequest> {
  const lastIndex = request.messages.length - 1;
  const lastMessage = request.messages[lastIndex];
  
  if (!lastMessage || lastMessage.role !== 'user' || !Array.isArray(lastMessage.content)) {
    return request;
  }
  
  let imageCount = 0;
  const newContent: AnthropicContentBlock[] = [];
  
  const textContext = lastMessage.content
    .filter(b => b.type === 'text')
    .map(b => b.text || '')
    .join(' ') || 'Describe this image';
  
  for (const block of lastMessage.content) {
    if (isImageBlock(block as AnthropicContentBlock)) {
      const imgBlock = block as ImageBlock;
      imageCount++;
      logger.info({ imageCount }, 'Analyzing image');
      
      const description = await analyzeImageWithVision(
        imgBlock.source.data,
        imgBlock.source.media_type,
        textContext,
        options
      );
      
      newContent.push({
        type: 'text',
        text: `[Image ${imageCount} analysis]:\n${description}`,
      });
    } else {
      newContent.push(block);
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
 * Remove images from history (replace with placeholder)
 */
export function removeImagesFromHistory(request: AnthropicRequest): AnthropicRequest {
  let globalImageCount = 0;
  
  const newMessages = request.messages.map((msg, index) => {
    if (index === request.messages.length - 1) return msg;
    if (msg.role !== 'user' || !Array.isArray(msg.content)) return msg;
    
    const newContent = msg.content.map(block => {
      if (isImageBlock(block as AnthropicContentBlock)) {
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
      ? newContent.map(b => b.text || '').join('\n\n')
      : newContent;
    
    return { ...msg, content: finalContent };
  });
  
  return { ...request, messages: newMessages };
}
