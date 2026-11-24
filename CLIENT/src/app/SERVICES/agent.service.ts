import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { Agent, AgentListResponse, AgentPlatform } from './models/agent.models';

/** Paired desktops and the browser download URL for a platform. */
@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly api = inject(ApiService);
  private readonly state = signal<Agent[]>([]);

  readonly agents = this.state.asReadonly();

  async refresh(): Promise<void> {
    const response = await firstValueFrom(this.api.get<AgentListResponse>('/agents'));

    this.state.set(response.agents);
  }

  downloadUrl(platform: AgentPlatform): string {
    return this.api.resolve(`/agents/download/${platform}`);
  }
}
