export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export type IssueCategory =
  | 'bug'
  | 'security'
  | 'maintainability'
  | 'performance'
  | 'style'
  | 'todo';

export type IssueStatus = 'open' | 'ignored' | 'fixed';

export interface Issue {
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

export type SeverityCounts = Record<Severity, number>;

export interface IssueCounts {
  readonly total: number;
  readonly bySeverity: SeverityCounts;
}

export interface IssuePage {
  readonly issues: Issue[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly counts: IssueCounts;
}

export interface IssueResponse {
  readonly issue: Issue;
}
