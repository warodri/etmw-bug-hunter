import { Component, OnInit, inject, signal } from '@angular/core';

import { ConfirmationService, MessageService } from 'primeng/api';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { AgentService } from '../../SERVICES/agent.service';
import { ProjectService } from '../../SERVICES/project.service';
import { ScanService } from '../../SERVICES/scan.service';
import { Project, ProjectDraft } from '../../SERVICES/models/project.models';

/** Projects: register a folder, edit it, scan it once, remove it. */
@Component({
  selector: 'app-screen-projects',
  standalone: false,
  templateUrl: './screen-projects.html',
  styleUrl: './screen-projects.scss'
})
export class ScreenProjects implements OnInit {
  private readonly projects = inject(ProjectService);
  private readonly agents = inject(AgentService);
  private readonly scans = inject(ScanService);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  readonly list = this.projects.projects;
  readonly agentList = this.agents.agents;
  readonly loading = this.projects.busy;

  readonly dialogVisible = signal(false);
  readonly editing = signal<Project | null>(null);
  readonly saving = signal(false);
  readonly startingId = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      await this.projects.refresh();
      await this.agents.refresh().catch(() => undefined);
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not load projects',
        detail: apiErrorMessage(error, 'The project list could not be read.')
      });
    }
  }

  openCreate(): void {
    this.editing.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(project: Project): void {
    this.editing.set(project);
    this.dialogVisible.set(true);
  }

  async onSubmitted(draft: ProjectDraft): Promise<void> {
    const editing = this.editing();
    this.saving.set(true);

    try {
      if (editing) {
        await this.projects.update(editing.id, draft);
      } else {
        await this.projects.create(draft);
      }

      this.dialogVisible.set(false);
      this.messages.add({
        severity: 'success',
        summary: editing ? 'Project updated' : 'Project added',
        detail: `${draft.name} is ready to scan.`
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The project was not saved',
        detail: apiErrorMessage(error, 'The project could not be saved.')
      });
    } finally {
      this.saving.set(false);
    }
  }

  async scanNow(project: Project): Promise<void> {
    this.startingId.set(project.id);

    try {
      await this.projects.scanProject(project.id);
      await this.scans.refreshStatus();

      this.messages.add({
        severity: 'success',
        summary: 'Scan queued',
        detail: `${project.name} is next in line. Watch it on the Scans screen.`
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The scan did not start',
        detail: apiErrorMessage(error, 'The scan could not be started.')
      });
    } finally {
      this.startingId.set(null);
    }
  }

  confirmDelete(project: Project): void {
    this.confirmation.confirm({
      header: 'Remove this project?',
      message: `"${project.name}" and its stored scans and issues will be deleted. No file in the folder is touched.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove',
      rejectLabel: 'Keep',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => void this.remove(project)
    });
  }

  private async remove(project: Project): Promise<void> {
    try {
      await this.projects.remove(project.id);
      this.messages.add({
        severity: 'success',
        summary: 'Project removed',
        detail: `${project.name} was removed from Bug Hunter.`
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The project was not removed',
        detail: apiErrorMessage(error, 'The project could not be removed.')
      });
    }
  }
}
