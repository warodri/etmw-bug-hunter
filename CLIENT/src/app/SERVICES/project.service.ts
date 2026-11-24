import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { Project, ProjectDraft, ProjectListResponse, ProjectResponse } from './models/project.models';
import { ScanStartResponse } from './models/scan.models';

/** The project list plus its writes. Components read `projects()`; nothing else caches it. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly api: ApiService;

  private readonly state = signal<Project[]>([]);
  private readonly busyState = signal(false);

  readonly projects = this.state.asReadonly();
  readonly busy = this.busyState.asReadonly();

  constructor(api: ApiService) {
    this.api = api;
  }

  async refresh(): Promise<void> {
    this.busyState.set(true);

    try {
      const response = await firstValueFrom(this.api.get<ProjectListResponse>('/projects'));
      this.state.set(response.projects);
    } finally {
      this.busyState.set(false);
    }
  }

  async create(draft: ProjectDraft): Promise<Project> {
    const response = await firstValueFrom(
      this.api.post<ProjectResponse>('/projects', draft)
    );

    await this.refresh();

    return response.project;
  }

  async update(id: string, draft: ProjectDraft): Promise<Project> {
    const response = await firstValueFrom(
      this.api.patch<ProjectResponse>(`/projects/${id}`, draft)
    );

    await this.refresh();

    return response.project;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.api.delete<{ success: boolean }>(`/projects/${id}`));
    await this.refresh();
  }

  async scanProject(id: string): Promise<number> {
    const response = await firstValueFrom(
      this.api.post<ScanStartResponse>('/scans/start', { projectId: id })
    );

    return response.total;
  }
}
