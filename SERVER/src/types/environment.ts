import {
  DEFAULT_DEV_HOST,
  DEFAULT_DEV_PORT,
  DEFAULT_OLLAMA_URL,
  DEFAULT_PROD_HOST,
  DEFAULT_PROD_PORT
} from '../constants/network';

export type RuntimeEnvironment = 'development' | 'production';

export interface MongoConfig {
  readonly uri: string;
  readonly databaseName: string;
}

export interface ScannerConfig {
  /** A file larger than this is listed and skipped, never read into memory. */
  readonly maxFileBytes: number;
  /** Ceiling on files collected in one walk, so a wrong path cannot walk a whole disk. */
  readonly maxFiles: number;
}

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly sessionDays: number;
  readonly codeTtlMs: number;
  readonly maxAttempts: number;
  readonly rateEmailMax: number;
  readonly rateIpMax: number;
  readonly rateWindowMs: number;
  /** Empty means any valid email may sign in. */
  readonly allowedEmails: readonly string[];
  /** When set, this account adopts data created before accounts existed. */
  readonly ownerEmail: string;
}

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly fromName: string;
  readonly fromAddress: string;
  readonly configured: boolean;
}

export interface AgentConfig {
  /** Public dashboard URL, used in installer instructions. */
  readonly publicUrl: string;
  /** HTTPS API base used by the polling fallback. */
  readonly apiUrl: string;
  /** WebSocket URL the desktop agent dials first. */
  readonly wsUrl: string;
  /** Folder holding the desktop agent source and installers. */
  readonly packageDir: string;
  /** Secret used to derive per-agent bearer tokens. */
  readonly tokenSecret: string;
  readonly maxFileBytes: number;
  readonly maxFiles: number;
}

export interface AppConfig {
  readonly nodeEnv: RuntimeEnvironment;
  readonly port: number;
  readonly host: string;
  readonly allowedOrigins: readonly string[];
  readonly trustProxyHops: number;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMaxRequests: number;
  readonly mongo: MongoConfig;
  readonly scanner: ScannerConfig;
  readonly defaultOllamaUrl: string;
  readonly auth: AuthConfig;
  readonly smtp: SmtpConfig;
  readonly agent: AgentConfig;
}

export type { RuntimeEnvironment as EnvironmentName };
