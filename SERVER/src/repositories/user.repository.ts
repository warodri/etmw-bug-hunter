import { Collection, Db, ObjectId } from 'mongodb';

import { UserRecord } from '../models/user.model';

export interface FindOrCreateResult {
  readonly user: UserRecord;
  readonly created: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findOrCreate(email: string): Promise<FindOrCreateResult>;
  count(): Promise<number>;
}

interface UserDocument {
  _id: ObjectId;
  email: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

function toRecord(document: UserDocument): UserRecord {
  return {
    id: document._id.toHexString(),
    email: document.email,
    createdAt: document.createdAt,
    lastLoginAt: document.lastLoginAt ?? null
  };
}

export class MongoUserRepository implements UserRepository {
  private readonly collection: Collection<UserDocument>;

  constructor(db: Db) {
    this.collection = db.collection<UserDocument>('users');
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!ObjectId.isValid(id)) return null;

    const document = await this.collection.findOne({ _id: new ObjectId(id) });

    return document ? toRecord(document) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const document = await this.collection.findOne({ email });

    return document ? toRecord(document) : null;
  }

  async findOrCreate(email: string): Promise<FindOrCreateResult> {
    const now = new Date();
    const existing = await this.collection.findOne({ email });

    if (existing) {
      await this.collection.updateOne({ _id: existing._id }, { $set: { lastLoginAt: now } });

      return { user: toRecord({ ...existing, lastLoginAt: now }), created: false };
    }

    const document: UserDocument = {
      _id: new ObjectId(),
      email,
      createdAt: now,
      lastLoginAt: now
    };

    await this.collection.insertOne(document);

    return { user: toRecord(document), created: true };
  }

  count(): Promise<number> {
    return this.collection.countDocuments();
  }
}
