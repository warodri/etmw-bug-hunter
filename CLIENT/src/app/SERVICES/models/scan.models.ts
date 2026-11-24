import { Severity } from './issue.models';

export type ScanState = 'queued' | 'running' | 'done' | 'stopped' | 'failed';

export interface ScanErrorItem {
  readonly filePath: string;
  readonly message: string;
}

export interface Scan {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectPath: string;
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
  readonly errors: readonly ScanErrorItem[];
  readonly createdAt: string;
}

export interface ScanPage {
  readonly scans: Scan[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface ScanStatus {
  readonly running: boolean;
  readonly queued: number;
  readonly scan: Scan | null;
}

export interface ScanStartResponse {
  readonly scans: Scan[];
  readonly total: number;
}
