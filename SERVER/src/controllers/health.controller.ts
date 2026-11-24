import { Request, Response } from 'express';

import { READ_ONLY_POLICY } from '../constants/network';

/** `/health` and `/policy`: the two facts a client may check without touching data. */
export class HealthController {
  get = (_request: Request, response: Response): void => {
    response.json({ success: true, service: 'etmw-bug-hunter', status: 'ok' });
  };

  policy = (_request: Request, response: Response): void => {
    response.json({
      success: true,
      readOnly: true,
      policy: READ_ONLY_POLICY
    });
  };
}
