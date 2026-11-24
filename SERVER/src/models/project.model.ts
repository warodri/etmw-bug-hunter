/** Where a project's files live. `local` is this server; `agent` is a paired desktop. */
export const PROJECT_MODES = ['local', 'agent'] as const;

export type ProjectMode = (typeof PROJECT_MODES)[number];

/**
 * A Project is a codebase Bug Hunter has been pointed at.
 *
 * It stores only where to look and what to skip; it never stores or edits a single line of the
 * scanned code. A local `path` is absolute on this machine and is validated at save time. An agent
 * `path` is absolute on the user's computer and is validated by that agent when a scan starts.
 */
export interface ProjectRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly path: string;
  readonly description: string;
  /** Directory-relative globs skipped in addition to the built-in list. */
  readonly ignoreGlobs: readonly string[];
  readonly enabled: boolean;
  readonly mode: ProjectMode;
  readonly agentId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastScanAt: Date | null;
}

export interface ProjectDetails {
  readonly name: string;
  readonly path: string;
  readonly description: string;
  readonly ignoreGlobs: readonly string[];
  readonly enabled: boolean;
  readonly mode: ProjectMode;
  readonly agentId: string | null;
}

export interface ProjectResponse {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly description: string;
  readonly ignoreGlobs: readonly string[];
  readonly enabled: boolean;
  readonly mode: ProjectMode;
  readonly agentId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastScanAt: string | null;
}

export function toProjectResponse(record: ProjectRecord): ProjectResponse {
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    description: record.description,
    ignoreGlobs: record.ignoreGlobs,
    enabled: record.enabled,
    mode: record.mode,
    agentId: record.agentId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastScanAt: record.lastScanAt ? record.lastScanAt.toISOString() : null
  };
}
