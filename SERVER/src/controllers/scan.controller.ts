import { Request, Response } from 'express';

import { HttpError } from '../errors/http-error';
import { toScanResponse } from '../models/scan.model';
import { ScanRepository } from '../repositories/scan.repository';
import { ProjectService } from '../services/project.service';
import { ScanRunner } from '../services/scan-runner.service';
import { currentUserId, pageParam, pathParam } from '../utils/request';
import { parseBody } from '../validation/parse';
import { startScanSchema } from '../validation/scan.validation';

const PAGE_SIZE = 20;

/** `/scans` — start, stop, browse and poll background scans. */
export class ScanController {
  constructor(
    private readonly runner: ScanRunner,
    private readonly scans: ScanRepository,
    private readonly projects: ProjectService
  ) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const page = pageParam(request);
    const projectId =
      typeof request.query.projectId === 'string' ? request.query.projectId : undefined;
    const result = await this.scans.list(currentUserId(request), page, PAGE_SIZE, projectId);

    response.json({
      scans: result.scans.map(toScanResponse),
      total: result.total,
      page,
      pageSize: PAGE_SIZE
    });
  };

  get = async (request: Request, response: Response): Promise<void> => {
    const scan = await this.scans.findById(currentUserId(request), pathParam(request, 'id'));

    if (!scan) throw new HttpError(404, 'That scan does not exist.');

    response.json({ scan: toScanResponse(scan) });
  };

  status = async (request: Request, response: Response): Promise<void> => {
    const ownerId = currentUserId(request);
    const active = await this.scans.findLatestRunning(ownerId);

    response.json({
      running: Boolean(active && active.state === 'running'),
      queued: await this.scans.countQueued(ownerId),
      scan: active ? toScanResponse(active) : null
    });
  };

  start = async (request: Request, response: Response): Promise<void> => {
    const ownerId = currentUserId(request);
    const input = parseBody(startScanSchema, request.body);
    const projectIds = await this.resolveProjectIds(ownerId, input);

    if (projectIds.length === 0) {
      throw new HttpError(422, 'There is no enabled project to scan.');
    }

    const scans = await this.runner.start(ownerId, projectIds);

    response.status(202).json({ scans: scans.map(toScanResponse), total: scans.length });
  };

  stop = async (request: Request, response: Response): Promise<void> => {
    const ownerId = currentUserId(request);

    await this.runner.stop(ownerId);

    const active = await this.scans.findLatestRunning(ownerId);

    response.json({ success: true, running: Boolean(active && active.state === 'running') });
  };

  private async resolveProjectIds(
    ownerId: string,
    input: {
      projectId?: string;
      projectIds?: string[];
      all?: boolean;
    }
  ): Promise<string[]> {
    if (input.all) {
      const projects = await this.projects.list(ownerId, false);

      return projects.map((project) => project.id);
    }

    const ids = input.projectIds?.length
      ? input.projectIds
      : input.projectId
        ? [input.projectId]
        : [];

    return [...new Set(ids)];
  }
}
