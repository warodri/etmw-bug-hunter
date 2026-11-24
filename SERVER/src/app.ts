import cookieParser from 'cookie-parser';
import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { Db } from 'mongodb';

import { appConfig, DEFAULT_JSON_BODY_LIMIT } from './config/env';
import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { IssueController } from './controllers/issue.controller';
import { ProjectController } from './controllers/project.controller';
import { ScanController } from './controllers/scan.controller';
import { SettingsController } from './controllers/settings.controller';
import { SummaryController } from './controllers/summary.controller';
import { createCorsMiddleware } from './middleware/cors';
import { createRequireSession } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { noStore } from './middleware/no-store';
import { createRateLimiter } from './middleware/rate-limit';
import { MongoAgentRepository } from './repositories/agent.repository';
import { MongoAuthCodeRepository } from './repositories/auth-code.repository';
import { MongoIssueRepository } from './repositories/issue.repository';
import { MongoProjectRepository } from './repositories/project.repository';
import { MongoScanRepository } from './repositories/scan.repository';
import { MongoSettingsRepository } from './repositories/settings.repository';
import { MongoUserRepository } from './repositories/user.repository';
import { createApiRouter } from './routes/api.routes';
import { AgentPackageService } from './services/agent-package.service';
import { AgentService } from './services/agent.service';
import { AgentTokenService } from './services/agent-token.service';
import { AuthRateLimiter } from './services/auth-rate-limit.service';
import { AuthService } from './services/auth.service';
import { ChallengeService } from './services/challenge.service';
import { EmailService } from './services/email.service';
import { LegacyAdoptionService } from './services/legacy-adoption.service';
import { ProjectService } from './services/project.service';
import { ScanRunner } from './services/scan-runner.service';
import { SettingsService } from './services/settings.service';

export interface CreatedApp {
  readonly app: Express;
  readonly projectService: ProjectService;
  readonly settingsService: SettingsService;
  readonly scanRunner: ScanRunner;
  readonly agentService: AgentService;
  readonly agentController: AgentController;
  readonly scans: MongoScanRepository;
  readonly issues: MongoIssueRepository;
}

/**
 * Assemble the API.
 *
 * Flow is always `route → controller → service → repository`; the database is handed in so the
 * boot sequence owns the connection and a future test can pass a throwaway one.
 */
export function createApp(db: Db): CreatedApp {
  const projects = new MongoProjectRepository(db);
  const scans = new MongoScanRepository(db);
  const issues = new MongoIssueRepository(db);
  const settings = new MongoSettingsRepository(db);
  const users = new MongoUserRepository(db);
  const authCodes = new MongoAuthCodeRepository(db);
  const agentRecords = new MongoAgentRepository(db);

  const agentService = new AgentService(agentRecords, new AgentTokenService());
  const projectService = new ProjectService(projects, scans, issues, agentService);
  const settingsService = new SettingsService(settings);
  const scanRunner = new ScanRunner(projectService, scans, issues, settingsService);

  const authService = new AuthService(
    users,
    authCodes,
    new ChallengeService(),
    new EmailService(),
    new AuthRateLimiter(),
    new LegacyAdoptionService(db)
  );

  const requireSession = createRequireSession(authService);

  const agentController = new AgentController(agentService, new AgentPackageService());
  const controllers = {
    health: new HealthController(),
    auth: new AuthController(authService),
    projects: new ProjectController(projectService),
    scans: new ScanController(scanRunner, scans, projectService),
    issues: new IssueController(issues),
    settings: new SettingsController(settingsService),
    summary: new SummaryController(projectService, scans, issues),
    agents: agentController
  };

  const app = express();

  if (appConfig.trustProxyHops > 0) {
    app.set('trust proxy', appConfig.trustProxyHops);
  }

  app.use(helmet());
  app.use(createCorsMiddleware());
  app.use(createRateLimiter());
  app.use(morgan(appConfig.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: DEFAULT_JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: DEFAULT_JSON_BODY_LIMIT }));
  app.use(cookieParser());

  app.use('/api', noStore);

  app.get('/', (_request, response) => {
    response.json({
      success: true,
      service: 'ETMW Bug Hunter',
      message: 'Reads code and reports issues. It never edits a file.'
    });
  });

  app.use('/api', createApiRouter(controllers, requireSession));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return {
    app,
    projectService,
    settingsService,
    scanRunner,
    agentService,
    agentController,
    scans,
    issues
  };
}
