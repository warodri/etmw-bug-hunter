import { Request, Response } from 'express';

import { appConfig } from '../config/env';
import { SESSION_COOKIE } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { parseBody } from '../validation/parse';
import { requestCodeSchema, verifyCodeSchema } from '../validation/auth.validation';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  challenge = (_request: Request, response: Response): void => {
    response.json({ challenge: this.auth.issueChallenge() });
  };

  requestCode = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(requestCodeSchema, request.body);
    const result = await this.auth.requestCode(
      input.email,
      input.challengeId,
      input.challengeAnswer,
      { ip: request.ip }
    );

    response.json({ success: true, message: result.message });
  };

  verifyCode = async (request: Request, response: Response): Promise<void> => {
    const input = parseBody(verifyCodeSchema, request.body);
    const result = await this.auth.verifyCode(input.email, input.code);
    const maxAge = appConfig.auth.sessionDays * 24 * 60 * 60 * 1000;

    response.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.nodeEnv === 'production',
      path: '/',
      maxAge
    });

    response.json({ success: true, user: result.user });
  };

  me = (request: Request, response: Response): void => {
    response.json({ user: request.user });
  };

  logout = (_request: Request, response: Response): void => {
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig.nodeEnv === 'production',
      path: '/'
    });
    response.json({ success: true });
  };
}
