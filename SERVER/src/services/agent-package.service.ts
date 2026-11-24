import { existsSync } from 'node:fs';
import path from 'node:path';

import archiver from 'archiver';
import { Response } from 'express';

import { appConfig } from '../config/env';
import { HttpError } from '../errors/http-error';
import { AgentPlatform, AgentRecord } from '../models/agent.model';

export interface ZipInput {
  readonly agent: AgentRecord;
  readonly token: string;
  readonly platform: AgentPlatform;
}

const AGENT_SOURCE_DIR = 'agent';
const INSTALLER_DIR = 'installers';

/**
 * Builds the download on demand: one config with the account's agent token, the same compiled
 * scanner the server runs, and the two installers. Nothing secret is written to disk.
 */
export class AgentPackageService {
  async write(response: Response, input: ZipInput): Promise<void> {
    const root = appConfig.agent.packageDir;
    const required = [
      path.join(root, AGENT_SOURCE_DIR, 'agent.cjs'),
      path.join(root, AGENT_SOURCE_DIR, 'package.json'),
      path.join(root, INSTALLER_DIR, 'install-mac.sh'),
      path.join(root, INSTALLER_DIR, 'install-windows.ps1')
    ];

    const missing = required.filter((file) => !existsSync(file));

    if (missing.length > 0) {
      throw new HttpError(
        500,
        `The desktop package is incomplete. Missing: ${missing.map((file) => path.basename(file)).join(', ')}`
      );
    }

    const distRoot = path.resolve(process.cwd(), 'dist');
    const scannerRoot = path.join(distRoot, 'services', 'scanner');

    if (!existsSync(path.join(scannerRoot, 'file-walker.js'))) {
      throw new HttpError(
        500,
        'The server scanner has not been built. Run npm run build before downloading the agent.'
      );
    }

    const config = {
      serverUrl: appConfig.agent.wsUrl,
      apiUrl: appConfig.agent.apiUrl,
      agentId: input.agent.id,
      agentName: input.agent.name,
      platform: input.platform,
      token: input.token
    };

    const filename = `etmw-bug-hunter-agent-${input.platform}.zip`;

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Cache-Control', 'no-store');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (error) => {
      response.destroy(error);
    });

    archive.pipe(response);

    archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });
    archive.file(path.join(root, AGENT_SOURCE_DIR, 'agent.cjs'), { name: 'agent.cjs' });
    archive.file(path.join(root, AGENT_SOURCE_DIR, 'package.json'), { name: 'package.json' });
    archive.file(path.join(root, INSTALLER_DIR, 'install-mac.sh'), {
      name: 'install-mac.sh',
      mode: 0o755
    });
    archive.file(path.join(root, INSTALLER_DIR, 'install-windows.ps1'), {
      name: 'install-windows.ps1'
    });
    archive.directory(path.join(distRoot, 'constants'), 'dist/constants');
    archive.directory(path.join(distRoot, 'models'), 'dist/models');
    archive.directory(scannerRoot, 'dist/services/scanner');

    const readme = path.join(root, 'README.md');
    if (existsSync(readme)) archive.file(readme, { name: 'README.txt' });

    await archive.finalize();
  }
}
