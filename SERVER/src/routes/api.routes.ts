import { Router, RequestHandler } from 'express';

import { AgentController } from '../controllers/agent.controller';
import { AuthController } from '../controllers/auth.controller';
import { HealthController } from '../controllers/health.controller';
import { IssueController } from '../controllers/issue.controller';
import { ProjectController } from '../controllers/project.controller';
import { ScanController } from '../controllers/scan.controller';
import { SettingsController } from '../controllers/settings.controller';
import { SummaryController } from '../controllers/summary.controller';
import { asyncHandler } from '../middleware/error-handler';

export interface Controllers {
  readonly health: HealthController;
  readonly auth: AuthController;
  readonly projects: ProjectController;
  readonly scans: ScanController;
  readonly issues: IssueController;
  readonly settings: SettingsController;
  readonly summary: SummaryController;
  readonly agents: AgentController;
}

/** Every URL in one place, so the client contract is readable at a glance. */
export function createApiRouter(
  controllers: Controllers,
  requireSession: RequestHandler
): Router {
  const router = Router();

  // Public: liveness, the read-only promise, and the two-step login.
  router.get('/health', controllers.health.get);
  router.get('/policy', controllers.health.policy);
  router.get('/auth/challenge', controllers.auth.challenge);
  router.post('/auth/request-code', asyncHandler(controllers.auth.requestCode));
  router.post('/auth/verify-code', asyncHandler(controllers.auth.verifyCode));
  router.post('/auth/logout', controllers.auth.logout);

  // Agent transport: authenticated by its own bearer token, never by the dashboard cookie.
  router.post('/agent/poll', asyncHandler(controllers.agents.poll));
  router.post('/agent/report', asyncHandler(controllers.agents.report));

  router.get('/auth/me', requireSession, controllers.auth.me);

  // Everything below needs a session.
  router.use(requireSession);

  router.get('/summary', asyncHandler(controllers.summary.get));

  router.get('/projects', asyncHandler(controllers.projects.list));
  router.post('/projects', asyncHandler(controllers.projects.create));
  router.get('/projects/:id', asyncHandler(controllers.projects.get));
  router.patch('/projects/:id', asyncHandler(controllers.projects.update));
  router.delete('/projects/:id', asyncHandler(controllers.projects.remove));

  router.get('/scans', asyncHandler(controllers.scans.list));
  // Before `/:id`, or "status" would be read as a scan id.
  router.get('/scans/status', asyncHandler(controllers.scans.status));
  router.post('/scans/start', asyncHandler(controllers.scans.start));
  router.post('/scans/stop', asyncHandler(controllers.scans.stop));
  router.get('/scans/:id', asyncHandler(controllers.scans.get));

  router.get('/issues', asyncHandler(controllers.issues.list));
  router.patch('/issues/:id', asyncHandler(controllers.issues.update));

  router.get('/settings', asyncHandler(controllers.settings.get));
  router.put('/settings', asyncHandler(controllers.settings.update));
  router.get('/settings/models', asyncHandler(controllers.settings.models));

  router.get('/agents', asyncHandler(controllers.agents.list));
  router.get('/agents/download/:platform', asyncHandler(controllers.agents.download));

  return router;
}
