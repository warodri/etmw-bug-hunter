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
  readonly copied = signal(false);

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

  terminalCommand(): string {
    if (this.platform() === 'mac') {
      return [
        'cd ~/Downloads',
        'unzip etmw-bug-hunter-agent-mac.zip -d etmw-bug-hunter-agent',
        'cd etmw-bug-hunter-agent',
        'bash install-mac.sh'
      ].join('\n');
    }

    return [
      'cd $env:USERPROFILE\\Downloads',
      'Expand-Archive .\\etmw-bug-hunter-agent-windows.zip -DestinationPath .\\etmw-bug-hunter-agent -Force',
      'cd .\\etmw-bug-hunter-agent',
      'powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1'
    ].join('\n');
  }

  foregroundCommand(): string {
    if (this.platform() === 'mac') {
      return [
        'cd ~/Downloads/etmw-bug-hunter-agent',
        'npm install --omit=dev',
        'node agent.cjs'
      ].join('\n');
    }

    return [
      'cd $env:USERPROFILE\\Downloads\\etmw-bug-hunter-agent',
      'npm install --omit=dev',
      'node agent.cjs'
    ].join('\n');
  }

  logCommand(): string {
    return this.platform() === 'mac'
      ? 'tail -f ~/Library/Logs/ETMWBugHunterAgent.log'
      : 'Get-Content "$env:LOCALAPPDATA\\ETMW\\BugHunterAgent\\agent.log" -Wait';
  }

  restartCommand(): string {
    return this.platform() === 'mac'
      ? [
          'launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.etmw.bughunter.agent.plist 2>/dev/null || true',
          'launchctl kickstart -k gui/$(id -u)/com.etmw.bughunter.agent'
        ].join('\n')
      : 'Start-ScheduledTask -TaskName ETMWBugHunterAgent';
  }

  stopCommand(): string {
    return this.platform() === 'mac'
      ? 'launchctl bootout gui/$(id -u)/com.etmw.bughunter.agent'
      : 'Stop-ScheduledTask -TaskName ETMWBugHunterAgent';
  }

  statusCommand(): string {
    return this.platform() === 'mac'
      ? 'launchctl print gui/$(id -u)/com.etmw.bughunter.agent | grep -E "state|pid"'
      : 'Get-ScheduledTaskInfo -TaskName ETMWBugHunterAgent';
  }

  async copyCommands(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.terminalCommand());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
    } catch {
      this.messages.add({
        severity: 'error',
        summary: 'Copy failed',
        detail: 'Select the commands in the block and copy them manually.'
      });
    }
  }
}
