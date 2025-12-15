import {describe, it, expect, vi} from 'vitest';
import type {FastifyRequest} from 'fastify';
import {createLogger, logRequest, logResponse, logBackendRequest} from '../../src/utils/logger.js';

describe('logger', () => {
  describe('createLogger', () => {
    it('should create a logger with debug disabled by default', () => {
      const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => { /* mock */ });
      const logger = createLogger(undefined, 'info');
      
      logger.debug('test message', {key: 'value'});
      expect(consoleDebug).not.toHaveBeenCalled();
      
      vi.restoreAllMocks();
    });

    it('should enable debug when level is debug', () => {
      const consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const logger = createLogger(undefined, 'debug');
      
      logger.debug('test message', {key: 'value'});
      expect(consoleDebug).toHaveBeenCalledWith('test message', {key: 'value'});
      
      vi.restoreAllMocks();
    });

    it('should log info messages', () => {
      const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = createLogger(undefined, 'info');
      
      logger.info('test message', {key: 'value'});
      expect(consoleInfo).toHaveBeenCalledWith('test message', {key: 'value'});
      
      vi.restoreAllMocks();
    });

    it('should log warn messages', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = createLogger(undefined, 'info');
      
      logger.warn('test message', {key: 'value'});
      expect(consoleWarn).toHaveBeenCalledWith('test message', {key: 'value'});
      
      vi.restoreAllMocks();
    });

    it('should log error messages', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger(undefined, 'info');
      
      logger.error('test message', {key: 'value'});
      expect(consoleError).toHaveBeenCalledWith('test message', {key: 'value'});
      
      vi.restoreAllMocks();
    });

    it('should use request logger when request is provided', () => {
      const mockRequestLog = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      
      const mockRequest = {
        log: mockRequestLog,
      } as unknown as FastifyRequest;

      const logger = createLogger(mockRequest, 'info');
      
      logger.debug('debug message', {key: 'value'});
      logger.info('info message', {key: 'value'});
      logger.warn('warn message', {key: 'value'});
      logger.error('error message', {key: 'value'});
      
      expect(mockRequestLog.debug).toHaveBeenCalledWith({key: 'value'}, 'debug message');
      expect(mockRequestLog.info).toHaveBeenCalledWith({key: 'value'}, 'info message');
      expect(mockRequestLog.warn).toHaveBeenCalledWith({key: 'value'}, 'warn message');
      expect(mockRequestLog.error).toHaveBeenCalledWith({key: 'value'}, 'error message');
    });
  });

  describe('logRequest', () => {
    it('should log request details at debug level', () => {
      const mockRequestLog = {
        debug: vi.fn(),
      };
      
      const mockRequest = {
        log: mockRequestLog,
        method: 'POST',
        url: '/test',
        headers: {
          'user-agent': 'test-agent',
          'content-type': 'application/json',
          'authorization': 'Bearer token',
        },
      } as unknown as FastifyRequest;

      const logger = createLogger(mockRequest, 'debug');
      const payload = {test: 'data'};
      
      logRequest(logger, mockRequest, payload);
      
      expect(mockRequestLog.debug).toHaveBeenCalled();
      const callArgs = mockRequestLog.debug.mock.calls[0];
      expect(callArgs[1]).toBe('Incoming request');
      expect(callArgs[0].method).toBe('POST');
      expect(callArgs[0].url).toBe('/test');
      expect(callArgs[0].payload).toEqual(payload);
    });
  });

  describe('logResponse', () => {
    it('should log response details at debug level', () => {
      const mockRequestLog = {
        debug: vi.fn(),
      };
      
      const mockRequest = {
        log: mockRequestLog,
        method: 'POST',
        url: '/test',
      } as unknown as FastifyRequest;

      const logger = createLogger(mockRequest, 'debug');
      const response = {result: 'success'};
      
      logResponse(logger, mockRequest, response, 200);
      
      expect(mockRequestLog.debug).toHaveBeenCalled();
      const callArgs = mockRequestLog.debug.mock.calls[0];
      expect(callArgs[1]).toBe('Outgoing response');
      expect(callArgs[0].statusCode).toBe(200);
      expect(callArgs[0].response).toEqual(response);
    });
  });

  describe('logBackendRequest', () => {
    it('should log backend request details at debug level', () => {
      const mockRequestLog = {
        debug: vi.fn(),
      };
      
      const mockRequest = {
        log: mockRequestLog,
      } as unknown as FastifyRequest;

      const logger = createLogger(mockRequest, 'debug');
      const payload = {test: 'data'};
      
      logBackendRequest(logger, 'http://backend.com', payload, 'secret');
      
      expect(mockRequestLog.debug).toHaveBeenCalled();
      const callArgs = mockRequestLog.debug.mock.calls[0];
      expect(callArgs[1]).toBe('Backend request');
      expect(callArgs[0].url).toBe('http://backend.com');
      expect(callArgs[0].auth).toBe('present');
      expect(callArgs[0].payload).toEqual(payload);
    });
  });
});
