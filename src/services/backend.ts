/**
 * Backend service for proxying requests to LLM backends.
 */

import {createLogger} from '../utils/logger.js';

const logger = createLogger(undefined, process.env.LOG_LEVEL ?? 'info');

/** Calls a backend API endpoint and returns the JSON response. */
export async function callBackend<T>(
  url: string,
  body: unknown,
  auth?: string,
): Promise<T> {
  logger.debug('Calling backend', {url, hasAuth: !!auth});
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (auth) {
    headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    const reqBody = body as {messages?: unknown[]; model?: string; tools?: unknown[]};
    const msgCount = reqBody.messages?.length ?? 0;
    const lastMsg = reqBody.messages?.[msgCount - 1] as {role?: string; tool_calls?: unknown[]} | undefined;
    
    logger.error('Backend API error', {
      url,
      status: response.status,
      model: reqBody.model,
      messageCount: msgCount,
      lastMessageRole: lastMsg?.role,
      hasToolCalls: !!lastMsg?.tool_calls,
      toolCount: reqBody.tools?.length,
      errorPreview: error.slice(0, 1000),
    });
    
    throw new Error(`Backend error: ${response.status} ${error.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

/** Streams a backend API response as chunks. */
export async function* streamBackend(
  url: string,
  body: unknown,
  auth?: string,
): AsyncGenerator<string> {
  logger.debug('Streaming backend request', {url, hasAuth: !!auth});
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (auth) {
    headers['Authorization'] = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
  }

  const bodyStr = JSON.stringify(body);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  });

  if (!response.ok) {
    const error = await response.text();
    // Log detailed error info for debugging
    const reqBody = body as {messages?: unknown[]; model?: string; tools?: unknown[]};
    const msgCount = reqBody.messages?.length ?? 0;
    const lastMsg = reqBody.messages?.[msgCount - 1] as {role?: string; tool_calls?: unknown[]} | undefined;
    
    logger.error('Backend stream error', {
      url,
      status: response.status,
      model: reqBody.model,
      messageCount: msgCount,
      lastMessageRole: lastMsg?.role,
      hasToolCalls: !!lastMsg?.tool_calls,
      toolCount: reqBody.tools?.length,
      errorPreview: error.slice(0, 1000),
    });
    
    throw new Error(`Backend error: ${response.status} ${error.slice(0, 500)}`);
  }

  if (!response.body) {
    logger.error('No response body available from backend');
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      yield decoder.decode(value, {stream: true});
    }
  } finally {
    reader.releaseLock();
  }
}

/** Discovers available models from a backend. */
export async function discoverModels(
  url: string,
  apiKey?: string,
): Promise<string[]> {
  try {
    logger.debug('Discovering models', {url, hasAuth: !!apiKey});
    
    const headers: Record<string, string> = {'Content-Type': 'application/json'};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${url}/v1/models`, {headers});
    if (!response.ok) {
      logger.warn('Failed to discover models', {
        url,
        status: response.status,
      });
      return [];
    }

    const data = (await response.json()) as {data?: {id: string}[]};
    const models = data.data?.map((m) => m.id) ?? [];
    
    logger.info('Discovered models', {url, count: models.length, models});
    
    return models;
  } catch (error) {
    logger.error('Error discovering models', {url, error: error instanceof Error ? error.message : String(error)});
    return [];
  }
}

/** Checks if a backend is healthy. */
export async function checkHealth(url: string): Promise<boolean> {
  try {
    logger.debug('Checking backend health', {url});
    const response = await fetch(`${url}/health`, {method: 'GET'});
    const healthy = response.ok;
    
    if (healthy) {
      logger.info('Backend health check passed', {url});
    } else {
      logger.warn('Backend health check failed', {url, status: response.status});
    }
    
    return healthy;
  } catch (error) {
    logger.error('Backend health check error', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
