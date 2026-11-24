import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { SettingsService } from '../../SERVICES/settings.service';
import { AppSettings } from '../../SERVICES/models/settings.models';
import { Severity } from '../../SERVICES/models/issue.models';

interface ModelOption {
  readonly label: string;
  readonly value: string;
}

interface SeverityOption {
  readonly label: string;
  readonly value: Severity;
}

/** Settings: the ignore list, the severity floor and the optional Ollama deep review. */
@Component({
  selector: 'app-screen-settings',
  standalone: false,
  templateUrl: './screen-settings.html',
  styleUrl: './screen-settings.scss'
})
export class ScreenSettings implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly messages = inject(MessageService);
  private readonly formBuilder = inject(FormBuilder);

  readonly settings = this.settingsService.settings;
  readonly detectorCount = this.settingsService.detectorCount;

  readonly form: FormGroup;
  readonly models = signal<ModelOption[]>([]);
  readonly loadingModels = signal(false);
  readonly saving = signal(false);

  readonly severityOptions: SeverityOption[] = [
    { label: 'Everything (including info)', value: 'info' },
    { label: 'Low and above', value: 'low' },
    { label: 'Medium and above', value: 'medium' },
    { label: 'High and above', value: 'high' },
    { label: 'Critical only', value: 'critical' }
  ];

  constructor() {
    this.form = this.formBuilder.group({
      ollamaUrl: ['', [Validators.required]],
      model: [''],
      aiReview: [false],
      aiMaxFiles: [10, [Validators.min(1), Validators.max(50)]],
      minSeverity: ['info' as Severity],
      ignoreGlobs: ['']
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  get aiReviewEnabled(): boolean {
    return this.form.controls['aiReview'].value === true;
  }

  async load(): Promise<void> {
    try {
      await this.settingsService.refresh();

      const settings = this.settingsService.settings();

      if (!settings) return;

      this.form.reset({
        ollamaUrl: settings.ollamaUrl,
        model: settings.model,
        aiReview: settings.aiReview,
        aiMaxFiles: settings.aiMaxFiles,
        minSeverity: settings.minSeverity,
        ignoreGlobs: settings.globalIgnoreGlobs.join(', ')
      });

      if (settings.model) {
        this.models.set([{ label: settings.model, value: settings.model }]);
      }
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not load settings',
        detail: apiErrorMessage(error, 'The settings could not be read.')
      });
    }
  }

  async fetchModels(): Promise<void> {
    const url = String(this.form.controls['ollamaUrl'].value ?? '').trim();

    if (!url) {
      this.messages.add({
        severity: 'warn',
        summary: 'Ollama URL needed',
        detail: 'Enter the endpoint first, then fetch its model list.'
      });
      return;
    }

    this.loadingModels.set(true);

    try {
      const models = await this.settingsService.fetchModels(url);

      this.models.set(models.map((model) => ({ label: model.name, value: model.name })));

      this.messages.add({
        severity: models.length > 0 ? 'success' : 'info',
        summary: models.length > 0 ? `${models.length} model(s) found` : 'No model answered',
        detail: models.length > 0 ? 'Choose one below. Nothing is pulled or copied.' : 'The endpoint answered with an empty list.'
      });

      if (models.length > 0 && !this.form.controls['model'].value) {
        this.form.controls['model'].setValue(models[0].name);
      }
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not reach Ollama',
        detail: apiErrorMessage(error, 'The model list could not be read.')
      });
    } finally {
      this.loadingModels.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue() as {
      ollamaUrl: string;
      model: string;
      aiReview: boolean;
      aiMaxFiles: number;
      minSeverity: Severity;
      ignoreGlobs: string;
    };

    if (value.aiReview && !String(value.model).trim()) {
      this.messages.add({
        severity: 'warn',
        summary: 'Choose a model first',
        detail: 'The AI review needs a model name. Fetch the list and pick one.'
      });
      return;
    }

    const payload: AppSettings = {
      ollamaUrl: value.ollamaUrl.trim(),
      model: String(value.model ?? '').trim(),
      aiReview: value.aiReview,
      aiMaxFiles: Number(value.aiMaxFiles) || 10,
      minSeverity: value.minSeverity,
      globalIgnoreGlobs: value.ignoreGlobs
        .split(',')
        .map((glob) => glob.trim())
        .filter(Boolean),
      updatedAt: this.settings()?.updatedAt ?? null
    };

    this.saving.set(true);

    try {
      await this.settingsService.save(payload);

      this.messages.add({
        severity: 'success',
        summary: 'Settings saved',
        detail: 'The next scan uses these rules.'
      });
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'The settings were not saved',
        detail: apiErrorMessage(error, 'The settings could not be saved.')
      });
    } finally {
      this.saving.set(false);
    }
  }
}
