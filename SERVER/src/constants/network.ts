/** Static defaults shared by configuration and the HTTP layer. */

export const DEFAULT_DEV_PORT = 3032;
export const DEFAULT_PROD_PORT = 3032;
export const DEFAULT_DEV_HOST = '127.0.0.1';
export const DEFAULT_PROD_HOST = '127.0.0.1';

/** The Angular development server for this product. */
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:4302',
  'http://127.0.0.1:4302'
];

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
export const DEFAULT_JSON_BODY_LIMIT = '1mb';

/** The shared Ollama tunnel used by the other ETMW projects by default. */
export const DEFAULT_OLLAMA_URL = 'https://ollama--warodri.entertomyworld.com/';

/** Files are read, never written. This is the product's promise, enforced by the scanner. */
export const READ_ONLY_POLICY = 'Bug Hunter never edits, formats or fixes the code it reads.';
