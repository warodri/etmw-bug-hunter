import { NextFunction, Request, RequestHandler, Response } from 'express';

import { appConfig } from '../config/env';

/** CORS for the Angular dev server only; unknown origins are refused, never echoed. */
export function createCorsMiddleware(): RequestHandler {
  const allowed = new Set(appConfig.allowedOrigins);

  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.headers.origin;

    if (origin && allowed.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  };
}
