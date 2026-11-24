import { Collection, Db, ObjectId } from 'mongodb';

import { Severity } from '../constants/severity';
import {
  ScanError,
  ScanExecutor,
  ScanRecord,
  ScanState
} from '../models/scan.model';

export interface ScanPage {
  readonly scans: ScanRecord[];
  readonly total: number;
}

export interface ScanRepository {
  list(ownerId: string, page: number, pageSize: number, projectId?: string): Promise<ScanPage>;
  findById(ownerId: string, id: string): Promise<ScanRecord | null>;
  findRunning(): Promise<ScanRecord[]>;
  findRunningForOwner(ownerId: string): Promise<ScanRecord[]>;
  findLatestForProject(ownerId: string, projectId: string): Promise<ScanRecord | null>;
  findLatestRunning(ownerId: string): Promise<ScanRecord | null>;
  countQueued(ownerId: string): Promise<number>;
  create(ownerId: string, record: Omit<ScanRecord, 'id' | 'ownerId'>): Promise<ScanRecord>;
  update(
    ownerId: string,
    id: string,
    patch: Partial<Omit<ScanRecord, 'id' | 'ownerId' | 'createdAt'>>
  ): Promise<ScanRecord | null>;
  removeByProject(ownerId: string, projectId: string): Promise<number>;
}

interface ScanDocument extends Omit<ScanRecord, 'id'> {
  _id: ObjectId;
}

function toRecord(document: ScanDocument): ScanRecord {
  return {
    id: document._id.toHexString(),
    ownerId: document.ownerId,
    projectId: document.projectId,
    projectName: document.projectName,
    projectPath: document.projectPath,
    executor: document.executor === 'agent' ? 'agent' : 'local',
    state: document.state,
    cursor: document.cursor,
    totalFiles: document.totalFiles,
    filesScanned: document.filesScanned,
    filesSkipped: document.filesSkipped,
    issuesFound: document.issuesFound,
    worstSeverity: document.worstSeverity ?? null,
    aiUsed: document.aiUsed,
    startedAt: document.startedAt ?? null,
    finishedAt: document.finishedAt ?? null,
    durationMs: document.durationMs ?? null,
    error: document.error ?? null,
    errors: document.errors ?? [],
    createdAt: document.createdAt
  };
}

export class MongoScanRepository implements ScanRepository {
  private readonly collection: Collection<ScanDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ScanDocument>('scans');
  }

  async list(
    ownerId: string,
    page: number,
    pageSize: number,
    projectId?: string
  ): Promise<ScanPage> {
    const filter: Record<string, unknown> = { ownerId };

    if (projectId && ObjectId.isValid(projectId)) {
      filter.projectId = new ObjectId(projectId).toHexString();
    }

    const [documents, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.collection.countDocuments(filter)
    ]);

    return { scans: documents.map(toRecord), total };
  }

  async findById(ownerId: string, id: string): Promise<ScanRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const document = await this.collection.findOne({ _id: new ObjectId(id), ownerId });

    return document ? toRecord(document) : null;
  }

  async findRunning(): Promise<ScanRecord[]> {
    const documents = await this.collection
      .find({ state: { $in: ['running', 'queued'] as ScanState[] } })
      .toArray();

    return documents.map(toRecord);
  }

  async findRunningForOwner(ownerId: string): Promise<ScanRecord[]> {
    const documents = await this.collection
      .find({ ownerId, state: { $in: ['running', 'queued'] as ScanState[] } })
      .toArray();

    return documents.map(toRecord);
  }

  async findLatestForProject(ownerId: string, projectId: string): Promise<ScanRecord | null> {
    const document = await this.collection
      .find({ ownerId, projectId })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    return document ? toRecord(document) : null;
  }

  async findLatestRunning(ownerId: string): Promise<ScanRecord | null> {
    const document = await this.collection
      .find({ ownerId, state: { $in: ['running', 'queued'] as ScanState[] } })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    return document ? toRecord(document) : null;
  }

  countQueued(ownerId: string): Promise<number> {
    return this.collection.countDocuments({ ownerId, state: 'queued' });
  }

  async create(
    ownerId: string,
    record: Omit<ScanRecord, 'id' | 'ownerId'>
  ): Promise<ScanRecord> {
    const document: ScanDocument = { _id: new ObjectId(), ownerId, ...record };

    await this.collection.insertOne(document);

    return toRecord(document);
  }

  async update(
    ownerId: string,
    id: string,
    patch: Partial<Omit<ScanRecord, 'id' | 'ownerId' | 'createdAt'>>
  ): Promise<ScanRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const change: Record<string, unknown> = { ...patch };

    if (patch.errors) change.errors = [...patch.errors];

    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), ownerId },
      { $set: change },
      { returnDocument: 'after' }
    );

    return result ? toRecord(result) : null;
  }

  async removeByProject(ownerId: string, projectId: string): Promise<number> {
    const result = await this.collection.deleteMany({ ownerId, projectId });

    return result.deletedCount ?? 0;
  }
}

/** Kept next to the Mongo implementation so callers share one contract. */
export type ScanSeverity = Severity;
export type ScanErrorItem = ScanError;
export type ScanExecutorName = ScanExecutor;
