import { randomInt, randomUUID } from 'node:crypto';

interface Challenge {
  readonly answer: number;
  readonly expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_CHALLENGES = 10_000;

/**
 * A server-side arithmetic check on the login form.
 *
 * It is deliberately small: enough to stop a script that posts the form blindly, without asking a
 * person to read a distorted image. Rate limiting remains the real defence.
 */
export class ChallengeService {
  private readonly challenges = new Map<string, Challenge>();

  issue(): { id: string; question: string } {
    this.prune();

    const left = randomInt(2, 10);
    const right = randomInt(2, 10);
    const subtract = left >= right && randomInt(0, 2) === 0;
    const answer = subtract ? left - right : left + right;

    let id = randomUUID();
    while (this.challenges.has(id)) id = randomUUID();

    this.challenges.set(id, { answer, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    return {
      id,
      question: subtract ? `What is ${left} - ${right}?` : `What is ${left} + ${right}?`
    };
  }

  verify(id: string, answer: string): boolean {
    const challenge = this.challenges.get(id);

    if (!challenge) return false;
    if (challenge.expiresAt < Date.now()) {
      this.challenges.delete(id);
      return false;
    }

    const parsed = Number.parseInt(answer.trim(), 10);

    return Number.isFinite(parsed) && parsed === challenge.answer;
  }

  private prune(): void {
    if (this.challenges.size < MAX_CHALLENGES) return;

    const now = Date.now();
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(id);
      if (this.challenges.size < MAX_CHALLENGES / 2) break;
    }
  }
}
