import pino from 'pino';

const logger = pino({ level: 'info' });

export async function checkBackendHealth(url: string, name: string): Promise<void> {
  const healthUrl = `${url}/health`;
  const modelsUrl = `${url}/v1/models`;
  
  for (const endpoint of [healthUrl, modelsUrl]) {
    try {
      const response = await fetch(endpoint, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (response.ok || response.status === 401) {
        logger.info({ backend: name, endpoint }, 'Backend reachable');
        return;
      }
    } catch {
      // Try next endpoint
    }
  }
  
  throw new Error(`Backend ${name} unreachable at ${url} - check VLLM_URL`);
}
