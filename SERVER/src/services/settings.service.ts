import { SEVERITY_ORDER, Severity } from '../constants/severity';
import { appConfig } from '../config/env';
import { DEFAULT_GLOBAL_IGNORE_GLOBS, SettingsRecord } from '../models/settings.model';
import { SettingsRepository } from '../repositories/settings.repository';
import { AiReviewService, OllamaModelSummary } from './ai-review.service';

/**
 * Settings are one document per account with deliberate defaults.
 *
 * The AI pass is off by default: the static scan is instant, offline and deterministic, and turning
 * the model on is the owner's decision. Nothing here can pull a model (root ETMW rule).
 */
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  defaults(): SettingsRecord {
    return {
      ollamaUrl: appConfig.defaultOllamaUrl,
      model: '',
      aiReview: false,
      aiMaxFiles: 10,
      minSeverity: 'info',
      globalIgnoreGlobs: [...DEFAULT_GLOBAL_IGNORE_GLOBS],
      updatedAt: null
    };
  }

  async get(ownerId: string): Promise<SettingsRecord> {
    const stored = await this.repository.get(ownerId);

    if (!stored) return this.defaults();

    return {
      ...this.defaults(),
      ...stored,
      ollamaUrl: stored.ollamaUrl || appConfig.defaultOllamaUrl,
      globalIgnoreGlobs:
        stored.globalIgnoreGlobs && stored.globalIgnoreGlobs.length > 0
          ? stored.globalIgnoreGlobs
          : [...DEFAULT_GLOBAL_IGNORE_GLOBS]
    };
  }

  async save(
    ownerId: string,
    input: Partial<Omit<SettingsRecord, 'updatedAt'>>
  ): Promise<SettingsRecord> {
    const current = await this.get(ownerId);

    const merged: Omit<SettingsRecord, 'updatedAt'> = {
      ollamaUrl: normaliseUrl(input.ollamaUrl ?? current.ollamaUrl),
      model: (input.model ?? current.model).trim(),
      aiReview: input.aiReview ?? current.aiReview,
      aiMaxFiles: clamp(input.aiMaxFiles ?? current.aiMaxFiles, 1, 50),
      minSeverity: normaliseSeverity(input.minSeverity ?? current.minSeverity),
      globalIgnoreGlobs: dedupe(
        input.globalIgnoreGlobs ?? [...DEFAULT_GLOBAL_IGNORE_GLOBS, ...current.globalIgnoreGlobs]
      )
    };

    return this.repository.save(ownerId, merged);
  }

  async listModels(ownerId: string, url?: string): Promise<OllamaModelSummary[]> {
    const settings = await this.get(ownerId);
    const target = normaliseUrl(url ?? settings.ollamaUrl);

    if (!target) throw new Error('Enter an Ollama URL first.');

    return AiReviewService.listModels(target);
  }

  async aiService(ownerId: string): Promise<AiReviewService | null> {
    const settings = await this.get(ownerId);

    if (!settings.aiReview) return null;

    const service = new AiReviewService(settings.ollamaUrl, settings.model);

    return service.configured ? service : null;
  }
}

function normaliseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;

  return Math.min(max, Math.max(min, Math.round(value)));
}

function normaliseSeverity(value: string): Severity {
  return (SEVERITY_ORDER as readonly string[]).includes(value) ? (value as Severity) : 'info';
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
