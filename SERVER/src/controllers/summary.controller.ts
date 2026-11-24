import { Request, Response } from 'express';

import { toProjectResponse } from '../models/project.model';
import { toScanResponse } from '../models/scan.model';
import { IssueRepository } from '../repositories/issue.repository';
import { ScanRepository } from '../repositories/scan.repository';
import { DETECTOR_COUNT } from '../services/scanner/detectors';
import { ProjectService } from '../services/project.service';
import { currentUserId } from '../utils/request';

/**
 * `/summary` — one request for the dashboard.
 *
 * The project table needs an open-issue count and a last-run state per project; doing that here,
 * once, keeps the dashboard from firing a request per card on every poll.
 */
export class SummaryController {
  constructor(
    private readonly projects: ProjectService,
    private readonly scans: ScanRepository,
    private readonly issues: IssueRepository
  ) {}

  get = async (request: Request, response: Response): Promise<void> => {
    const ownerId = currentUserId(request);
    const projects = await this.projects.list(ownerId);
    const issues = await this.issues.counts(ownerId, {});
    const scanPage = await this.scans.list(ownerId, 1, 1);
    const active = await this.scans.findLatestRunning(ownerId);

    const projectRows = await Promise.all(
      projects.map(async (project) => {
        const [latestScan, counts] = await Promise.all([
          this.scans.findLatestForProject(ownerId, project.id),
          this.issues.counts(ownerId, { projectId: project.id })
        ]);

        return {
          project: toProjectResponse(project),
          lastScan: latestScan ? toScanResponse(latestScan) : null,
          open: counts
        };
      })
    );

    response.json({
      projectsTotal: projects.length,
      projectsEnabled: projects.filter((project) => project.enabled).length,
      detectorCount: DETECTOR_COUNT,
      issues,
      scansTotal: scanPage.total,
      running: Boolean(active && active.state === 'running'),
      queued: await this.scans.countQueued(ownerId),
      projects: projectRows
    });
  };
}
