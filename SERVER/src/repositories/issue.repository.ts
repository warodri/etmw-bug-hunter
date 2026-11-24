import { Collection, Db, ObjectId } from 'mongodb';

import { SEVERITY_ORDER, Severity } from '../constants/severity';
import { IssueCounts, IssueRecord, IssueStatus } from '../models/issue.model';

export interface IssueFilters {
  readonly scanId?: string;
  readonly projectId?: string;
  readonly severity?: Severity;
  readonly status?: IssueStatus;
  readonly detectorId?: string;
  readonly search?: string;
}

export interface IssuePage {
  readonly issues: IssueRecord[];
  readonly total: number;
}

export interface IssueRepository {
  list(
    ownerId: string,
    filters: IssueFilters,
    page: number,
    pageSize: number
  ): Promise<IssuePage>;
  insertMany(
    ownerId: string,
    records: Omit<IssueRecord, 'id' | 'ownerId' | 'createdAt'>[]
  ): Promise<number>;
  counts(
    ownerId: string,
    filters: Pick<IssueFilters, 'projectId' | 'scanId'>
  ): Promise<IssueCounts>;
  setStatus(ownerId: string, id: string, status: IssueStatus): Promise<IssueRecord | null>;
  removeByScan(ownerId: string, scanId: string): Promise<number>;
  removeByProject(ownerId: string, projectId: string): Promise<number>;
}

interface IssueDocument extends Omit<IssueRecord, 'id' | 'createdAt'> {
  _id: ObjectId;
  createdAt: Date;
}

function toRecord(document: IssueDocument): IssueRecord {
  return {
    id: document._id.toHexString(),
    ownerId: document.ownerId,
    scanId: document.scanId,
    projectId: document.projectId,
    filePath: document.filePath,
    line: document.line ?? null,
    column: document.column ?? null,
    detectorId: document.detectorId,
    rule: document.rule,
    category: document.category,
    severity: document.severity,
    message: document.message,
    snippet: document.snippet ?? '',
    aiGenerated: document.aiGenerated === true,
    status: document.status,
    createdAt: document.createdAt
  };
}

function buildFilter(ownerId: string, filters: IssueFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = { ownerId };

  if (filters.scanId) filter.scanId = filters.scanId;
  if (filters.projectId) filter.projectId = filters.projectId;
  if (filters.severity) filter.severity = filters.severity;
  if (filters.status) filter.status = filters.status;
  if (filters.detectorId) filter.detectorId = filters.detectorId;

  if (filters.search?.trim()) {
    const escaped = filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    filter.$or = [{ filePath: pattern }, { message: pattern }, { rule: pattern }];
  }

  return filter;
}

export class MongoIssueRepository implements IssueRepository {
  private readonly collection: Collection<IssueDocument>;

  constructor(db: Db) {
    this.collection = db.collection<IssueDocument>('issues');
  }

  async list(
    ownerId: string,
    filters: IssueFilters,
    page: number,
    pageSize: number
  ): Promise<IssuePage> {
    const filter = buildFilter(ownerId, filters);

    const [documents, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort({ createdAt: -1, severity: 1, filePath: 1, line: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      this.collection.countDocuments(filter)
    ]);

    return { issues: documents.map(toRecord), total };
  }

  async insertMany(
    ownerId: string,
    records: Omit<IssueRecord, 'id' | 'ownerId' | 'createdAt'>[]
  ): Promise<number> {
    if (records.length === 0) return 0;

    const createdAt = new Date();
    const documents: IssueDocument[] = records.map((record) => ({
      _id: new ObjectId(),
      ownerId,
      ...record,
      createdAt
    }));

    const result = await this.collection.insertMany(documents);

    return result.insertedCount;
  }

  async counts(
    ownerId: string,
    filters: Pick<IssueFilters, 'projectId' | 'scanId'>
  ): Promise<IssueCounts> {
    const match: Record<string, unknown> = { ownerId, status: 'open' };

    if (filters.projectId) match.projectId = filters.projectId;
    if (filters.scanId) match.scanId = filters.scanId;

    const rows = await this.collection
      .aggregate<{ _id: Severity; count: number }>([
        { $match: match },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
      .toArray();

    const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((key) => [key, 0])) as Record<
      Severity,
      number
    >;

    let total = 0;

    for (const row of rows) {
      if (row._id in bySeverity) {
        bySeverity[row._id] = row.count;
        total += row.count;
      }
    }

    return { total, bySeverity };
  }

  async setStatus(
    ownerId: string,
    id: string,
    status: IssueStatus
  ): Promise<IssueRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), ownerId },
      { $set: { status } },
      { returnDocument: 'after' }
    );

    return result ? toRecord(result) : null;
  }

  async removeByScan(ownerId: string, scanId: string): Promise<number> {
    const result = await this.collection.deleteMany({ ownerId, scanId });

    return result.deletedCount ?? 0;
  }

  async removeByProject(ownerId: string, projectId: string): Promise<number> {
    const result = await this.collection.deleteMany({ ownerId, projectId });

    return result.deletedCount ?? 0;
  }
}
