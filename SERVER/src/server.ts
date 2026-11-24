import { Server } from 'node:http';

import { createApp } from './app';
import { appConfig } from './config/env';
import { AgentHub } from './services/agent-hub.service';
import { MongoService } from './services/mongo.service';

async function bootstrap(): Promise<void> {
  const mongoService = new MongoService();
  const db = await mongoService.connect();

  await mongoService.ensureIndexes();
  await mongoService.ping();

  const created = createApp(db);

  // A fresh process has no live sockets, so every agent record starts offline.
  await created.agentService.markAllOffline();

  const server: Server = created.app.listen(appConfig.port, appConfig.host, () => {
    console.log(
      `[server] ETMW Bug Hunter API (${appConfig.nodeEnv}) listening on ` +
        `http://${appConfig.host}:${appConfig.port} — database ${appConfig.mongo.databaseName}.`
    );
  });

  const hub = new AgentHub(server, {
    agents: created.agentService,
    scans: created.scans,
    issues: created.issues,
    projects: created.projectService,
    settings: created.settingsService
  });

  created.scanRunner.attachAgentHub(hub);
  created.agentController.attachHub(hub);

  // A scan that was running when the process stopped resumes from its stored cursor. Agent scans
  // cannot resume, and the hub closes them honestly when the connection is gone.
  await created.scanRunner.resumeIfRunning();
  console.log('[server] Scan state restored from the database.');

  let stopping = false;

  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;

    console.log(`[server] ${signal} received — shutting down.`);

    hub.close();
    server.close(() => {
      void (async () => {
        await mongoService.close().catch(() => undefined);
        process.exit(0);
      })();
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('[server] Failed to start.', error);
  process.exit(1);
});
