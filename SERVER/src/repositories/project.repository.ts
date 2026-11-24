import { Collection, Db, ObjectId } from 'mongodb';

import { ProjectDetails, ProjectMode, ProjectRecord } from '../models/project.model';

export type ProjectPatch = Partial<ProjectDetails>;

export interface ProjectRepository {
  list(ownerId: string): Promise<ProjectRecord[]>;
  findById(ownerId: string, id: string): Promise<ProjectRecord | null>;
  create(ownerId: string, details: ProjectDetails): Promise<ProjectRecord>;
  update(ownerId: string, id: string, patch: ProjectPatch): Promise<ProjectRecord | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
  touchLastScan(ownerId: string, id: string, at: Date): Promise<void>;
}

interface ProjectDocument {
  _id: ObjectId;
  ownerId: string;
  name: string;
  path: string;
  description: string;
  ignoreGlobs: string[];
  enabled: boolean;
  mode?: ProjectMode;
  agentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastScanAt?: Date | null;
}

function toRecord(document: ProjectDocument): ProjectRecord {
  return {
    id: document._id.toHexString(),
    ownerId: document.ownerId,
    name: document.name,
    path: document.path,
    description: document.description ?? '',
    ignoreGlobs: document.ignoreGlobs ?? [],
    enabled: document.enabled !== false,
    mode: document.mode === 'agent' ? 'agent' : 'local',
    agentId: document.agentId ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    lastScanAt: document.lastScanAt ?? null
  };
}

export class MongoProjectRepository implements ProjectRepository {
  private readonly collection: Collection<ProjectDocument>;

  constructor(db: Db) {
    this.collection = db.collection<ProjectDocument>('projects');
  }

  async list(ownerId: string): Promise<ProjectRecord[]> {
    const documents = await this.collection
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .toArray();

    return documents.map(toRecord);
  }

  async findById(ownerId: string, id: string): Promise<ProjectRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const document = await this.collection.findOne({ _id: new ObjectId(id), ownerId });

    return document ? toRecord(document) : null;
  }

  async create(ownerId: string, details: ProjectDetails): Promise<ProjectRecord> {
    const now = new Date();
    const document: ProjectDocument = {
      _id: new ObjectId(),
      ownerId,
      name: details.name,
      path: details.path,
      description: details.description,
      ignoreGlobs: [...details.ignoreGlobs],
      enabled: details.enabled,
      mode: details.mode,
      agentId: details.agentId,
      createdAt: now,
      updatedAt: now,
      lastScanAt: null
    };

    await this.collection.insertOne(document);

    return toRecord(document);
  }

  async update(ownerId: string, id: string, patch: ProjectPatch): Promise<ProjectRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const change: Partial<ProjectDocument> = { updatedAt: new Date() };

    if (patch.name !== undefined) change.name = patch.name;
    if (patch.path !== undefined) change.path = patch.path;
    if (patch.description !== undefined) change.description = patch.description;
    if (patch.ignoreGlobs !== undefined) change.ignoreGlobs = [...patch.ignoreGlobs];
    if (patch.enabled !== undefined) change.enabled = patch.enabled;
    if (patch.mode !== undefined) change.mode = patch.mode;
    if (patch.agentId !== undefined) change.agentId = patch.agentId;

    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), ownerId },
      { $set: change },
      { returnDocument: 'after' }
    );

    return result ? toRecord(result) : null;
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;

    const result = await this.collection.deleteOne({ _id: new ObjectId(id), ownerId });

    return result.deletedCount === 1;
  }

  async touchLastScan(ownerId: string, id: string, at: Date): Promise<void> {
    if (!ObjectId.isValid(id)) return;

    await this.collection.updateOne(
      { _id: new ObjectId(id), ownerId },
      { $set: { lastScanAt: at } }
    );
  }
}
