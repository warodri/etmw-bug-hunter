import { ZodType } from 'zod';

import { HttpError } from '../errors/http-error';

/**
 * Validate a request body.
 *
 * The first issue becomes the sentence the user reads; the dashboard shows it verbatim, so the
 * message is written for a person ("Give the project a name."), not for a log.
 */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});

  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.');
    const message = first?.message ?? 'The request could not be read.';

    throw new HttpError(422, path ? `${path}: ${message}` : message);
  }

  return result.data;
}
