import { Request, Response } from 'express';

import { DETECTOR_COUNT } from '../services/scanner/detectors';
import { SettingsService } from '../services/settings.service';
import { currentUserId } from '../utils/request';
import { parseBody } from '../validation/parse';
import { updateSettingsSchema } from '../validation/settings.validation';

/** `/settings` — the Ollama endpoint, the optional AI pass and the global ignore list. */
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  get = async (request: Request, response: Response): Promise<void> => {
    const settings = await this.settings.get(currentUserId(request));

    response.json({ settings, detectorCount: DETECTOR_COUNT });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(updateSettingsSchema, request.body);
    const settings = await this.settings.save(currentUserId(request), input);

    response.json({ settings, detectorCount: DETECTOR_COUNT });
  };

  models = async (request: Request, response: Response): Promise<void> => {
    const url = typeof request.query.url === 'string' ? request.query.url : undefined;
    const models = await this.settings.listModels(currentUserId(request), url);

    response.json({ models });
  };
}
