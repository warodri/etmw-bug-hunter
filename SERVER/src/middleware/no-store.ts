import { NextFunction, Request, Response } from 'express';

/** API answers are always fresh: a stale scan result would be worse than a slow one. */
export function noStore(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  next();
}
