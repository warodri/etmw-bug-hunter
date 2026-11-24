import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import {
  AuthUser,
  ChallengeResponse,
  MeResponse,
  RequestCodeResponse,
  VerifyCodeResponse
} from './models/auth.models';

/** The session is an HttpOnly cookie; this service only remembers who it belongs to. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly userState = signal<AuthUser | null>(null);
  private checked = false;

  readonly user = this.userState.asReadonly();

  async ensureSession(): Promise<boolean> {
    if (this.checked) return this.userState() !== null;

    try {
      const response = await firstValueFrom(this.api.get<MeResponse>('/auth/me'));
      this.userState.set(response.user);
    } catch {
      this.userState.set(null);
    } finally {
      this.checked = true;
    }

    return this.userState() !== null;
  }

  async challenge(): Promise<ChallengeResponse['challenge']> {
    const response = await firstValueFrom(
      this.api.get<ChallengeResponse>('/auth/challenge')
    );

    return response.challenge;
  }

  async requestCode(
    email: string,
    challengeId: string,
    challengeAnswer: string
  ): Promise<string> {
    const response = await firstValueFrom(
      this.api.post<RequestCodeResponse>('/auth/request-code', {
        email,
        challengeId,
        challengeAnswer
      })
    );

    return response.message;
  }

  async verifyCode(email: string, code: string): Promise<AuthUser> {
    const response = await firstValueFrom(
      this.api.post<VerifyCodeResponse>('/auth/verify-code', { email, code })
    );

    this.userState.set(response.user);
    this.checked = true;

    return response.user;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post<{ success: boolean }>('/auth/logout'));
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.userState.set(null);
    this.checked = false;
  }
}
