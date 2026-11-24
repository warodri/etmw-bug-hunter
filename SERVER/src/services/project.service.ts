import { stat } from 'node:fs/promises';
import path from 'node:path';

import { HttpError } from '../errors/http-error';
import { ProjectDetails, ProjectRecord } from '../models/project.model';
import { ProjectPatch, ProjectRepository } from '../repositories/project.repository';
import { IssueRepository } from '../repositories/issue.repository';
import { ScanRepository } from '../repositories/scan.repository';
import { AgentService } from './agent.service';

/**
 * Projects: where to look, nothing else.
 *
 * A local project must exist on this machine; an agent project must name an agent this account
 * owns. The server never opens an agent path — the desktop does, and only for reading.
 */
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly scans: ScanRepository,
    private readonly issues: IssueRepository,
    private readonly agents: AgentService
  ) {}

  async list(ownerId: string, includeDisabled = true): Promise<ProjectRecord[]> {
    const all = await this.projects.list(ownerId);

    return includeDisabled ? all : all.filter((project) => project.enabled);
  }

  async get(ownerId: string, id: string): Promise<ProjectRecord> {
    const project = await this.projects.findById(ownerId, id);

    if (!project) throw new HttpError(404, 'That project does not exist.');

    return project;
  }

  async create(ownerId: string, details: ProjectDetails): Promise<ProjectRecord> {
    const resolved = await this.normaliseForMode(ownerId, details);

    await this.assertUniquePath(ownerId, resolved.path);

    return this.projects.create(ownerId, resolved);
  }

  async update(ownerId: string, id: string, patch: ProjectPatch): Promise<ProjectRecord> {
    const existing = await this.get(ownerId, id);
    const next = {
      ...patch,
      mode: patch.mode ?? existing.mode,
      agentId: patch.agentId !== undefined ? patch.agentId : existing.agentId,
      path: patch.path ?? existing.path,
      name: patch.name ?? existing.name
    };

    if (!next.name.trim()) {
      throw new HttpError(422, 'Give the project a name.');
    }

    const resolved = await this.normaliseForMode(ownerId, {
      name: next.name,
      path: next.path,
      description: patch.description ?? existing.description,
      ignoreGlobs: patch.ignoreGlobs ?? existing.ignoreGlobs,
      enabled: patch.enabled ?? existing.enabled,
      mode: next.mode,
      agentId: next.agentId
    });

    await this.assertUniquePath(ownerId, resolved.path, id);

    const change: ProjectPatch = {
      ...patch,
      path: resolved.path,
      mode: resolved.mode,
      agentId: resolved.agentId
    };
    const updated = await this.projects.update(ownerId, id, change);

    if (!updated) throw new HttpError(404, 'That project does not exist.');

    return updated;
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.get(ownerId, id);

    await this.issues.removeByProject(ownerId, id);
    await this.scans.removeByProject(ownerId, id);

    const removed = await this.projects.remove(ownerId, id);

    if (!removed) throw new HttpError(404, 'That project does not exist.');
  }

  async markScanned(ownerId: string, id: string, at: Date): Promise<void> {
    await this.projects.touchLastScan(ownerId, id, at);
  }

  private async normaliseForMode(
    ownerId: string,
    details: ProjectDetails
  ): Promise<ProjectDetails> {
    const name = details.name.trim();

    if (!name) throw new HttpError(422, 'Give the project a name.');

    if (details.mode === 'agent') {
      if (!details.agentId) {
        throw new HttpError(422, 'Choose the desktop agent that can see this folder.');
      }

      await this.agents.getForOwner(ownerId, details.agentId);
      const folder = details.path.trim();

      if (!isAbsoluteOnAnyOs(folder)) {
        throw new HttpError(
          422,
          'Enter the absolute folder path on the computer running the desktop agent.'
        );
      }

      return { ...details, name, path: folder, agentId: details.agentId };
    }

    const resolved = await this.validatePath(details.path);

    return { ...details, name, path: resolved, agentId: null };
  }

  private async validatePath(input: string): Promise<string> {
    const resolved = path.resolve(input.trim());

    if (resolved === path.parse(resolved).root) {
      throw new HttpError(422, 'Point Bug Hunter at a project folder, not at a disk root.');
    }

    if (resolved === path.resolve(process.env.HOME ?? '/Users')) {
      throw new HttpError(422, 'Point Bug Hunter at a project folder, not at the home folder.');
    }

    let info;

    try {
      info = await stat(resolved);
    } catch {
      throw new HttpError(422, `No folder exists at ${resolved}.`);
    }

    if (!info.isDirectory()) {
      throw new HttpError(422, `${resolved} is not a folder.`);
    }

    return resolved;
  }

  private async assertUniquePath(
    ownerId: string,
    resolved: string,
    exceptId?: string
  ): Promise<void> {
    const existing = await this.projects.list(ownerId);
    const clash = existing.find(
      (project) => project.path === resolved && project.id !== exceptId
    );

    if (clash) {
      throw new HttpError(409, `"${clash.name}" already points at this folder.`);
    }
  }
}

/** `/Users/me/app` or `C:\work\app` — an agent path is not resolved on this server. */
function isAbsoluteOnAnyOs(value: string): boolean {
  if (!value) return false;

  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
}
