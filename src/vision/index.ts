// Types
export type { VisionClientOptions, ImageBlock, OpenAIImageUrlBlock, ResizedImage } from './types.js';

// Anthropic format
export {
  hasImages,
  lastMessageHasImages,
  historyHasImages,
  processImagesInLastMessage,
  removeImagesFromHistory,
} from './anthropic.js';

// OpenAI format
export {
  openaiLastMessageHasImages,
  openaiHistoryHasImages,
  processOpenAIImagesInLastMessage,
  removeOpenAIImagesFromHistory,
} from './openai.js';

// Re-export for backwards compatibility
export type { VisionClientOptions as ImageAgentOptions } from './types.js';
