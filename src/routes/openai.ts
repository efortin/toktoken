import type {FastifyInstance, FastifyReply} from 'fastify';
import fp from 'fastify-plugin';

import type {OpenAIRequest, OpenAIResponse} from '../types/index.js';
import {callBackend, streamBackend} from '../services/backend.js';
import {
  SSE_HEADERS,
  StatusCodes,
  createApiError,
  formatSseError,
  getBackendAuth,
  hasOpenAIImages,
  stripOpenAIImages,
  normalizeOpenAIToolIds,
} from '../utils/index.js';

async function openaiRoutes(app: FastifyInstance): Promise<void> {
  // Handler for completions (legacy endpoint)
  const handleCompletions = async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const authHeader = request.headers.authorization;
    const backend = app.config.defaultBackend;

    try {
      if (body.stream) {
        reply.raw.writeHead(200, SSE_HEADERS);
        for await (const chunk of streamBackend(
          `${backend.url}/v1/completions`,
          {...body, model: backend.model || body.model},
          getBackendAuth(backend, authHeader),
        )) {
          reply.raw.write(chunk);
        }
        reply.raw.end();
        reply.hijack();
        return;
      }

      const result = await callBackend(
        `${backend.url}/v1/completions`,
        {...body, model: backend.model || body.model},
        getBackendAuth(backend, authHeader),
      );
      return result;
    } catch (error) {
      request.log.error({err: error}, 'Completions request failed');
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
      return createApiError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Register completions routes (with and without /v1 prefix)
  app.post('/v1/completions', handleCompletions);
  app.post('/completions', handleCompletions);

  // Handler for chat completions
  const handleChatCompletions = async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    const startTime = Date.now();
    const user = request.userEmail;
    const body = request.body as OpenAIRequest;
    const authHeader = request.headers.authorization;

    const visionBackend = app.config.visionBackend;
    const useVision = hasOpenAIImages(body) && !!visionBackend;
    const backend = useVision && visionBackend ? visionBackend : app.config.defaultBackend;

    try {
      if (body.stream) {
        return handleStream(app, reply, body, backend, useVision, authHeader, user, startTime);
      }

      // Strip images and normalize tool IDs for Mistral compatibility
      const strippedBody = useVision ? body : stripOpenAIImages(body);
      const requestBody = normalizeOpenAIToolIds(strippedBody);
      const result = await callBackend<OpenAIResponse>(
        `${backend.url}/v1/chat/completions`,
        {...requestBody, model: backend.model || body.model},
        getBackendAuth(backend, authHeader),
      );

      recordMetrics(app, user, backend.model, startTime, 'ok', result.usage);
      return result;
    } catch (error) {
      recordMetrics(app, user, backend.model, startTime, 'error');
      request.log.error({err: error}, 'Request failed');
      reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
      return createApiError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Register chat completions route
  app.post('/v1/chat/completions', handleChatCompletions);
}

async function handleStream(
  app: FastifyInstance,
  reply: FastifyReply,
  body: OpenAIRequest,
  backend: {url: string; apiKey: string; model: string},
  useVision: boolean,
  authHeader: string | undefined,
  user: string,
  startTime: number,
): Promise<void> {
  // Strip images and normalize tool IDs for Mistral compatibility
  const strippedBody = useVision ? body : stripOpenAIImages(body);
  const requestBody = normalizeOpenAIToolIds(strippedBody);
  
  // Get the stream generator - this will throw on connection errors
  let stream: AsyncGenerator<string>;
  try {
    stream = streamBackend(
      `${backend.url}/v1/chat/completions`,
      {...requestBody, model: backend.model || body.model, stream: true},
      getBackendAuth(backend, authHeader),
    );
    // Try to get first chunk to verify connection works
    const firstResult = await stream.next();
    if (firstResult.done) {
      throw new Error('Empty response from backend');
    }
    // Connection works, now send 200 and stream
    reply.raw.writeHead(200, SSE_HEADERS);
    reply.raw.write(firstResult.value);
  } catch (error) {
    // Connection failed - return proper error status
    recordMetrics(app, user, backend.model, startTime, 'error');
    reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
    reply.send(createApiError(error instanceof Error ? error.message : 'Backend connection failed'));
    return;
  }

  try {
    for await (const chunk of stream) {
      reply.raw.write(chunk);
    }
    recordMetrics(app, user, backend.model, startTime, 'ok');
  } catch (error) {
    reply.raw.write(formatSseError(error));
    recordMetrics(app, user, backend.model, startTime, 'error');
  }

  reply.raw.end();
  reply.hijack();
}

function recordMetrics(
  app: FastifyInstance,
  user: string,
  model: string,
  startTime: number,
  status: string,
  usage?: {prompt_tokens: number; completion_tokens: number},
): void {
  app.metrics.requestsTotal.inc({user, model, endpoint: 'openai', status});
  app.metrics.requestDuration.observe(
    {user, model, endpoint: 'openai'},
    (Date.now() - startTime) / 1000,
  );
  if (usage) {
    app.metrics.tokensTotal.inc({user, model, type: 'input'}, usage.prompt_tokens);
    app.metrics.tokensTotal.inc({user, model, type: 'output'}, usage.completion_tokens);
  }
}

export default fp(openaiRoutes, {name: 'openai-routes'});
