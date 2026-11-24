export type AgentPlatform = 'windows' | 'mac';

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly platform: AgentPlatform;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  readonly online: boolean;
}

export interface AgentListResponse {
  readonly agents: Agent[];
}
