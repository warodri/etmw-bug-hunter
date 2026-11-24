import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MessageService } from 'primeng/api';

import { apiErrorMessage } from '../../SERVICES/api-error';
import { AgentService } from '../../SERVICES/agent.service';
import { AgentPlatform } from '../../SERVICES/models/agent.models';

/** The download page for one platform; the header routes to the Windows or Mac variant. */
@Component({
  selector: 'app-screen-download',
  standalone: false,
  templateUrl: './screen-download.html',
  styleUrl: './screen-download.scss'
})
export class ScreenDownload implements OnInit {
  private readonly agents = inject(AgentService);
  private readonly route = inject(ActivatedRoute);
  private readonly messages = inject(MessageService);

  readonly platform = signal<AgentPlatform>('windows');
  readonly list = this.agents.agents;
  readonly refreshing = signal(false);

  readonly platformLabel = computed(() => (this.platform() === 'mac' ? 'macOS' : 'Windows'));
  readonly downloadUrl = computed(() => this.agents.downloadUrl(this.platform()));
  readonly agent = computed(
    () => this.list().find((item) => item.platform === this.platform()) ?? null
  );

  constructor() {
    this.route.data.subscribe((data) => {
      this.platform.set(data['platform'] === 'mac' ? 'mac' : 'windows');
    });
  }

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.refreshing.set(true);

    try {
      await this.agents.refresh();
    } catch (error) {
      this.messages.add({
        severity: 'error',
        summary: 'Could not read the agent status',
        detail: apiErrorMessage(error, 'The agent list could not be read.')
      });
    } finally {
      this.refreshing.set(false);
    }
  }

  installCommand(): string {
    return this.platform() === 'mac' ? 'bash install-mac.sh' : 'install-windows.ps1';
  }
}
