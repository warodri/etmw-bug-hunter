import { createHmac, timingSafeEqual } from 'node:crypto';

import { appConfig } from '../config/env';

/**
 * Agent tokens are derived, never stored.
 *
 * `HMAC(secret, agentId:ownerId)` means the server can reissue a download without keeping a
 * plaintext token in Mongo, and rotating `BUG_HUNTER_AGENT_SECRET` revokes every installed agent.
 */
export class AgentTokenService {
  derive(agentId: string, ownerId: string): string {
    return createHmac('sha256', appConfig.agent.tokenSecret)
      .update(`${agentId}:${ownerId}`)
      .digest('base64url');
  }

  matches(agentId: string, ownerId: string, provided: string): boolean {
    const expected = Buffer.from(this.derive(agentId, ownerId), 'utf8');
    const actual = Buffer.from(provided, 'utf8');

    if (expected.length !== actual.length) return false;

    return timingSafeEqual(expected, actual);
  }
}
