import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Agent } from '../../../SERVICES/models/agent.models';
import { Project, ProjectDraft } from '../../../SERVICES/models/project.models';

/**
 * The create/edit dialog for a project.
 *
 * It owns the form and nothing else: the parent saves and decides what a saved project means. A
 * project's ignore list is typed as comma-separated text and turned into an array on submit.
 */
@Component({
  selector: 'app-project-form',
  standalone: false,
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss'
})
export class ProjectForm implements OnChanges {
  @Input() visible = false;
  @Input() project: Project | null = null;
  @Input() saving = false;
  @Input() agents: Agent[] = [];

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() submitted = new EventEmitter<ProjectDraft>();

  readonly form: FormGroup;
  readonly modeOptions = [
    { label: 'This computer (server)', value: 'local' },
    { label: 'Desktop agent', value: 'agent' }
  ];

  constructor(private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      mode: ['local', [Validators.required]],
      agentId: [null],
      path: ['', [Validators.required]],
      description: [''],
      ignoreGlobs: [''],
      enabled: [true]
    });
  }

  get isEdit(): boolean {
    return this.project !== null;
  }

  get isAgent(): boolean {
    return this.form.controls['mode'].value === 'agent';
  }

  /** A fresh mutable array: PrimeNG's option input is not typed for a readonly list. */
  get agentOptions(): Array<{ label: string; value: string }> {
    return this.agents.map((agent) => ({
      label: `${agent.name}${agent.online ? ' (online)' : ' (offline)'}`,
      value: agent.id
    }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project'] && this.visible) {
      this.reset();
    }

    if (changes['visible'] && this.visible) {
      this.reset();
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue() as {
      name: string;
      mode: 'local' | 'agent';
      agentId: string | null;
      path: string;
      description: string;
      ignoreGlobs: string;
      enabled: boolean;
    };

    if (value.mode === 'agent' && !value.agentId) {
      this.form.controls['agentId'].markAsTouched();
      return;
    }

    this.submitted.emit({
      name: value.name.trim(),
      path: value.path.trim(),
      description: value.description.trim(),
      ignoreGlobs: value.ignoreGlobs
        .split(',')
        .map((glob) => glob.trim())
        .filter(Boolean),
      enabled: value.enabled,
      mode: value.mode,
      agentId: value.mode === 'agent' ? value.agentId : null
    });
  }

  private reset(): void {
    this.form.reset({
      name: this.project?.name ?? '',
      mode: this.project?.mode ?? 'local',
      agentId: this.project?.agentId ?? null,
      path: this.project?.path ?? '',
      description: this.project?.description ?? '',
      ignoreGlobs: (this.project?.ignoreGlobs ?? []).join(', '),
      enabled: this.project?.enabled ?? true
    });
  }
}
