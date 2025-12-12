import Fastify from 'fastify';
import cors from '@fastify/cors';
import pino from 'pino';
import { loadConfig } from './config.js';
import { AnthropicRouter } from './router.js';
import {
  handleTokenCount,
  createAnthropicMessagesHandler,
  createOpenAIChatHandler,
  createHealthHandler,
  createStatsHandler,
  createModelsHandler,
} from './handlers/index.js';
import { checkBackendHealth } from './init.js';

const logger = pino({ level: 'info' });

async function main() {
  const config = loadConfig();
  
  // Verify backend connectivity before starting
  logger.info('Checking backend connectivity');
  await checkBackendHealth(config.defaultBackend.url, config.defaultBackend.name);
  
  if (config.visionBackend) {
    await checkBackendHealth(config.visionBackend.url, config.visionBackend.name);
  }
  
  const router = new AnthropicRouter(config);

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true }
      }
    }
  });

  await app.register(cors, { origin: true });

  const ctx = { router, config };

  // Routes
  app.get('/health', createHealthHandler());
  app.get('/stats', createStatsHandler(ctx));
  app.get('/v1/models', createModelsHandler(ctx));
  app.post('/v1/messages/count_tokens', async (request) => handleTokenCount(request.body));
  app.post('/v1/messages', createAnthropicMessagesHandler(ctx));
  app.post('/v1/chat/completions', createOpenAIChatHandler(ctx));

  // Start server
  const host = config.host;
  const port = config.port;
  
  await app.listen({ host, port });
  
  logger.info({
    host,
    port,
    backend: config.defaultBackend.url,
    model: config.defaultBackend.model,
    telemetry: config.telemetry.enabled
  }, 'Server started');
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
