import { IssueCounts } from './issue.models';
import { Project } from './project.models';
import { Scan } from './scan.models';

export interface ProjectSummaryRow {
  readonly project: Project;
  readonly lastScan: Scan | null;
  readonly open: IssueCounts;
}

export interface Summary {
  readonly projectsTotal: number;
  readonly projectsEnabled: number;
  readonly detectorCount: number;
  readonly issues: IssueCounts;
  readonly scansTotal: number;
  readonly running: boolean;
  readonly queued: number;
  readonly projects: ProjectSummaryRow[];
}
