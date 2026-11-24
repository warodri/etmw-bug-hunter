import { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors/http-error';

export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void> | void
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({ success: false, message: 'Route not found.' });
}

export function errorHandler(
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  const statusCode = resolveStatusCode(error);

  if (statusCode >= 500) {
    console.error('[server] Unhandled error:', error);
  } else if (error instanceof HttpError) {
    console.warn(`[server] ${statusCode} ${error.message}`);
  }

  const body: { success: false; message?: string } = { success: false };
  const message = messageFor(error, statusCode);

  if (message) body.message = message;

  response.status(statusCode).json(body);
}

function resolveStatusCode(error: unknown): number {
  if (error instanceof HttpError) return error.statusCode;

  const candidate =
    (error as { status?: unknown; statusCode?: unknown })?.status ??
    (error as { statusCode?: unknown })?.statusCode;

  if (typeof candidate === 'number' && candidate >= 400 && candidate < 500) {
    return candidate;
  }

  return 500;
}

function messageFor(error: unknown, statusCode: number): string | undefined {
  if (error instanceof HttpError) {
    return error.message || 'Internal server error.';
  }

  if (statusCode === 413) return 'That request body is too large.';

  if (statusCode === 400 && (error as { type?: unknown })?.type === 'entity.parse.failed') {
    return 'The request body could not be read.';
  }

  return undefined;
}
