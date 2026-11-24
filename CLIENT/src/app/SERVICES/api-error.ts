import { HttpErrorResponse } from '@angular/common/http';

/** The sentence to show when a request fails: the server's own message wins when it has one. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = (error.error as { message?: unknown } | null)?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (error.status === 0) {
      return 'The ETMW Bug Hunter server cannot be reached. Is it running on port 3032?';
    }
  }

  return fallback;
}
