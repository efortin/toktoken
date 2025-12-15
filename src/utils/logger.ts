/**
 * Centralized logging utility with debug support.
 * Uses Fastify's request logger when available, falls back to console.
 */

import type {FastifyRequest} from 'fastify';

export interface Logger {
  /**
   * Log at debug level (only shown when LOG_LEVEL=debug)
   * Use for detailed request/response payloads, internal state, etc.
   */
  debug(msg: string, meta?: unknown): void;
  
  /**
   * Log at info level (default)
   * Use for normal operation messages, startups, shutdowns, etc.
   */
  info(msg: string, meta?: unknown): void;
  
  /**
   * Log at warn level
   * Use for recoverable issues, deprecated features, etc.
   */
  warn(msg: string, meta?: unknown): void;
  
  /**
   * Log at error level
   * Use for unrecoverable issues, exceptions, etc.
   */
  error(msg: string, meta?: unknown): void;
}

/**
 * Creates a logger that adapts to the context.
 * If a Fastify request is provided, uses its logger.
 * Otherwise, creates a standalone logger with the given level.
 */
export function createLogger(
  request?: FastifyRequest,
  level = 'info'
): Logger {
  // If we have a Fastify request, use its logger
  if (request) {
    return {
      debug: (msg, meta) => request.log.debug(meta, msg),
      info: (msg, meta) => request.log.info(meta, msg),
      warn: (msg, meta) => request.log.warn(meta, msg),
      error: (msg, meta) => request.log.error(meta, msg),
    };
  }
  
  // Fallback logger for non-request contexts
  const isDebug = level === 'debug';
  
  return {
    debug: (msg, meta) => {
      if (isDebug) {
        console.debug(msg, meta);
      }
    },
    info: (msg, meta) => console.info(msg, meta),
    warn: (msg, meta) => console.warn(msg, meta),
    error: (msg, meta) => console.error(msg, meta),
  };
}

/**
 * Logs request details at debug level.
 * Useful for debugging incoming requests without cluttering logs at info level.
 */
export function logRequest(
  logger: Logger,
  request: FastifyRequest,
  payload?: unknown
): void {
  logger.debug('Incoming request', {
    method: request.method,
    url: request.url,
    headers: {
      'user-agent': request.headers['user-agent'],
      'content-type': request.headers['content-type'],
      'authorization': request.headers['authorization'] ? 'present' : 'absent',
    },
    payload: payload ? sanitizePayload(payload) : undefined,
  });
}

/**
 * Logs response details at debug level.
 */
export function logResponse(
  logger: Logger,
  request: FastifyRequest,
  response: unknown,
  statusCode: number
): void {
  logger.debug('Outgoing response', {
    method: request.method,
    url: request.url,
    statusCode,
    response: response ? sanitizePayload(response) : undefined,
  });
}

/**
 * Logs backend request details at debug level.
 */
export function logBackendRequest(
  logger: Logger,
  url: string,
  payload: unknown,
  auth?: string
): void {
  logger.debug('Backend request', {
    url,
    auth: auth ? 'present' : 'absent',
    payload: sanitizePayload(payload),
  });
}

/**
 * Sanitizes payload to avoid logging sensitive data or excessively large objects.
 */
function sanitizePayload(payload: unknown, _maxDepth = 3, maxLength = 1000): unknown {
  if (typeof payload !== 'object' || payload === null) {
    return payload;
  }
  
  try {
    const str = JSON.stringify(payload, (key, value) => {
      // Redact sensitive fields
      if (typeof value === 'string' && 
          (key === 'apiKey' || key === 'API_KEY' || key === 'authorization' || key.endsWith('_key'))) {
        return '***REDACTED***';
      }
      return value;
    });
    
    if (str.length > maxLength) {
      return `[Truncated: ${str.length} chars > ${maxLength} max]`;
    }
    
    return payload;
  } catch (e) {
    return `[Failed to serialize: ${e instanceof Error ? e.message : String(e)}]`;
  }
}
