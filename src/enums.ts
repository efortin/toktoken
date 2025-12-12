/**
 * HTTP-related constants using standard packages
 */
import { StatusCodes } from 'http-status-codes';
import { lookup } from 'mime-types';

// Re-export StatusCodes for convenience
export { StatusCodes };

// MIME types using mime-types package
export const MimeType = {
  JSON: lookup('.json'),
  SSE: 'text/event-stream', // Not in mime-types database
  TEXT: lookup('.txt'),
} as const;

// SSE streaming headers
export const SSEHeaders = {
  'Content-Type': MimeType.SSE,
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const;
