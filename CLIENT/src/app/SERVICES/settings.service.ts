import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import {
  AppSettings,
  OllamaModel,
  OllamaModelsResponse,
  SettingsResponse
} from './models/settings.models';

/** Settings plus the model list the Ollama endpoint reports. Nothing here pulls a model. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly api: ApiService;

  private readonly state = signal<AppSettings | null>(null);
  private readonly detectorCountState = signal(0);

  readonly settings = this.state.asReadonly();
  readonly detectorCount = this.detectorCountState.asReadonly();

  constructor(api: ApiService) {
    this.api = api;
  }

  async refresh(): Promise<void> {
    const response = await firstValueFrom(this.api.get<SettingsResponse>('/settings'));

    this.state.set(response.settings);
    this.detectorCountState.set(response.detectorCount);
  }

  async save(settings: AppSettings): Promise<void> {
    const response = await firstValueFrom(
      this.api.put<SettingsResponse>('/settings', settings)
    );

    this.state.set(response.settings);
    this.detectorCountState.set(response.detectorCount);
  }

  async fetchModels(url: string): Promise<OllamaModel[]> {
    const response = await firstValueFrom(
      this.api.get<OllamaModelsResponse>('/settings/models', url ? { url } : undefined)
    );

    return response.models;
  }
}
