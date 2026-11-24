import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { Issue, IssuePage, IssueResponse, IssueStatus, Severity } from './models/issue.models';

export interface IssueQuery {
  readonly projectId?: string;
  readonly scanId?: string;
  readonly severity?: Severity;
  readonly status?: IssueStatus;
  readonly search?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/** The report: a paged read plus the one write — triaging status. */
@Injectable({ providedIn: 'root' })
export class IssueService {
  private readonly api: ApiService;

  private readonly pageState = signal<IssuePage | null>(null);

  readonly page = this.pageState.asReadonly();

  constructor(api: ApiService) {
    this.api = api;
  }

  async load(query: IssueQuery): Promise<IssuePage> {
    const params: Record<string, string | number> = {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25
    };

    if (query.projectId) params['projectId'] = query.projectId;
    if (query.scanId) params['scanId'] = query.scanId;
    if (query.severity) params['severity'] = query.severity;
    if (query.status) params['status'] = query.status;
    if (query.search?.trim()) params['search'] = query.search.trim();

    const response = await firstValueFrom(this.api.get<IssuePage>('/issues', params));

    this.pageState.set(response);

    return response;
  }

  async setStatus(id: string, status: IssueStatus): Promise<Issue> {
    const response = await firstValueFrom(
      this.api.patch<IssueResponse>(`/issues/${id}`, { status })
    );

    return response.issue;
  }
}
