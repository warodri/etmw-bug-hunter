import { Request } from 'express';

import { HttpError } from '../errors/http-error';

/** A path parameter, refusing an empty or malformed id early. */
export function pathParam(request: Request, name: string): string {
  const value = request.params[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `Missing "${name}" in the path.`);
  }

  return value.trim();
}

/** The authenticated account. The session middleware runs before every route that calls this. */
export function currentUserId(request: Request): string {
  const id = request.user?.id;

  if (!id) throw new HttpError(401, 'Authentication required.');

  return id;
}

/** A positive page number from a query string. */
export function pageParam(request: Request, fallback = 1): number {
  const raw = request.query.page;

  if (typeof raw !== 'string') return fallback;

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
