import { Collection, Db } from 'mongodb';

export interface AuthCodeRecord {
  readonly email: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
  readonly attempts: number;
}

export interface AuthCodeRepository {
  save(record: AuthCodeRecord): Promise<void>;
  find(email: string): Promise<AuthCodeRecord | null>;
  incrementAttempts(email: string): Promise<void>;
  remove(email: string): Promise<void>;
}

interface AuthCodeDocument extends AuthCodeRecord {
  _id: string;
}

function toRecord(document: AuthCodeDocument): AuthCodeRecord {
  return {
    email: document.email,
    codeHash: document.codeHash,
    expiresAt: document.expiresAt,
    attempts: document.attempts ?? 0
  };
}

export class MongoAuthCodeRepository implements AuthCodeRepository {
  private readonly collection: Collection<AuthCodeDocument>;

  constructor(db: Db) {
    this.collection = db.collection<AuthCodeDocument>('auth_codes');
  }

  async save(record: AuthCodeRecord): Promise<void> {
    await this.collection.updateOne(
      { _id: record.email },
      {
        $set: {
          email: record.email,
          codeHash: record.codeHash,
          expiresAt: record.expiresAt,
          attempts: record.attempts
        },
        $setOnInsert: { _id: record.email }
      },
      { upsert: true }
    );
  }

  async find(email: string): Promise<AuthCodeRecord | null> {
    const document = await this.collection.findOne({ _id: email });

    return document ? toRecord(document) : null;
  }

  async incrementAttempts(email: string): Promise<void> {
    await this.collection.updateOne({ _id: email }, { $inc: { attempts: 1 } });
  }

  async remove(email: string): Promise<void> {
    await this.collection.deleteOne({ _id: email });
  }
}
