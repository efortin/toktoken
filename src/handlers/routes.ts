import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RouterConfig, AnthropicRequest, OpenAIRequest } from '../types/index.js';
import type { AnthropicRouter } from '../router.js';
import { StatusCodes, SSEHeaders } from '../enums.js';

export interface RouteHandlerContext {
  router: AnthropicRouter;
  config: RouterConfig;
}

export function createAnthropicMessagesHandler(ctx: RouteHandlerContext) {
  return async (request: FastifyRequest<{ Body: AnthropicRequest }>, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const body = request.body; // Already validated by Fastify

    try {
      if (body.stream) {
        reply.raw.writeHead(StatusCodes.OK, SSEHeaders);
        
        try {
          for await (const chunk of ctx.router.handleAnthropicStreamingRequest(body, authHeader)) {
            reply.raw.write(chunk);
          }
        } catch (streamError: unknown) {
          const errorEvent = `data: ${JSON.stringify({
            type: 'error',
            error: { type: 'api_error', message: streamError instanceof Error ? streamError.message : 'Unknown error' }
          })}\n\n`;
          reply.raw.write(errorEvent);
        }
        
        reply.raw.end();
        reply.hijack();
        return;
      } else {
        return await ctx.router.handleAnthropicRequest(body, authHeader);
      }
    } catch (error: unknown) {
      request.log.error({ err: error }, 'Anthropic request failed');
      if (!reply.sent) {
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
        return { error: { type: 'api_error', message: error instanceof Error ? error.message : 'Unknown error' } };
      }
    }
  };
}

export function createOpenAIChatHandler(ctx: RouteHandlerContext) {
  return async (request: FastifyRequest<{ Body: OpenAIRequest }>, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    const body = request.body; // Already validated by Fastify

    try {
      if (body.stream) {
        reply.raw.writeHead(StatusCodes.OK, SSEHeaders);
        
        for await (const chunk of ctx.router.handleOpenAIStreamingRequest(body, authHeader)) {
          reply.raw.write(chunk);
        }
        
        reply.raw.end();
        reply.hijack();
        return;
      } else {
        return await ctx.router.handleOpenAIRequest(body, authHeader);
      }
    } catch (error: unknown) {
      request.log.error({ err: error }, 'OpenAI request failed');
      if (!reply.sent) {
        reply.code(StatusCodes.INTERNAL_SERVER_ERROR);
        return { error: { message: error instanceof Error ? error.message : 'Unknown error', type: 'api_error' } };
      }
    }
  };
}

export function createHealthHandler() {
  return async () => ({ status: 'ok' });
}

export function createStatsHandler(ctx: RouteHandlerContext) {
  return async () => ctx.router.getTelemetryStats();
}

export function createModelsHandler(ctx: RouteHandlerContext) {
  return async () => ({
    object: 'list',
    data: [{
      id: ctx.config.defaultBackend.model,
      object: 'model',
      created: Date.now(),
      owned_by: 'vllm',
    }],
  });
}
