import { Request, Response } from 'express';

import { SEVERITY_ORDER, Severity } from '../constants/severity';
import { ISSUE_STATUSES, IssueStatus, toIssueResponse } from '../models/issue.model';
import { IssueFilters, IssueRepository } from '../repositories/issue.repository';
import { currentUserId, pageParam, pathParam } from '../utils/request';
import { parseBody } from '../validation/parse';
import { updateIssueSchema } from '../validation/scan.validation';

const DEFAULT_PAGE_SIZE = 25;

/** `/issues` — the report. Reading and triaging only; a fix is the owner's work. */
export class IssueController {
  constructor(private readonly issues: IssueRepository) {}

  list = async (request: Request, response: Response): Promise<void> => {
    const ownerId = currentUserId(request);
    const page = pageParam(request);
    const pageSize = clampPageSize(request.query.pageSize);
    const filters: IssueFilters = {
      scanId: asString(request.query.scanId),
      projectId: asString(request.query.projectId),
      severity: asSeverity(request.query.severity),
      status: asStatus(request.query.status),
      detectorId: asString(request.query.detectorId),
      search: asString(request.query.search)
    };

    const result = await this.issues.list(ownerId, filters, page, pageSize);
    const counts = await this.issues.counts(ownerId, {
      projectId: filters.projectId,
      scanId: filters.scanId
    });

    response.json({
      issues: result.issues.map(toIssueResponse),
      total: result.total,
      page,
      pageSize,
      counts
    });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(updateIssueSchema, request.body);
    const issue = await this.issues.setStatus(
      currentUserId(request),
      pathParam(request, 'id'),
      input.status
    );

    if (!issue) {
      response.status(404).json({ success: false, message: 'That issue does not exist.' });
      return;
    }

    response.json({ issue: toIssueResponse(issue) });
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asSeverity(value: unknown): Severity | undefined {
  const candidate = asString(value);

  return candidate && (SEVERITY_ORDER as readonly string[]).includes(candidate)
    ? (candidate as Severity)
    : undefined;
}

function asStatus(value: unknown): IssueStatus | undefined {
  const candidate = asString(value);

  return candidate && (ISSUE_STATUSES as readonly string[]).includes(candidate)
    ? (candidate as IssueStatus)
    : undefined;
}

function clampPageSize(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;

  return Math.min(100, Math.max(5, parsed));
}
