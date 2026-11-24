import { Db, MongoClient } from 'mongodb';

import { appConfig } from '../config/env';

/**
 * The Atlas connection.
 *
 * Bug Hunter keeps its data in its own database (`etmw_bug_hunter`), never in another ETMW app's
 * database. Indexes are created at boot so a unique guarantee exists before the first request.
 */
export class MongoService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<Db> {
    if (this.db) return this.db;

    if (!appConfig.mongo.uri) {
      throw new Error(
        'MONGODB_URI is not configured. Add it to SERVER/.env (source: MY-ENV-FILE).'
      );
    }

    this.client = new MongoClient(appConfig.mongo.uri, { serverSelectionTimeoutMS: 15_000 });
    await this.client.connect();
    this.db = this.client.db(appConfig.mongo.databaseName);

    return this.db;
  }

  get database(): Db {
    if (!this.db) throw new Error('MongoService.connect() has not completed.');

    return this.db;
  }

  async ping(): Promise<void> {
    await this.database.command({ ping: 1 });
  }

  async ensureIndexes(): Promise<void> {
    const db = this.database;

    await db.collection('users').createIndex({ email: 1 }, { unique: true }).catch(() => undefined);
    await db
      .collection('auth_codes')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .catch(() => undefined);

    await db
      .collection('agents')
      .createIndex({ ownerId: 1, platform: 1 })
      .catch(() => undefined);
    await db.collection('agents').createIndex({ online: 1 }).catch(() => undefined);

    await db
      .collection('projects')
      .createIndex({ ownerId: 1, updatedAt: -1 })
      .catch(() => undefined);
    await db
      .collection('projects')
      .createIndex({ updatedAt: -1 })
      .catch(() => undefined);

    await db
      .collection('scans')
      .createIndex({ ownerId: 1, createdAt: -1 })
      .catch(() => undefined);
    await db
      .collection('scans')
      .createIndex({ ownerId: 1, state: 1 })
      .catch(() => undefined);
    await db
      .collection('scans')
      .createIndex({ projectId: 1, createdAt: -1 })
      .catch(() => undefined);
    await db.collection('scans').createIndex({ state: 1 }).catch(() => undefined);

    await db
      .collection('issues')
      .createIndex({ ownerId: 1, scanId: 1 })
      .catch(() => undefined);
    await db
      .collection('issues')
      .createIndex({ scanId: 1, filePath: 1, detectorId: 1, line: 1 })
      .catch(() => undefined);
    await db
      .collection('issues')
      .createIndex({ ownerId: 1, projectId: 1, status: 1, severity: 1 })
      .catch(() => undefined);
    await db
      .collection('issues')
      .createIndex({ projectId: 1, status: 1, severity: 1 })
      .catch(() => undefined);
    await db.collection('issues').createIndex({ createdAt: -1 }).catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.db = null;
  }
}
