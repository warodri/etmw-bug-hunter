import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';

import { ScanService } from '../../SERVICES/scan.service';

interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly link: string;
  readonly hint: string;
  /** Only Scans is a background process, so only it carries the running/stopped dot. */
  readonly process?: boolean;
}

/** The left rail. Adding a screen means adding one route and one entry here. */
@Component({
  selector: 'app-sidebar-nav',
  standalone: false,
  templateUrl: './sidebar-nav.html',
  styleUrl: './sidebar-nav.scss'
})
export class SidebarNav implements OnInit, OnDestroy {
  private readonly scans = inject(ScanService);

  @Input() open = false;
  @Output() navigated = new EventEmitter<void>();

  readonly status = this.scans.status;

  private timer: ReturnType<typeof setInterval> | null = null;

  readonly items: readonly NavItem[] = [
    { label: 'Dashboard', icon: 'pi pi-th-large', link: '/dashboard', hint: 'The state of the codebase' },
    { label: 'Projects', icon: 'pi pi-folder', link: '/projects', hint: 'Folders Bug Hunter may read' },
    { label: 'Scans', icon: 'pi pi-search', link: '/scans', hint: 'Background analysis', process: true },
    { label: 'Issues', icon: 'pi pi-exclamation-triangle', link: '/issues', hint: 'The report' },
    { label: 'Settings', icon: 'pi pi-cog', link: '/settings', hint: 'Ignore rules and AI review' }
  ];

  ngOnInit(): void {
    void this.scans.refreshStatus().catch(() => undefined);

    this.timer = setInterval(() => {
      void this.scans.refreshStatus().catch(() => undefined);
    }, 5_000);
  }

  ngOnDestroy(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  processTitle(): string {
    const status = this.status();

    if (status.running) return 'Running';
    if (status.queued > 0) return `${status.queued} queued`;

    return 'Stopped';
  }
}
