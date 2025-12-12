import sharp from 'sharp';
import { logger } from '../init.js';
import type { ResizedImage } from './types.js';

// Max image dimensions (1024x1024)
const MAX_DIMENSION = 1024;

/**
 * Resize image if dimensions exceed 1024x1024
 * Returns resized base64 data or original if small enough
 */
export async function resizeImageIfNeeded(
  base64Data: string,
  mediaType: string
): Promise<ResizedImage> {
  const buffer = Buffer.from(base64Data, 'base64');
  
  try {
    const metadata = await sharp(buffer).metadata();
    const { width = 0, height = 0 } = metadata;
    
    // If already within limits, return as-is
    if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      return { data: base64Data, media_type: mediaType };
    }
    
    logger.info({ 
      originalDimensions: `${width}x${height}`, 
      maxDimension: MAX_DIMENSION 
    }, 'Resizing large image');
    
    const resized = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const newMetadata = await sharp(resized).metadata();
    
    logger.info({ 
      originalSize: buffer.length, 
      newSize: resized.length,
      originalDimensions: `${width}x${height}`,
      newDimensions: `${newMetadata.width}x${newMetadata.height}`,
    }, 'Image resized');
    
    return {
      data: resized.toString('base64'),
      media_type: 'image/jpeg',
    };
  } catch (error) {
    logger.error({ error }, 'Failed to resize image, using original');
    return { data: base64Data, media_type: mediaType };
  }
}
