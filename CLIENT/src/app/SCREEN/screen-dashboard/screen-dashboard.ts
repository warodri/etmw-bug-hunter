import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { ScanService } from '../../SERVICES/scan.service';
import { SummaryService } from '../../SERVICES/summary.service';
import { Severity, SeverityCounts } from '../../SERVICES/models/issue.models';
import { ScanState } from '../../SERVICES/models/scan.models';

/** The overview: what is registered, what is open, and what ran last. */
@Component({
  selector: 'app-screen-dashboard',
  standalone: false,
  templateUrl: './screen-dashboard.html',
  styleUrl: './screen-dashboard.scss'
})
export class ScreenDashboard implements OnInit, OnDestroy {
  private readonly summaryService = inject(SummaryService);
  private readonly scans = inject(ScanService);
  private readonly messages = inject(MessageService);

  readonly summary = this.summaryService.summary;
  readonly busy = signal(false);

  private timer: ReturnType<typeof setInterval> | null = null;

  readonly severityRows: readonly { severity: Severity; label: string }[] = [
    { severity: 'critical', label: 'Critical' },
    { severity: 'high', label: 'High' },
    { severity: 'medium', label: 'Medium' },
    { severity: 'low', label: 'Low' },
    { severity: 'info', label: 'Info' }
  ];

  ngOnInit(): void {
    void this.refresh();

    this.timer = setInterval(() => void this.refreshQuietly(), 8_000);
  }

  ngOnDestroy(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  async refresh(): Promise<void> {
    try {
      await this.summaryService.refresh();
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not load the dashboard',
        detail: apiErrorMessage(error, 'The summary could not be read.')
      });
    }
  }

  async startAll(): Promise<void> {
    this.busy.set(true);

    try {
      const count = await this.scans.startAll();
      await this.refresh();

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
      await this.refresh();
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

  share(severity: Severity): number {
    const summary = this.summary();
    const total = summary?.issues.total ?? 0;
    const count = summary?.issues.bySeverity[severity] ?? 0;

    if (total === 0 || count === 0) return 0;

    return Math.max(3, Math.round((count / total) * 100));
  }

  worstOf(counts: SeverityCounts): Severity | null {
    const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of order) {
      if (counts[severity] > 0) return severity;
    }

    return null;
  }

  criticalPlusHigh(): number {
    const summary = this.summary();

    if (!summary) return 0;

    return summary.issues.bySeverity.critical + summary.issues.bySeverity.high;
  }

  lastRunLabel(): string {
    const summary = this.summary();
    const runs = summary?.projects
      .map((row) => row.lastScan?.finishedAt ?? row.lastScan?.startedAt ?? null)
      .filter((value): value is string => value !== null) ?? [];

    if (runs.length === 0) return 'Never';

    const newest = runs.sort().at(-1) ?? null;

    return newest ? new Date(newest).toLocaleString() : 'Never';
  }

  stateLabel(state: ScanState | undefined): string {
    if (!state) return 'Never scanned';
    if (state === 'running') return 'Running';
    if (state === 'queued') return 'Queued';
    if (state === 'done') return 'Done';
    if (state === 'stopped') return 'Stopped';

    return 'Failed';
  }

  stateSeverity(state: ScanState | undefined): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (state === 'running') return 'success';
    if (state === 'done') return 'info';
    if (state === 'queued' || !state) return 'secondary';
    if (state === 'stopped') return 'warn';

    return 'danger';
  }

  private async refreshQuietly(): Promise<void> {
    try {
      await this.summaryService.refresh();
    } catch {
      // The next tick recovers; a toast every 8 seconds would be noise.
    }
  }
}
