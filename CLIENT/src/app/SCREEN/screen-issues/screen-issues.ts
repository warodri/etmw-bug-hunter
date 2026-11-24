import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { IssueService } from '../../SERVICES/issue.service';
import { ProjectService } from '../../SERVICES/project.service';
import { Issue, IssueStatus, Severity } from '../../SERVICES/models/issue.models';

interface SelectOption {
  readonly label: string;
  readonly value: string;
}

/** Issues: the report, filtered and paged. The only write here is triage status. */
@Component({
  selector: 'app-screen-issues',
  standalone: false,
  templateUrl: './screen-issues.html',
  styleUrl: './screen-issues.scss'
})
export class ScreenIssues implements OnInit, OnDestroy {
  private readonly issues = inject(IssueService);
  private readonly projectService = inject(ProjectService);
  private readonly messages = inject(MessageService);

  readonly page = this.issues.page;
  readonly projects = this.projectService.projects;

  readonly projectId = signal('');
  readonly severity = signal('');
  readonly status = signal('open');
  readonly search = signal('');
  readonly busy = signal(false);

  readonly severityOptions: SelectOption[] = [
    { label: 'All severities', value: '' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
    { label: 'Info', value: 'info' }
  ];

  readonly statusOptions: SelectOption[] = [
    { label: 'Open', value: 'open' },
    { label: 'Ignored', value: 'ignored' },
    { label: 'Fixed', value: 'fixed' },
    { label: 'Any status', value: '' }
  ];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  get projectOptions(): SelectOption[] {
    return [
      { label: 'All projects', value: '' },
      ...this.projects().map((project) => ({ label: project.name, value: project.id }))
    ];
  }

  ngOnInit(): void {
    void this.projectService.refresh().catch(() => undefined);
    void this.load(1);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  async load(page = 1): Promise<void> {
    this.busy.set(true);

    try {
      await this.issues.load({
        projectId: this.projectId() || undefined,
        severity: (this.severity() || undefined) as Severity | undefined,
        status: (this.status() || undefined) as IssueStatus | undefined,
        search: this.search(),
        page,
        pageSize: 25
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not load issues',
        detail: apiErrorMessage(error, 'The issue list could not be read.')
      });
    } finally {
      this.busy.set(false);
    }
  }

  onSeverity(value: string): void {
    this.severity.set(value);
    void this.load(1);
  }

  onStatus(value: string): void {
    this.status.set(value);
    void this.load(1);
  }

  onProject(value: string): void {
    this.projectId.set(value);
    void this.load(1);
  }

  onSearch(value: string): void {
    this.search.set(value);

    if (this.searchTimer) clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => void this.load(1), 350);
  }

  onPage(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? 25;
    const first = event.first ?? 0;

    void this.load(Math.floor(first / rows) + 1);
  }

  async toggleStatus(issue: Issue): Promise<void> {
    const next: IssueStatus = issue.status === 'open' ? 'ignored' : 'open';

    try {
      await this.issues.setStatus(issue.id, next);
      await this.load(this.page()?.page ?? 1);
      this.messages.add({
        severity: 'info',
        summary: next === 'ignored' ? 'Issue ignored' : 'Issue reopened',
        detail: `${issue.rule} in ${issue.filePath}.`
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The issue was not updated',
        detail: apiErrorMessage(error, 'The issue status could not be saved.')
      });
    }
  }

  projectName(id: string): string {
    return this.projects().find((project) => project.id === id)?.name ?? 'Unknown project';
  }

  location(issue: Issue): string {
    return issue.line ? `${issue.filePath}:${issue.line}` : issue.filePath;
  }
}
