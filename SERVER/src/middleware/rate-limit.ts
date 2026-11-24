import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator, Options } from 'express-rate-limit';

import { appConfig } from '../config/env';

function clientKey(request: Request): string {
  return ipKeyGenerator(request.ip || request.socket.remoteAddress || 'anonymous');
}

function handler(_request: Request, response: Response, _next: unknown, options: Options): void {
  response.status(options.statusCode).json({
    success: false,
    message: 'Too many requests. Please wait a moment and try again.'
  });
}

/** Reads (GET/HEAD/OPTIONS) are exempt: the dashboard polls status endpoints every few seconds. */
export function createRateLimiter() {
  return rateLimit({
    windowMs: appConfig.rateLimitWindowMs,
    limit: appConfig.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip: (request) =>
      request.method === 'GET' ||
      request.method === 'HEAD' ||
      request.method === 'OPTIONS' ||
      request.path.startsWith('/api/agent/'),
    handler
  });
}
