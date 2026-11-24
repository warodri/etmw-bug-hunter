import { Collection, Db, ObjectId } from 'mongodb';

import { AgentPlatform, AgentRecord } from '../models/agent.model';

export interface AgentRepository {
  list(ownerId: string): Promise<AgentRecord[]>;
  findById(id: string): Promise<AgentRecord | null>;
  findByIdAndOwner(ownerId: string, id: string): Promise<AgentRecord | null>;
  findForPlatform(ownerId: string, platform: AgentPlatform): Promise<AgentRecord | null>;
  create(ownerId: string, name: string, platform: AgentPlatform): Promise<AgentRecord>;
  touch(id: string, at: Date): Promise<void>;
  setOnline(id: string, online: boolean): Promise<void>;
  markAllOffline(): Promise<void>;
}

interface AgentDocument {
  _id: ObjectId;
  ownerId: string;
  name: string;
  platform: AgentPlatform;
  createdAt: Date;
  lastSeenAt: Date | null;
  online: boolean;
}

function toRecord(document: AgentDocument): AgentRecord {
  return {
    id: document._id.toHexString(),
    ownerId: document.ownerId,
    name: document.name,
    platform: document.platform,
    createdAt: document.createdAt,
    lastSeenAt: document.lastSeenAt ?? null,
    online: document.online === true
  };
}

export class MongoAgentRepository implements AgentRepository {
  private readonly collection: Collection<AgentDocument>;

  constructor(db: Db) {
    this.collection = db.collection<AgentDocument>('agents');
  }

  async list(ownerId: string): Promise<AgentRecord[]> {
    const documents = await this.collection
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray();

    return documents.map(toRecord);
  }

  async findById(id: string): Promise<AgentRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const document = await this.collection.findOne({ _id: new ObjectId(id) });

    return document ? toRecord(document) : null;
  }

  async findByIdAndOwner(ownerId: string, id: string): Promise<AgentRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const document = await this.collection.findOne({ _id: new ObjectId(id), ownerId });

    return document ? toRecord(document) : null;
  }

  async findForPlatform(ownerId: string, platform: AgentPlatform): Promise<AgentRecord | null> {
    const document = await this.collection
      .find({ ownerId, platform })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    return document ? toRecord(document) : null;
  }

  async create(ownerId: string, name: string, platform: AgentPlatform): Promise<AgentRecord> {
    const document: AgentDocument = {
      _id: new ObjectId(),
      ownerId,
      name,
      platform,
      createdAt: new Date(),
      lastSeenAt: null,
      online: false
    };

    await this.collection.insertOne(document);

    return toRecord(document);
  }

  async touch(id: string, at: Date): Promise<void> {
    if (!ObjectId.isValid(id)) return;

    await this.collection.updateOne({ _id: new ObjectId(id) }, { $set: { lastSeenAt: at } });
  }

  async setOnline(id: string, online: boolean): Promise<void> {
    if (!ObjectId.isValid(id)) return;

    await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { online, lastSeenAt: new Date() } }
    );
  }

  async markAllOffline(): Promise<void> {
    await this.collection.updateMany({ online: true }, { $set: { online: false } });
  }
}
