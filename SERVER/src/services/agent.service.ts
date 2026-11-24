import { HttpError } from '../errors/http-error';
import { AgentPlatform, AgentRecord, toAgentResponse } from '../models/agent.model';
import { AgentRepository } from '../repositories/agent.repository';
import { AgentTokenService } from './agent-token.service';

export interface AgentDownload {
  readonly agent: AgentRecord;
  readonly token: string;
}

export class AgentService {
  constructor(
    private readonly agents: AgentRepository,
    private readonly tokens: AgentTokenService
  ) {}

  async list(ownerId: string): Promise<AgentRecord[]> {
    return this.agents.list(ownerId);
  }

  async getForOwner(ownerId: string, agentId: string): Promise<AgentRecord> {
    const agent = await this.agents.findByIdAndOwner(ownerId, agentId);

    if (!agent) throw new HttpError(422, 'Choose a desktop agent installed for this account.');

    return agent;
  }

  /** One agent per platform per account; re-downloading reissues the same token. */
  async download(ownerId: string, platform: AgentPlatform): Promise<AgentDownload> {
    const existing = await this.agents.findForPlatform(ownerId, platform);
    const agent =
      existing ??
      (await this.agents.create(
        ownerId,
        platform === 'windows' ? 'Windows desktop' : 'Mac desktop',
        platform
      ));

    return { agent, token: this.tokens.derive(agent.id, ownerId) };
  }

  async verifyConnection(agentId: string, token: string): Promise<AgentRecord | null> {
    const agent = await this.agents.findById(agentId);

    if (!agent) return null;
    if (!this.tokens.matches(agent.id, agent.ownerId, token)) return null;

    return agent;
  }

  async markOnline(agentId: string): Promise<void> {
    await this.agents.setOnline(agentId, true);
  }

  async markOffline(agentId: string): Promise<void> {
    await this.agents.setOnline(agentId, false);
  }

  async touch(agentId: string): Promise<void> {
    await this.agents.touch(agentId, new Date());
  }

  async markAllOffline(): Promise<void> {
    await this.agents.markAllOffline();
  }

  respond(record: AgentRecord) {
    return toAgentResponse(record);
  }
}
