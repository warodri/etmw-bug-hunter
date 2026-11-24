import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { Scan, ScanPage, ScanStartResponse, ScanStatus } from './models/scan.models';

/** Scan history, live status and the two start paths. */
@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly api: ApiService;

  private readonly listState = signal<Scan[]>([]);
  private readonly totalState = signal(0);
  private readonly pageState = signal(1);
  private readonly pageSizeState = signal(20);
  private readonly statusState = signal<ScanStatus>({ running: false, queued: 0, scan: null });

  readonly scans = this.listState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly page = this.pageState.asReadonly();
  readonly pageSize = this.pageSizeState.asReadonly();
  readonly status = this.statusState.asReadonly();

  constructor(api: ApiService) {
    this.api = api;
  }

  async refresh(page = this.pageState()): Promise<void> {
    const response = await firstValueFrom(
      this.api.get<ScanPage>('/scans', { page })
    );

    this.listState.set(response.scans);
    this.totalState.set(response.total);
    this.pageState.set(response.page);
    this.pageSizeState.set(response.pageSize);
  }

  async refreshStatus(): Promise<void> {
    const response = await firstValueFrom(this.api.get<ScanStatus>('/scans/status'));

    this.statusState.set(response);
  }

  async startAll(): Promise<number> {
    const response = await firstValueFrom(
      this.api.post<ScanStartResponse>('/scans/start', { all: true })
    );

    await this.refreshStatus();

    return response.total;
  }

  async startProject(projectId: string): Promise<number> {
    const response = await firstValueFrom(
      this.api.post<ScanStartResponse>('/scans/start', { projectId })
    );

    await this.refreshStatus();

    return response.total;
  }

  async stop(): Promise<void> {
    await firstValueFrom(this.api.post<{ success: boolean }>('/scans/stop'));
    await this.refreshStatus();
  }
}
