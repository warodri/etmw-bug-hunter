import { IncomingMessage, Server } from 'node:http';
import { Duplex } from 'node:stream';

import { WebSocket, WebSocketServer } from 'ws';

import { meetsSeverity, Severity, severityRank } from '../constants/severity';
import { appConfig } from '../config/env';
import { AgentRecord } from '../models/agent.model';
import { ProjectRecord } from '../models/project.model';
import { ScanRecord } from '../models/scan.model';
import { IssueRepository } from '../repositories/issue.repository';
import { ScanRepository } from '../repositories/scan.repository';
import { agentMessageSchema, AgentFinding, AgentMessage } from '../validation/agent.validation';
import { AgentScanDispatcher } from './agent-dispatcher';
import { AgentService } from './agent.service';
import { buildIgnoreList } from './scanner/ignore';
import { ProjectService } from './project.service';
import { SettingsService } from './settings.service';

interface Connection {
  readonly ws: WebSocket;
  readonly agent: AgentRecord;
  isAlive: boolean;
  chain: Promise<void>;
}

interface ActiveScan {
  readonly agentId: string;
  readonly ownerId: string;
  readonly projectId: string;
  readonly scanId: string;
  readonly minSeverity: Severity;
  readonly startedAt: number;
  issuesFound: number;
  worstSeverity: Severity | null;
}

export interface AgentHubDependencies {
  readonly agents: AgentService;
  readonly scans: ScanRepository;
  readonly issues: IssueRepository;
  readonly projects: ProjectService;
  readonly settings: SettingsService;
}

const PING_INTERVAL_MS = 15_000;

/**
 * The only bridge to a desktop agent.
 *
 * The protocol is deliberately one-way in the dangerous direction: the server may ask for a scan
 * or a stop, and receives findings. There is no message that writes, deletes, renames or patches a
 * file, so a compromised dashboard still cannot change the user's code.
 */
export class AgentHub implements AgentScanDispatcher {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly connections = new Map<string, Connection>();
  private readonly active = new Map<string, ActiveScan>();
  /** Jobs waiting for an agent that polls over HTTPS instead of holding a socket. */
  private readonly pending = new Map<string, Array<Record<string, unknown>>>();
  private readonly lastPollAt = new Map<string, number>();
  private readonly reportChains = new Map<string, Promise<void>>();
  private readonly pingTimer: NodeJS.Timeout;

  constructor(
    server: Server,
    private readonly deps: AgentHubDependencies
  ) {
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.handleUpgrade(request, socket, head);
    });

    this.pingTimer = setInterval(() => this.pingAll(), PING_INTERVAL_MS);
    this.pingTimer.unref();
  }

  canDispatch(agentId: string | null): boolean {
    if (!agentId) return false;

    const connection = this.connections.get(agentId);

    if (connection?.ws.readyState === WebSocket.OPEN) return true;

    const lastPoll = this.lastPollAt.get(agentId) ?? 0;

    return Date.now() - lastPoll < 30_000;
  }

  /** One poll from the desktop. Returns queued work and is also the HTTP heartbeat. */
  async poll(agentId: string): Promise<Array<Record<string, unknown>>> {
    this.lastPollAt.set(agentId, Date.now());
    await this.deps.agents.markOnline(agentId).catch(() => undefined);
    await this.deps.agents.touch(agentId).catch(() => undefined);

    const jobs = this.pending.get(agentId) ?? [];
    this.pending.delete(agentId);

    return jobs;
  }

  /** A report received over HTTPS instead of the WebSocket. */
  async report(agentId: string, raw: unknown): Promise<void> {
    const previous = this.reportChains.get(agentId) ?? Promise.resolve();
    const next = previous
      .then(() => this.handleRaw(agentId, raw))
      .catch((error: unknown) => {
        console.error('[agent] HTTP report failed', error);
      });

    this.reportChains.set(agentId, next);
    await next;
  }

  dispatch(ownerId: string, project: ProjectRecord, scan: ScanRecord): void {
    void this.dispatchScan(ownerId, project, scan).catch(async (error: unknown) => {
      await this.deps.scans
        .update(ownerId, scan.id, {
          state: 'failed',
          error: error instanceof Error ? error.message : 'The desktop agent could not start.',
          finishedAt: new Date()
        })
        .catch(() => undefined);
    });
  }

  async stopOwner(ownerId: string): Promise<void> {
    const running = await this.deps.scans.findRunningForOwner(ownerId);

    for (const scan of running) {
      if (scan.executor !== 'agent') continue;

      const active = this.active.get(scan.id);

      if (active) {
        this.deliver(active.agentId, { type: 'scan.stop', scanId: scan.id });
        continue;
      }

      if (scan.state === 'queued') {
        await this.deps.scans.update(ownerId, scan.id, {
          state: 'stopped',
          finishedAt: new Date()
        });
      }
    }
  }

  close(): void {
    clearInterval(this.pingTimer);

    for (const connection of this.connections.values()) {
      try {
        connection.ws.close(1001, 'Server shutting down');
      } catch {
        // The socket is already gone.
      }
    }

    this.wss.close();
  }

  private async dispatchScan(
    ownerId: string,
    project: ProjectRecord,
    scan: ScanRecord
  ): Promise<void> {
    if (!project.agentId || !this.canDispatch(project.agentId)) {
      throw new Error('The desktop agent is offline.');
    }

    const settings = await this.deps.settings.get(ownerId);
    const ignoreList = buildIgnoreList(project.ignoreGlobs, settings.globalIgnoreGlobs);
    const startedAt = new Date();

    await this.deps.scans.update(ownerId, scan.id, {
      state: 'running',
      startedAt,
      totalFiles: 0,
      filesScanned: 0,
      filesSkipped: 0,
      issuesFound: 0,
      worstSeverity: null
    });

    this.active.set(scan.id, {
      agentId: project.agentId,
      ownerId,
      projectId: project.id,
      scanId: scan.id,
      minSeverity: settings.minSeverity,
      startedAt: startedAt.getTime(),
      issuesFound: 0,
      worstSeverity: null
    });

    this.deliver(project.agentId, {
      type: 'scan.start',
      scanId: scan.id,
      projectId: project.id,
      projectName: project.name,
      path: project.path,
      ignoreGlobs: ignoreList,
      minSeverity: settings.minSeverity,
      maxFileBytes: appConfig.agent.maxFileBytes,
      maxFiles: appConfig.agent.maxFiles
    });
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (url.pathname !== '/agent') return;

    const agentId = headerValue(request, 'x-agent-id');
    const authorization = headerValue(request, 'authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    if (!agentId || !token) {
      reject(socket, 401, 'Unauthorized');
      return;
    }

    const agent = await this.deps.agents.verifyConnection(agentId, token).catch(() => null);

    if (!agent) {
      reject(socket, 401, 'Unauthorized');
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.onConnection(ws, agent);
    });
  }

  private onConnection(ws: WebSocket, agent: AgentRecord): void {
    const existing = this.connections.get(agent.id);

    if (existing) {
      try {
        existing.ws.close(4000, 'Replaced by a newer connection');
      } catch {
        // Already closed.
      }
    }

    const connection: Connection = {
      ws,
      agent,
      isAlive: true,
      chain: Promise.resolve()
    };

    this.connections.set(agent.id, connection);
    void this.deps.agents.markOnline(agent.id);
    ws.send(JSON.stringify({ type: 'hello', agentId: agent.id, serverTime: new Date().toISOString() }));

    ws.on('pong', () => {
      connection.isAlive = true;
    });

    ws.on('message', (data) => {
      connection.chain = connection.chain
        .then(() => this.handleRaw(agent.id, data.toString()))
        .catch((error: unknown) => {
          console.error('[agent] message failed', error);
        });
    });

    ws.on('close', () => {
      this.onClose(agent.id, ws);
    });

    ws.on('error', () => {
      // `close` follows and owns the cleanup.
    });
  }

  private async handleRaw(agentId: string, raw: unknown): Promise<void> {
    let parsed: unknown = raw;

    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
    }

    const result = agentMessageSchema.safeParse(parsed);

    if (!result.success) {
      console.warn('[agent] ignored an invalid message', {
        agentId,
        issues: result.error.issues.slice(0, 3)
      });
      return;
    }

    await this.handleParsed(agentId, result.data);
  }

  private async handleParsed(agentId: string, message: AgentMessage): Promise<void> {
    if (message.type === 'heartbeat') {
      await this.deps.agents.touch(agentId);
      return;
    }

    const active = this.active.get(message.scanId);

    if (!active || active.agentId !== agentId) {
      return;
    }

    if (message.type === 'scan.progress') {
      await this.deps.scans.update(active.ownerId, active.scanId, {
        cursor: message.cursor,
        totalFiles: message.totalFiles,
        filesScanned: message.filesScanned,
        filesSkipped: message.filesSkipped
      });
      return;
    }

    if (message.type === 'scan.findings') {
      const accepted = message.findings.filter((finding) =>
        meetsSeverity(finding.severity, active.minSeverity)
      );

      if (accepted.length === 0) return;

      const inserted = await this.deps.issues.insertMany(
        active.ownerId,
        accepted.map((finding) => toIssue(active, finding))
      );

      active.issuesFound += inserted;

      for (const finding of accepted) {
        active.worstSeverity = moreSevere(active.worstSeverity, finding.severity);
      }

      await this.deps.scans.update(active.ownerId, active.scanId, {
        issuesFound: active.issuesFound,
        worstSeverity: active.worstSeverity
      });
      return;
    }

    if (message.type === 'scan.done') {
      const finishedAt = new Date();

      await this.deps.scans.update(active.ownerId, active.scanId, {
        state: 'done',
        cursor: message.cursor,
        totalFiles: message.totalFiles,
        filesScanned: message.filesScanned,
        filesSkipped: message.filesSkipped,
        issuesFound: active.issuesFound,
        worstSeverity: active.worstSeverity,
        finishedAt,
        durationMs: finishedAt.getTime() - active.startedAt,
        error: message.truncated
          ? 'The walk stopped at the file ceiling. Narrow the project folder or add ignore patterns.'
          : null
      });

      await this.deps.projects.markScanned(active.ownerId, active.projectId, finishedAt);
      this.active.delete(active.scanId);
      return;
    }

    if (message.type === 'scan.stopped') {
      await this.deps.scans.update(active.ownerId, active.scanId, {
        state: 'stopped',
        finishedAt: new Date(),
        durationMs: Date.now() - active.startedAt
      });
      this.active.delete(active.scanId);
      return;
    }

    if (message.type === 'scan.error') {
      await this.deps.scans.update(active.ownerId, active.scanId, {
        state: 'failed',
        error: message.message,
        finishedAt: new Date(),
        durationMs: Date.now() - active.startedAt
      });
      this.active.delete(active.scanId);
    }
  }

  private onClose(agentId: string, ws: WebSocket): void {
    const connection = this.connections.get(agentId);

    if (connection?.ws !== ws) return;

    this.connections.delete(agentId);
    void this.deps.agents.markOffline(agentId);
    this.scheduleDisconnectFailure(agentId);
  }

  /**
   * Give a dropped socket a moment to fall back to HTTPS polling. Only an agent that neither
   * reconnects nor polls is treated as gone, so a transport change does not kill a running scan.
   */
  private scheduleDisconnectFailure(agentId: string): void {
    const timer = setTimeout(() => {
      if (this.connections.has(agentId)) return;
      if (Date.now() - (this.lastPollAt.get(agentId) ?? 0) < 30_000) return;

      for (const [scanId, active] of this.active) {
        if (active.agentId !== agentId) continue;

        void this.deps.scans.update(active.ownerId, active.scanId, {
          state: 'failed',
          error: 'The desktop agent disconnected before the scan finished.',
          finishedAt: new Date(),
          durationMs: Date.now() - active.startedAt
        });

        this.active.delete(scanId);
      }
    }, 15_000);

    timer.unref();
  }

  private pingAll(): void {
    const now = Date.now();

    for (const [agentId, connection] of this.connections) {
      if (!connection.isAlive) {
        try {
          connection.ws.terminate();
        } catch {
          // Already gone.
        }
        continue;
      }

      connection.isAlive = false;
      try {
        connection.ws.ping();
      } catch {
        // The close event will clean up.
      }
      void this.deps.agents.touch(agentId);
    }

    // An HTTPS-polling agent has no socket to close, so the absence of polls is the disconnect.
    for (const [scanId, active] of this.active) {
      if (this.connections.has(active.agentId)) continue;

      const lastPoll = this.lastPollAt.get(active.agentId) ?? 0;

      if (now - lastPoll <= 20_000) continue;

      void this.deps.scans.update(active.ownerId, active.scanId, {
        state: 'failed',
        error: 'The desktop agent stopped polling before the scan finished.',
        finishedAt: new Date(),
        durationMs: now - active.startedAt
      });

      this.active.delete(scanId);
      this.pending.delete(active.agentId);
      void this.deps.agents.markOffline(active.agentId);
    }
  }

  /** Send now when a socket is open, otherwise queue for the next HTTPS poll. */
  private deliver(agentId: string, payload: Record<string, unknown>): void {
    const connection = this.connections.get(agentId);

    if (connection?.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(payload));
      return;
    }

    const queue = this.pending.get(agentId) ?? [];
    queue.push(payload);
    this.pending.set(agentId, queue);
  }
}

function toIssue(active: ActiveScan, finding: AgentFinding) {
  return {
    scanId: active.scanId,
    projectId: active.projectId,
    filePath: finding.filePath,
    line: finding.line ?? null,
    column: finding.column ?? null,
    detectorId: finding.detectorId,
    rule: finding.rule,
    category: finding.category,
    severity: finding.severity,
    message: finding.message,
    snippet: finding.snippet,
    aiGenerated: finding.aiGenerated,
    status: 'open' as const
  };
}

function moreSevere(current: Severity | null, candidate: Severity): Severity {
  if (!current) return candidate;

  return severityRank(candidate) < severityRank(current) ? candidate : current;
}

function headerValue(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];

  if (Array.isArray(value)) return value[0] ?? null;

  return typeof value === 'string' ? value : null;
}

function reject(socket: Duplex, status: number, message: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
  );
  socket.destroy();
}
