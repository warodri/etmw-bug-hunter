import { Severity } from './issue.models';

export interface AppSettings {
  readonly ollamaUrl: string;
  readonly model: string;
  readonly aiReview: boolean;
  readonly aiMaxFiles: number;
  readonly minSeverity: Severity;
  readonly globalIgnoreGlobs: readonly string[];
  readonly updatedAt: string | null;
}

export interface SettingsResponse {
  readonly settings: AppSettings;
  readonly detectorCount: number;
}

export interface OllamaModel {
  readonly name: string;
  readonly size: number | null;
  readonly modifiedAt: string | null;
}

export interface OllamaModelsResponse {
  readonly models: OllamaModel[];
}
