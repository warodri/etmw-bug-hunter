import { Severity } from '../constants/severity';

/** The breadth of a finding, used by the Issues screen filters and the dashboard. */
export const ISSUE_CATEGORIES = [
  'bug',
  'security',
  'maintainability',
  'performance',
  'style',
  'todo'
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_STATUSES = ['open', 'ignored', 'fixed'] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface IssueRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly scanId: string;
  readonly projectId: string;
  /** Directory-relative, so a report never depends on the machine's absolute path. */
  readonly filePath: string;
  readonly line: number | null;
  readonly column: number | null;
  readonly detectorId: string;
  readonly rule: string;
  readonly category: IssueCategory;
  readonly severity: Severity;
  readonly message: string;
  /** The offending source line, trimmed to a readable length. */
  readonly snippet: string;
  /** True when the issue came from the optional Ollama deep review. */
  readonly aiGenerated: boolean;
  readonly status: IssueStatus;
  readonly createdAt: Date;
}

export interface IssueResponse {
  readonly id: string;
  readonly scanId: string;
  readonly projectId: string;
  readonly filePath: string;
  readonly line: number | null;
  readonly column: number | null;
  readonly detectorId: string;
  readonly rule: string;
  readonly category: IssueCategory;
  readonly severity: Severity;
  readonly message: string;
  readonly snippet: string;
  readonly aiGenerated: boolean;
  readonly status: IssueStatus;
  readonly createdAt: string;
}

export interface IssueCounts {
  readonly total: number;
  readonly bySeverity: Record<Severity, number>;
}

export function toIssueResponse(record: IssueRecord): IssueResponse {
  return {
    id: record.id,
    scanId: record.scanId,
    projectId: record.projectId,
    filePath: record.filePath,
    line: record.line,
    column: record.column,
    detectorId: record.detectorId,
    rule: record.rule,
    category: record.category,
    severity: record.severity,
    message: record.message,
    snippet: record.snippet,
    aiGenerated: record.aiGenerated,
    status: record.status,
    createdAt: record.createdAt.toISOString()
  };
}
