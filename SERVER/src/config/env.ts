import path from 'node:path';

import dotenv from 'dotenv';

import {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_DEV_HOST,
  DEFAULT_DEV_PORT,
  DEFAULT_JSON_BODY_LIMIT,
  DEFAULT_OLLAMA_URL,
  DEFAULT_PROD_HOST,
  DEFAULT_PROD_PORT,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_RATE_LIMIT_WINDOW_MS
} from '../constants/network';
import { AppConfig, RuntimeEnvironment } from '../types/environment';
import {
  getBooleanEnv,
  getNumberEnv,
  getOptionalEnv,
  getStringListEnv
} from '../utils/env';

dotenv.config();

function resolveNodeEnv(): RuntimeEnvironment {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

const nodeEnv = resolveNodeEnv();

/** A production server must not sign sessions with a known development key. */
const jwtSecret = getOptionalEnv(
  'JWT_SECRET',
  nodeEnv === 'production' ? '' : 'dev-only-etmw-bug-hunter-session-secret'
);

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required in production.');
}

const publicUrl = getOptionalEnv(
  'BUG_HUNTER_PUBLIC_URL',
  'https://entertomyworld.com/apps/bug-hunter/'
);

const derivedWsUrl = `${publicUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/agent`;

const smtpHost = getOptionalEnv('SMTP_HOST', '');
const smtpUser = getOptionalEnv('SMTP_USERNAME', getOptionalEnv('SMTP_USER', ''));
const smtpPass = getOptionalEnv('SMTP_PASSWORD', getOptionalEnv('SMTP_PASS', ''));

export const appConfig: AppConfig = {
  nodeEnv,
  port: getNumberEnv('PORT', nodeEnv === 'production' ? DEFAULT_PROD_PORT : DEFAULT_DEV_PORT),
  host: getOptionalEnv('HOST', nodeEnv === 'production' ? DEFAULT_PROD_HOST : DEFAULT_DEV_HOST),
  allowedOrigins: getStringListEnv('CORS_ALLOWED_ORIGINS', DEFAULT_ALLOWED_ORIGINS),
  trustProxyHops: getNumberEnv('TRUST_PROXY_HOPS', 0),
  rateLimitWindowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', DEFAULT_RATE_LIMIT_WINDOW_MS),
  rateLimitMaxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  mongo: {
    uri: getOptionalEnv('MONGODB_URI', ''),
    databaseName: getOptionalEnv('MONGODB_DATABASE', 'etmw_bug_hunter')
  },
  scanner: {
    maxFileBytes: getNumberEnv('BUG_HUNTER_MAX_FILE_BYTES', 512 * 1024),
    maxFiles: getNumberEnv('BUG_HUNTER_MAX_FILES', 20_000)
  },
  defaultOllamaUrl: getOptionalEnv('BUG_HUNTER_OLLAMA_URL', DEFAULT_OLLAMA_URL),
  auth: {
    jwtSecret,
    sessionDays: getNumberEnv('AUTH_SESSION_DAYS', 30),
    codeTtlMs: getNumberEnv('AUTH_CODE_TTL_MINUTES', 10) * 60 * 1000,
    maxAttempts: getNumberEnv('AUTH_CODE_MAX_ATTEMPTS', 5),
    rateEmailMax: getNumberEnv('AUTH_CODE_RATE_EMAIL_MAX', 5),
    rateIpMax: getNumberEnv('AUTH_CODE_RATE_IP_MAX', 15),
    rateWindowMs: getNumberEnv('AUTH_CODE_RATE_WINDOW_MINUTES', 10) * 60 * 1000,
    allowedEmails: getStringListEnv('AUTH_ALLOWED_EMAILS', []),
    ownerEmail: getOptionalEnv('OWNER_EMAIL', '')
  },
  smtp: {
    host: smtpHost,
    port: getNumberEnv('SMTP_PORT', 465),
    secure: getBooleanEnv('SMTP_SECURE', true),
    user: smtpUser,
    pass: smtpPass,
    fromName: getOptionalEnv('EMAIL_FROM_NAME', 'ETMW Bug Hunter'),
    fromAddress: getOptionalEnv('EMAIL_FROM_ADDRESS', smtpUser),
    configured: Boolean(smtpHost && smtpUser && smtpPass)
  },
  agent: {
    publicUrl,
    apiUrl: getOptionalEnv(
      'BUG_HUNTER_AGENT_API_URL',
      `${publicUrl.replace(/\/+$/, '')}/api`
    ),
    wsUrl: getOptionalEnv('BUG_HUNTER_AGENT_WS_URL', derivedWsUrl),
    packageDir: getOptionalEnv(
      'BUG_HUNTER_AGENT_DIR',
      path.resolve(process.cwd(), '..', 'CLIENT', 'DESKTOP')
    ),
    tokenSecret: getOptionalEnv('BUG_HUNTER_AGENT_SECRET', jwtSecret),
    maxFileBytes: getNumberEnv('BUG_HUNTER_MAX_FILE_BYTES', 512 * 1024),
    maxFiles: getNumberEnv('BUG_HUNTER_MAX_FILES', 20_000)
  }
};

export { DEFAULT_JSON_BODY_LIMIT };
