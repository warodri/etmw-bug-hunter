/**
 * A deliberate HTTP failure.
 *
 * Anything thrown as an `HttpError` is answered with its status and message; a genuine fault is
 * hidden behind a 500 by the error middleware.
 */
export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
