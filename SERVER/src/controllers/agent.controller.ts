import { Request, Response } from 'express';

import { AGENT_PLATFORMS, AgentPlatform, AgentRecord, toAgentResponse } from '../models/agent.model';
import { AgentHub } from '../services/agent-hub.service';
import { AgentPackageService } from '../services/agent-package.service';
import { AgentService } from '../services/agent.service';
import { currentUserId } from '../utils/request';
import { agentMessageSchema } from '../validation/agent.validation';

/** `/agents` — list paired desktops, download a token-bound package, and serve the agent. */
export class AgentController {
  private hub: AgentHub | null = null;

  constructor(
    private readonly agents: AgentService,
    private readonly packages: AgentPackageService
  ) {}

  /** The hub needs the HTTP server, which exists after `createApp`; the boot sequence wires it. */
  attachHub(hub: AgentHub): void {
    this.hub = hub;
  }

  list = async (request: Request, response: Response): Promise<void> => {
    const agents = await this.agents.list(currentUserId(request));

    response.json({ agents: agents.map(toAgentResponse) });
  };

  download = async (request: Request, response: Response): Promise<void> => {
    const platform = request.params.platform as AgentPlatform;

    if (!AGENT_PLATFORMS.includes(platform)) {
      response.status(404).json({ success: false, message: 'Unknown desktop platform.' });
      return;
    }

    const download = await this.agents.download(currentUserId(request), platform);

    await this.packages.write(response, {
      agent: download.agent,
      token: download.token,
      platform
    });
  };

  /** HTTPS fallback: the agent asks for work; no session cookie, its own bearer token instead. */
  poll = async (request: Request, response: Response): Promise<void> => {
    const agent = await this.authenticateAgent(request);

    if (!agent) {
      response.status(401).json({ success: false, message: 'Unknown agent or token.' });
      return;
    }

    if (!this.hub) {
      response.status(503).json({ success: false, message: 'The agent hub is still starting.' });
      return;
    }

    const jobs = await this.hub.poll(agent.id);

    response.json({ jobs, serverTime: new Date().toISOString() });
  };

  /** HTTPS fallback: progress, findings and completion arrive here instead of over the socket. */
  report = async (request: Request, response: Response): Promise<void> => {
    const agent = await this.authenticateAgent(request);

    if (!agent) {
      response.status(401).json({ success: false, message: 'Unknown agent or token.' });
      return;
    }

    if (!this.hub) {
      response.status(503).json({ success: false, message: 'The agent hub is still starting.' });
      return;
    }

    const parsed = agentMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      response.status(422).json({ success: false, message: 'The report is not a valid message.' });
      return;
    }

    await this.hub.report(agent.id, parsed.data);
    response.json({ success: true });
  };

  private async authenticateAgent(request: Request): Promise<AgentRecord | null> {
    const header = request.headers['x-agent-id'];
    const agentId = Array.isArray(header) ? header[0] : header;
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    if (!agentId || !token) return null;

    return this.agents.verifyConnection(agentId, token);
  }
}
