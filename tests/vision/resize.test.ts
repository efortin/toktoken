import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resizeImageIfNeeded } from '../../src/vision/resize.js';
import sharp from 'sharp';

// Create a real small PNG image (1x1 red pixel)
async function createTestImage(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
  return buffer.toString('base64');
}

describe('resizeImageIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return original image if within size limits', async () => {
    const smallImage = await createTestImage(100, 100);
    
    const result = await resizeImageIfNeeded(smallImage, 'image/png');
    
    expect(result.data).toBe(smallImage);
    expect(result.media_type).toBe('image/png');
  });

  it('should resize image if width exceeds 1024', async () => {
    const largeImage = await createTestImage(2048, 512);
    
    const result = await resizeImageIfNeeded(largeImage, 'image/png');
    
    // Should be resized to JPEG
    expect(result.media_type).toBe('image/jpeg');
    // Data should be different (resized)
    expect(result.data).not.toBe(largeImage);
    
    // Verify dimensions
    const resizedBuffer = Buffer.from(result.data, 'base64');
    const metadata = await sharp(resizedBuffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1024);
    expect(metadata.height).toBeLessThanOrEqual(1024);
  });

  it('should resize image if height exceeds 1024', async () => {
    const tallImage = await createTestImage(512, 2048);
    
    const result = await resizeImageIfNeeded(tallImage, 'image/png');
    
    expect(result.media_type).toBe('image/jpeg');
    
    const resizedBuffer = Buffer.from(result.data, 'base64');
    const metadata = await sharp(resizedBuffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1024);
    expect(metadata.height).toBeLessThanOrEqual(1024);
  });

  it('should resize image if both dimensions exceed 1024', async () => {
    const hugeImage = await createTestImage(2000, 1500);
    
    const result = await resizeImageIfNeeded(hugeImage, 'image/png');
    
    expect(result.media_type).toBe('image/jpeg');
    
    const resizedBuffer = Buffer.from(result.data, 'base64');
    const metadata = await sharp(resizedBuffer).metadata();
    expect(metadata.width).toBeLessThanOrEqual(1024);
    expect(metadata.height).toBeLessThanOrEqual(1024);
  });

  it('should maintain aspect ratio when resizing', async () => {
    const wideImage = await createTestImage(2048, 1024);
    
    const result = await resizeImageIfNeeded(wideImage, 'image/png');
    
    const resizedBuffer = Buffer.from(result.data, 'base64');
    const metadata = await sharp(resizedBuffer).metadata();
    
    // Original aspect ratio is 2:1, should be maintained
    const aspectRatio = (metadata.width || 0) / (metadata.height || 1);
    expect(aspectRatio).toBeCloseTo(2, 1);
  });

  it('should return original on invalid image data', async () => {
    const invalidData = 'not-valid-base64-image-data';
    
    const result = await resizeImageIfNeeded(invalidData, 'image/png');
    
    // Should return original on error
    expect(result.data).toBe(invalidData);
    expect(result.media_type).toBe('image/png');
  });

  it('should handle image exactly at 1024x1024', async () => {
    const exactImage = await createTestImage(1024, 1024);
    
    const result = await resizeImageIfNeeded(exactImage, 'image/png');
    
    // Should not resize, return original
    expect(result.data).toBe(exactImage);
    expect(result.media_type).toBe('image/png');
  });
});
