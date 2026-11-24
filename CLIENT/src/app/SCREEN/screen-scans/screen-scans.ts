import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { MessageService } from 'primeng/api';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { ScanService } from '../../SERVICES/scan.service';
import { Scan, ScanState } from '../../SERVICES/models/scan.models';

/** Scans: start the background process, watch it, stop it, browse its history. */
@Component({
  selector: 'app-screen-scans',
  standalone: false,
  templateUrl: './screen-scans.html',
  styleUrl: './screen-scans.scss'
})
export class ScreenScans implements OnInit, OnDestroy {
  private readonly scans = inject(ScanService);
  private readonly messages = inject(MessageService);

  readonly history = this.scans.scans;
  readonly total = this.scans.total;
  readonly page = this.scans.page;
  readonly pageSize = this.scans.pageSize;
  readonly status = this.scans.status;

  readonly busy = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;
  private wasRunning = false;

  ngOnInit(): void {
    void this.load();

    this.timer = setInterval(() => void this.poll(), 3_000);
  }

  ngOnDestroy(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  async load(page = 1): Promise<void> {
    try {
      await Promise.all([this.scans.refresh(page), this.scans.refreshStatus()]);
      this.wasRunning = this.status().running;
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not load scans',
        detail: apiErrorMessage(error, 'The scan history could not be read.')
      });
    }
  }

  async startAll(): Promise<void> {
    this.busy.set(true);

    try {
      const count = await this.scans.startAll();

      this.messages.add({
        severity: 'success',
        summary: 'Scans queued',
        detail: count === 1 ? 'One project was queued.' : `${count} projects were queued.`
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The scan did not start',
        detail: apiErrorMessage(error, 'The scan could not be started.')
      });
    } finally {
      this.busy.set(false);
    }
  }

  async stop(): Promise<void> {
    this.busy.set(true);

    try {
      await this.scans.stop();
      this.messages.add({
        severity: 'info',
        summary: 'Stopping',
        detail: 'The active scan stops after the file it is reading now.'
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The scan did not stop',
        detail: apiErrorMessage(error, 'The scan could not be stopped.')
      });
    } finally {
      this.busy.set(false);
    }
  }

  onPage(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    const first = event.first ?? 0;
    const target = Math.floor(first / rows) + 1;

    if (target !== this.page()) void this.load(target);
  }

  progress(scan: Scan): number {
    if (scan.state === 'done') return 100;
    if (scan.totalFiles <= 0) return 0;

    return Math.min(100, Math.round((scan.cursor / scan.totalFiles) * 100));
  }

  stateLabel(state: ScanState): string {
    switch (state) {
      case 'queued':
        return 'Queued';
      case 'running':
        return 'Running';
      case 'done':
        return 'Done';
      case 'stopped':
        return 'Stopped';
      default:
        return 'Failed';
    }
  }

  stateSeverity(state: ScanState): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (state) {
      case 'running':
        return 'success';
      case 'done':
        return 'info';
      case 'queued':
        return 'secondary';
      case 'stopped':
        return 'warn';
      default:
        return 'danger';
    }
  }

  duration(scan: Scan): string {
    if (scan.durationMs === null) return '—';

    const seconds = Math.round(scan.durationMs / 1000);

    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);

    return `${minutes}m ${seconds % 60}s`;
  }

  private async poll(): Promise<void> {
    try {
      await this.scans.refreshStatus();

      const running = this.status().running;

      if (this.wasRunning && !running) await this.scans.refresh(this.page());

      this.wasRunning = running;
    } catch {
      // A single failed poll is not worth a toast; the next tick recovers.
    }
  }
}
