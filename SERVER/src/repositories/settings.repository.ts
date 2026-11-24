import { Collection, Db } from 'mongodb';

import { SettingsRecord } from '../models/settings.model';

export interface SettingsRepository {
  get(ownerId: string): Promise<SettingsRecord | null>;
  save(ownerId: string, settings: Omit<SettingsRecord, 'updatedAt'>): Promise<SettingsRecord>;
}

interface SettingsDocument extends Omit<SettingsRecord, 'updatedAt'> {
  _id: string;
  updatedAt: Date;
}

function toRecord(document: SettingsDocument): SettingsRecord {
  return {
    ollamaUrl: document.ollamaUrl,
    model: document.model,
    aiReview: document.aiReview,
    aiMaxFiles: document.aiMaxFiles,
    minSeverity: document.minSeverity,
    globalIgnoreGlobs: document.globalIgnoreGlobs ?? [],
    updatedAt: document.updatedAt
  };
}

/** One settings document per account; `_id` is the owner's user id. */
export class MongoSettingsRepository implements SettingsRepository {
  private readonly collection: Collection<SettingsDocument>;

  constructor(db: Db) {
    this.collection = db.collection<SettingsDocument>('settings');
  }

  async get(ownerId: string): Promise<SettingsRecord | null> {
    const document = await this.collection.findOne({ _id: ownerId });

    return document ? toRecord(document) : null;
  }

  async save(
    ownerId: string,
    settings: Omit<SettingsRecord, 'updatedAt'>
  ): Promise<SettingsRecord> {
    const document: SettingsDocument = {
      _id: ownerId,
      ...settings,
      globalIgnoreGlobs: [...settings.globalIgnoreGlobs],
      updatedAt: new Date()
    };

    await this.collection.replaceOne({ _id: ownerId }, document, { upsert: true });

    return toRecord(document);
  }
}
