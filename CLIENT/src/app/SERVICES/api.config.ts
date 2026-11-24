/**
 * The client always talks through `/api`, resolved against the app's base href.
 * In development that is `/api` (proxied to 3032); under /apps/bug-hunter/ in
 * production it is `/apps/bug-hunter/api`, which Apache proxies to the API.
 */
export const API_BASE_URL = new URL('api/', document.baseURI).pathname.replace(/\/$/, '');
