import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { AuthService } from '../../SERVICES/auth.service';
import { AuthChallenge } from '../../SERVICES/models/auth.models';

/**
 * Two-step email login: a server-issued arithmetic check, then a one-time code.
 *
 * There is no password to leak, and the challenge keeps a blind form-poster from requesting a
 * mailbox full of codes.
 */
@Component({
  selector: 'app-screen-login',
  standalone: false,
  templateUrl: './screen-login.html',
  styleUrl: './screen-login.scss'
})
export class ScreenLogin implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly step = signal<'email' | 'code'>('email');
  readonly challenge = signal<AuthChallenge | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  email = '';
  answer = '';
  code = '';

  ngOnInit(): void {
    void this.loadChallenge();
    void this.redirectIfLoggedIn();
  }

  private get returnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');

    return requested && !requested.startsWith('/login') ? requested : '/dashboard';
  }

  async loadChallenge(): Promise<void> {
    try {
      this.challenge.set(await this.auth.challenge());
      this.answer = '';
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not load the arithmetic check.'));
    }
  }

  async sendCode(): Promise<void> {
    if (this.busy()) return;

    const email = this.email.trim();

    if (!email) {
      this.error.set('Enter your email address.');
      return;
    }

    if (!this.challenge()) {
      await this.loadChallenge();
    }

    const challenge = this.challenge();

    if (!challenge) return;

    if (!this.answer.trim()) {
      this.error.set('Answer the arithmetic check.');
      return;
    }

    this.busy.set(true);
    this.error.set('');

    try {
      this.notice.set(await this.auth.requestCode(email, challenge.id, this.answer.trim()));
      this.step.set('code');
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not send the login code.'));
      await this.loadChallenge();
    } finally {
      this.busy.set(false);
    }
  }

  async resend(): Promise<void> {
    await this.sendCode();
  }

  async verify(): Promise<void> {
    if (this.busy()) return;

    if (this.code.trim().length !== 6) {
      this.error.set('Enter the 6-character code from the email.');
      return;
    }

    this.busy.set(true);
    this.error.set('');

    try {
      await this.auth.verifyCode(this.email.trim(), this.code.trim());
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Could not verify the code.'));
    } finally {
      this.busy.set(false);
    }
  }

  useDifferentEmail(): void {
    this.step.set('email');
    this.code = '';
    this.error.set('');
    this.notice.set('');
    void this.loadChallenge();
  }

  private async redirectIfLoggedIn(): Promise<void> {
    if (await this.auth.ensureSession()) {
      await this.router.navigateByUrl(this.returnUrl);
    }
  }
}
