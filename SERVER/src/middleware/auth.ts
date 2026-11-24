import { NextFunction, Request, RequestHandler, Response } from 'express';

import { HttpError } from '../errors/http-error';
import { AuthService } from '../services/auth.service';

export const SESSION_COOKIE = 'bh_session';

function sessionToken(request: Request): string | null {
  const cookie = request.cookies?.[SESSION_COOKIE];
  if (typeof cookie === 'string' && cookie) return cookie;

  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();

  return null;
}

/**
 * Every route below this middleware needs a real session. The API key path exists only for the
 * desktop agent and is handled at the WebSocket upgrade, not here.
 */
export function createRequireSession(auth: AuthService): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const token = sessionToken(request);

    if (!token) {
      response.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      request.user = auth.verifySession(token);
      next();
    } catch (error) {
      const status = error instanceof HttpError ? error.statusCode : 401;
      response.status(status).json({ success: false, message: 'Authentication required.' });
    }
  };
}
