import { Severity } from '../constants/severity';

export const SCAN_STATES = ['queued', 'running', 'done', 'stopped', 'failed'] as const;

export type ScanState = (typeof SCAN_STATES)[number];

/** Who opens the files: this server or a paired desktop agent. */
export const SCAN_EXECUTORS = ['local', 'agent'] as const;

export type ScanExecutor = (typeof SCAN_EXECUTORS)[number];

export interface ScanError {
  readonly filePath: string;
  readonly message: string;
}

export interface ScanRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectPath: string;
  readonly executor: ScanExecutor;
  readonly state: ScanState;
  /** Index of the next file in the frozen file list; the resumable cursor. */
  readonly cursor: number;
  readonly totalFiles: number;
  readonly filesScanned: number;
  readonly filesSkipped: number;
  readonly issuesFound: number;
  /** The highest severity seen, useful on a compact run row. */
  readonly worstSeverity: Severity | null;
  readonly aiUsed: boolean;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly durationMs: number | null;
  readonly error: string | null;
  readonly errors: readonly ScanError[];
  readonly createdAt: Date;
}

export interface ScanResponse {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectPath: string;
  readonly executor: ScanExecutor;
  readonly state: ScanState;
  readonly cursor: number;
  readonly totalFiles: number;
  readonly filesScanned: number;
  readonly filesSkipped: number;
  readonly issuesFound: number;
  readonly worstSeverity: Severity | null;
  readonly aiUsed: boolean;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly error: string | null;
  readonly errors: readonly ScanError[];
  readonly createdAt: string;
}

export interface ScanProgress {
  /** 0–100, rounded. 0 while the walk is still collecting files. */
  readonly percent: number;
  readonly filesScanned: number;
  readonly totalFiles: number;
}

export function scanProgress(record: ScanRecord): ScanProgress {
  const percent =
    record.totalFiles > 0 ? Math.min(100, Math.round((record.cursor / record.totalFiles) * 100)) : 0;

  return { percent, filesScanned: record.filesScanned, totalFiles: record.totalFiles };
}

export function toScanResponse(record: ScanRecord): ScanResponse {
  return {
    id: record.id,
    projectId: record.projectId,
    projectName: record.projectName,
    projectPath: record.projectPath,
    executor: record.executor,
    state: record.state,
    cursor: record.cursor,
    totalFiles: record.totalFiles,
    filesScanned: record.filesScanned,
    filesSkipped: record.filesSkipped,
    issuesFound: record.issuesFound,
    worstSeverity: record.worstSeverity,
    aiUsed: record.aiUsed,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
    durationMs: record.durationMs,
    error: record.error,
    errors: record.errors,
    createdAt: record.createdAt.toISOString()
  };
}
