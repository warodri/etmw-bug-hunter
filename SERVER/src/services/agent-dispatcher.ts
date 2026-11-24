import { ProjectRecord } from '../models/project.model';
import { ScanRecord } from '../models/scan.model';

/**
 * The runner asks this whenever a project lives on a paired desktop.
 *
 * The interface is here, not in the WebSocket hub, so the scanner never imports transport code and
 * a future test can provide a fake dispatcher.
 */
export interface AgentScanDispatcher {
  canDispatch(agentId: string | null): boolean;
  dispatch(ownerId: string, project: ProjectRecord, scan: ScanRecord): void;
  stopOwner(ownerId: string): Promise<void>;
}
