export type ProjectMode = 'local' | 'agent';

export interface Project {
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

export interface ProjectDraft {
  readonly name: string;
  readonly path: string;
  readonly description: string;
  readonly ignoreGlobs: readonly string[];
  readonly enabled: boolean;
  readonly mode: ProjectMode;
  readonly agentId: string | null;
}

export interface ProjectListResponse {
  readonly projects: Project[];
  readonly total: number;
}

export interface ProjectResponse {
  readonly project: Project;
}
