import { readFile } from 'node:fs/promises';

import { matchesGlob, buildIgnoreList } from './scanner/ignore';
import { walkProject, SourceFile } from './scanner/file-walker';
import { analyseContent } from './scanner/file-analyzer';
import { meetsSeverity, severityRank, Severity } from '../constants/severity';
import { IssueRecord } from '../models/issue.model';
import { ScanError, ScanRecord } from '../models/scan.model';
import { ProjectRecord } from '../models/project.model';
import { SettingsRecord } from '../models/settings.model';
import { IssueRepository } from '../repositories/issue.repository';
import { ScanRepository } from '../repositories/scan.repository';
import { HttpError } from '../errors/http-error';
import { AgentScanDispatcher } from './agent-dispatcher';
import { AiReviewService } from './ai-review.service';
import { ProjectService } from './project.service';
import { SettingsService } from './settings.service';

export interface ScanRunnerStatus {
  readonly running: boolean;
  readonly scan: ScanRecord | null;
  readonly queued: number;
}

interface QueuedScan {
  readonly scanId: string;
  readonly ownerId: string;
}

const FLUSH_EVERY = 25;

/**
 * The background scanner.
 *
 * One local scan at a time, file by file, with the cursor written as it advances so a stop, crash
 * or restart resumes at the next file. Agent scans are dispatched to a desktop and never touch the
 * server filesystem. It opens files for reading only — there is no write call in this service or
 * anything it calls, which is how "reports issues, never fixes them" is guaranteed in code.
 */
export class ScanRunner {
  private readonly queue: QueuedScan[] = [];
  private activeId: string | null = null;
  private activeOwnerId: string | null = null;
  private stopRequested = false;
  private working = false;
  private agentHub: AgentScanDispatcher | null = null;

  constructor(
    private readonly projects: ProjectService,
    private readonly scans: ScanRepository,
    private readonly issues: IssueRepository,
    private readonly settings: SettingsService
  ) {}

  attachAgentHub(hub: AgentScanDispatcher): void {
    this.agentHub = hub;
  }

  /** Create one queued run per requested project and start processing them in order. */
  async start(ownerId: string, projectIds: readonly string[]): Promise<ScanRecord[]> {
    const projects: ProjectRecord[] = [];

    for (const projectId of projectIds) {
      const project = await this.projects.get(ownerId, projectId);

      if (!project.enabled) throw new HttpError(422, `"${project.name}" is disabled.`);

      if (project.mode === 'agent' && !this.agentHub?.canDispatch(project.agentId)) {
        throw new HttpError(
          422,
          `The desktop agent for "${project.name}" is offline. Start it on that computer and try again.`
        );
      }

      projects.push(project);
    }

    const created: ScanRecord[] = [];
    const remote: Array<{ project: ProjectRecord; scan: ScanRecord }> = [];

    for (const project of projects) {
      const executor = project.mode === 'agent' ? 'agent' : 'local';
      const scan = await this.scans.create(ownerId, {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        executor,
        state: 'queued',
        cursor: 0,
        totalFiles: 0,
        filesScanned: 0,
        filesSkipped: 0,
        issuesFound: 0,
        worstSeverity: null,
        aiUsed: false,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
        errors: [],
        createdAt: new Date()
      });

      created.push(scan);

      if (executor === 'agent') {
        remote.push({ project, scan });
      } else {
        this.queue.push({ scanId: scan.id, ownerId });
      }
    }

    for (const item of remote) {
      try {
        this.agentHub?.dispatch(ownerId, item.project, item.scan);
      } catch (error) {
        await this.scans.update(ownerId, item.scan.id, {
          state: 'failed',
          error: error instanceof Error ? error.message : 'The desktop agent could not start.',
          finishedAt: new Date()
        });
      }
    }

    void this.ensureLoop();

    return created;
  }

  /** Ask the active scan to stop after the current file; queued scans are stopped outright. */
  async stop(ownerId: string): Promise<void> {
    if (this.activeOwnerId === ownerId) {
      this.stopRequested = true;
    }

    const kept: QueuedScan[] = [];
    for (const item of this.queue) {
      if (item.ownerId !== ownerId) {
        kept.push(item);
        continue;
      }

      await this.scans.update(ownerId, item.scanId, {
        state: 'stopped',
        finishedAt: new Date()
      });
    }
    this.queue.length = 0;
    this.queue.push(...kept);

    await this.agentHub?.stopOwner(ownerId);
  }

  status(): ScanRunnerStatus {
    return { running: this.activeId !== null, scan: null, queued: this.queue.length };
  }

  /** The scan being written right now, so the dashboard can show live progress. */
  currentId(): string | null {
    return this.activeId;
  }

  /**
   * After a restart, local runs resume from their stored cursor. Agent runs cannot: the desktop
   * connection is gone, so they are closed honestly instead of showing a frozen progress bar.
   */
  async resumeIfRunning(): Promise<void> {
    const pending = await this.scans.findRunning();

    for (const scan of pending) {
      if (scan.executor === 'agent') {
        await this.scans.update(scan.ownerId, scan.id, {
          state: 'failed',
          error: 'The server restarted while the desktop agent was scanning. Start a new scan.',
          finishedAt: new Date()
        });
        continue;
      }

      await this.scans.update(scan.ownerId, scan.id, { state: 'queued' });
      this.queue.push({ scanId: scan.id, ownerId: scan.ownerId });
    }

    if (this.queue.length > 0) void this.ensureLoop();
  }

  private async ensureLoop(): Promise<void> {
    if (this.working) return;

    this.working = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();

        if (!item) break;

        await this.runOne(item).catch(async (error: unknown) => {
          const message = error instanceof Error ? error.message : 'The scan failed.';

          await this.scans
            .update(item.ownerId, item.scanId, {
              state: 'failed',
              error: message,
              finishedAt: new Date()
            })
            .catch(() => undefined);
        });

        this.activeId = null;
        this.activeOwnerId = null;
        this.stopRequested = false;
      }
    } finally {
      this.working = false;
      this.activeId = null;
      this.activeOwnerId = null;
    }
  }

  private async runOne(item: QueuedScan): Promise<void> {
    const scan = await this.scans.findById(item.ownerId, item.scanId);

    if (!scan || scan.state !== 'queued') return;

    this.activeId = item.scanId;
    this.activeOwnerId = item.ownerId;
    this.stopRequested = false;

    const startedAt = new Date();

    await this.scans.update(scan.ownerId, scan.id, { state: 'running', startedAt });

    const project = await this.projects.get(scan.ownerId, scan.projectId);
    const settings = await this.settings.get(scan.ownerId);
    const ignoreList = buildIgnoreList(project.ignoreGlobs, settings.globalIgnoreGlobs);

    const walk = await walkProject(project.path, {
      ignoreList,
      maxFileBytes: 512 * 1024,
      maxFiles: 20_000
    });

    let filesScanned = 0;
    let issuesFound = 0;
    let worst: Severity | null = null;
    let aiUsed = false;
    const errors: ScanError[] = [];
    const pending: Omit<IssueRecord, 'id' | 'ownerId' | 'createdAt'>[] = [];

    const aiService = settings.aiReview ? await this.settings.aiService(scan.ownerId) : null;
    const aiTargets = aiService
      ? pickAiTargets(walk.files, settings, project.ignoreGlobs)
      : new Set<string>();

    await this.scans.update(scan.ownerId, scan.id, {
      totalFiles: walk.files.length,
      filesSkipped: walk.skipped
    });

    const flush = async (): Promise<void> => {
      if (pending.length === 0) return;

      const inserted = await this.issues.insertMany(scan.ownerId, pending);
      issuesFound += inserted;
      pending.length = 0;
    };

    const saveProgress = async (cursor: number): Promise<void> => {
      await this.scans.update(scan.ownerId, scan.id, {
        cursor,
        filesScanned,
        issuesFound,
        worstSeverity: worst,
        aiUsed
      });
    };

    for (let index = 0; index < walk.files.length; index += 1) {
      if (this.stopRequested) {
        await flush();
        await saveProgress(index);
        await this.scans.update(scan.ownerId, scan.id, {
          state: 'stopped',
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime()
        });
        return;
      }

      const file = walk.files[index];

      let content: string;

      try {
        content = await readFile(file.absolutePath, 'utf8');
      } catch {
        errors.push({ filePath: file.relativePath, message: 'The file could not be read.' });
        continue;
      }

      if (content.includes('\u0000')) continue;

      const fileLabels: Omit<IssueRecord, 'id' | 'ownerId' | 'createdAt' | 'scanId' | 'projectId' | 'status'>[] = [];

      const staticDetections = analyseContent(file, content)
        .filter((detection) => meetsSeverity(detection.severity, settings.minSeverity));

      for (const detection of staticDetections) {
        fileLabels.push({
          filePath: file.relativePath,
          line: detection.line,
          column: detection.column,
          detectorId: detection.detectorId,
          rule: detection.rule,
          category: detection.category,
          severity: detection.severity,
          message: detection.message,
          snippet: detection.snippet,
          aiGenerated: false
        });
      }

      if (aiService && aiTargets.has(file.relativePath)) {
        try {
          const aiDetections = (await aiService.review({
            relativePath: file.relativePath,
            language: file.language,
            content
          })).filter((detection) => meetsSeverity(detection.severity, settings.minSeverity));

          aiUsed = aiUsed || aiDetections.length > 0;

          for (const detection of aiDetections) {
            fileLabels.push({
              filePath: file.relativePath,
              line: detection.line,
              column: null,
              detectorId: detection.detectorId,
              rule: detection.rule,
              category: detection.category,
              severity: detection.severity,
              message: detection.message,
              snippet: detection.snippet,
              aiGenerated: true
            });
          }
        } catch (error) {
          errors.push({
            filePath: file.relativePath,
            message: error instanceof Error ? error.message : 'The AI review failed.'
          });
        }
      }

      for (const detection of fileLabels) {
        pending.push({
          ...detection,
          scanId: scan.id,
          projectId: scan.projectId,
          status: 'open'
        });

        worst = moreSevere(worst, detection.severity);
      }

      filesScanned += 1;

      if (pending.length >= FLUSH_EVERY) await flush();

      if ((index + 1) % FLUSH_EVERY === 0) await saveProgress(index + 1);
    }

    await flush();

    const finishedAt = new Date();

    await this.scans.update(scan.ownerId, scan.id, {
      state: 'done',
      cursor: walk.files.length,
      filesScanned,
      issuesFound,
      worstSeverity: worst,
      aiUsed,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      error: walk.truncated
        ? `The walk stopped at the ${walk.files.length}-file ceiling. Narrow the project folder or add ignore patterns.`
        : null,
      errors: errors.slice(0, 50)
    });

    await this.projects.markScanned(scan.ownerId, scan.projectId, finishedAt);
  }
}

function moreSevere(current: Severity | null, candidate: Severity): Severity {
  if (!current) return candidate;

  return severityRank(candidate) < severityRank(current) ? candidate : current;
}

/**
 * The files the optional AI pass reads: the largest source files first, never a document or a
 * stylesheet, capped by `aiMaxFiles`. Reading every file would cost model time for little gain.
 */
function pickAiTargets(
  files: readonly SourceFile[],
  settings: SettingsRecord,
  projectGlobs: readonly string[]
): Set<string> {
  const ignoreList = buildIgnoreList(projectGlobs, settings.globalIgnoreGlobs);

  const eligible = files.filter(
    (file) =>
      ['typescript', 'javascript', 'python', 'php', 'ruby', 'go', 'java', 'kotlin', 'swift', 'csharp', 'rust'].includes(
        file.language
      ) && !ignoreList.some((pattern) => matchesGlob(file.relativePath, pattern))
  );

  return new Set(
    eligible
      .slice()
      .sort((left, right) => right.size - left.size)
      .slice(0, settings.aiMaxFiles)
      .map((file) => file.relativePath)
  );
}
