import { Severity } from '../constants/severity';

/**
 * The single Settings document.
 *
 * `aiReview` is opt-in: a static scan is instant and offline, while the optional Ollama pass
 * reads a handful of the largest files and costs model time. Nothing here can change the policy
 * that Bug Hunter only reports.
 */
export interface SettingsRecord {
  readonly ollamaUrl: string;
  readonly model: string;
  readonly aiReview: boolean;
  /** How many files the optional AI pass may read in one scan (1–50). */
  readonly aiMaxFiles: number;
  /** Findings below this severity are not stored. */
  readonly minSeverity: Severity;
  /** Extra directory-relative globs skipped for every project. */
  readonly globalIgnoreGlobs: readonly string[];
  readonly updatedAt: Date | null;
}

export const DEFAULT_GLOBAL_IGNORE_GLOBS = [
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.next',
  '.nuxt',
  '.angular',
  '.cache',
  'vendor',
  'target',
  'Pods',
  'DerivedData',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock'
] as const;
