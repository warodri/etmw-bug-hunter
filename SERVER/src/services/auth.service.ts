import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { appConfig } from '../config/env';
import { HttpError } from '../errors/http-error';
import { PublicUser, toPublicUser, UserRecord } from '../models/user.model';
import { AuthCodeRepository } from '../repositories/auth-code.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuthRateLimiter } from './auth-rate-limit.service';
import { ChallengeService } from './challenge.service';
import { EmailService } from './email.service';
import { LegacyAdoptionService } from './legacy-adoption.service';

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const CODE_PATTERN = /^[A-F0-9]{6}$/;

export interface SessionUser {
  readonly id: string;
  readonly email: string;
}

export interface LoginResult {
  readonly token: string;
  readonly user: PublicUser;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly codes: AuthCodeRepository,
    private readonly challenges: ChallengeService,
    private readonly email: EmailService,
    private readonly rate: AuthRateLimiter,
    private readonly adoption: LegacyAdoptionService
  ) {}

  issueChallenge(): { id: string; question: string } {
    return this.challenges.issue();
  }

  async requestCode(
    emailInput: string,
    challengeId: string,
    challengeAnswer: string,
    context: { ip?: string } = {}
  ): Promise<{ message: string }> {
    const email = this.validateEmail(emailInput);
    this.enforceAllowlist(email);

    if (!this.challenges.verify(challengeId, challengeAnswer)) {
      throw new HttpError(422, 'That arithmetic answer is not correct. Try the new question.');
    }

    const decision = this.rate.check(email, context.ip);

    if (!decision.allowed) {
      throw new HttpError(
        429,
        `Too many code requests. Try again in ${decision.retryAfterSeconds} seconds.`
      );
    }

    const code = randomBytes(3).toString('hex').toUpperCase();

    await this.codes.save({
      email,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + appConfig.auth.codeTtlMs),
      attempts: 0
    });

    try {
      await this.email.sendLoginCode(email, code);
    } catch (error) {
      await this.codes.remove(email);
      throw new HttpError(
        502,
        error instanceof Error
          ? `Could not send the email: ${error.message}`
          : 'Could not send the email.'
      );
    }

    return { message: `We sent a 6-character code to ${email}.` };
  }

  async verifyCode(emailInput: string, codeInput: string): Promise<LoginResult> {
    const email = this.validateEmail(emailInput);
    this.enforceAllowlist(email);

    const code = (codeInput ?? '').trim().toUpperCase();

    if (!CODE_PATTERN.test(code)) {
      throw new HttpError(400, 'Enter the 6-character code from the email.');
    }

    const record = await this.codes.find(email);

    if (!record) {
      throw new HttpError(400, 'That code is invalid or has expired. Request a new one.');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.codes.remove(email);
      throw new HttpError(400, 'That code has expired. Request a new one.');
    }

    if (record.attempts >= appConfig.auth.maxAttempts) {
      await this.codes.remove(email);
      throw new HttpError(429, 'Too many incorrect attempts. Request a new code.');
    }

    if (!hashesMatch(hashCode(code), record.codeHash)) {
      await this.codes.incrementAttempts(email);
      throw new HttpError(400, 'That code is not correct. Check the email and try again.');
    }

    await this.codes.remove(email);

    const { user, created } = await this.users.findOrCreate(email);
    const ownerEmail = appConfig.auth.ownerEmail.trim().toLowerCase();
    const shouldAdopt = ownerEmail ? ownerEmail === email : created;

    if (shouldAdopt) {
      await this.adoption.adopt(user.id).catch((error: unknown) => {
        console.error('[auth] legacy adoption failed', error);
      });
    }

    const token = jwt.sign({ email: user.email }, appConfig.auth.jwtSecret, {
      subject: user.id,
      expiresIn: `${appConfig.auth.sessionDays}d`,
      issuer: 'etmw-bug-hunter'
    });

    return { token, user: toPublicUser(user) };
  }

  verifySession(token: string): SessionUser {
    let payload: jwt.JwtPayload;

    try {
      payload = jwt.verify(token, appConfig.auth.jwtSecret, {
        issuer: 'etmw-bug-hunter'
      }) as jwt.JwtPayload;
    } catch {
      throw new HttpError(401, 'Authentication required.');
    }

    if (!payload.sub) {
      throw new HttpError(401, 'Authentication required.');
    }

    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : ''
    };
  }

  async getUser(id: string): Promise<UserRecord | null> {
    return this.users.findById(id);
  }

  private validateEmail(input: string): string {
    const email = (input ?? '').trim().toLowerCase();

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new HttpError(400, 'Enter a valid email address.');
    }

    return email;
  }

  private enforceAllowlist(email: string): void {
    const allowed = appConfig.auth.allowedEmails;

    if (allowed.length > 0 && !allowed.includes(email)) {
      throw new HttpError(403, 'This email address is not allowed to sign in.');
    }
  }
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function hashesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}
