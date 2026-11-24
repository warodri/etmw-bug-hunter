export const AGENT_PLATFORMS = ['windows', 'mac'] as const;

export type AgentPlatform = (typeof AGENT_PLATFORMS)[number];

export interface AgentRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly platform: AgentPlatform;
  readonly createdAt: Date;
  readonly lastSeenAt: Date | null;
  readonly online: boolean;
}

export interface AgentResponse {
  readonly id: string;
  readonly name: string;
  readonly platform: AgentPlatform;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly online: boolean;
}

export function toAgentResponse(record: AgentRecord): AgentResponse {
  return {
    id: record.id,
    name: record.name,
    platform: record.platform,
    createdAt: record.createdAt.toISOString(),
    lastSeenAt: record.lastSeenAt ? record.lastSeenAt.toISOString() : null,
    online: record.online
  };
}
