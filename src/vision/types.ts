import type { BackendConfig } from '../types/index.js';

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface OpenAIImageUrlBlock {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export interface VisionClientOptions {
  visionBackend: BackendConfig;
  clientAuthHeader?: string;
}

export interface ResizedImage {
  data: string;
  media_type: string;
}
