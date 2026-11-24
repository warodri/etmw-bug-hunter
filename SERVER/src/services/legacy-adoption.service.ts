import { Db } from 'mongodb';

export interface AdoptionResult {
  readonly projects: number;
  readonly scans: number;
  readonly issues: number;
  readonly settings: boolean;
}

/**
 * One-way migration from the pre-accounts database.
 *
 * Every document that existed before login was added has no `ownerId`. The first account (or the
 * account named by `OWNER_EMAIL`) adopts them once, so the owner does not lose their history.
 */
export class LegacyAdoptionService {
  constructor(private readonly db: Db) {}

  async adopt(ownerId: string): Promise<AdoptionResult> {
    const orphan = { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] };
    const set = { $set: { ownerId } };

    const [projects, scans, issues] = await Promise.all([
      this.db.collection('projects').updateMany(orphan, set),
      this.db.collection('scans').updateMany(orphan, set),
      this.db.collection('issues').updateMany(orphan, set)
    ]);

    let settings = false;
    const legacySettings = await this.db.collection('settings').findOne({ _id: 'settings' as never });

    if (legacySettings) {
      const existing = await this.db.collection('settings').findOne({ _id: ownerId as never });

      if (!existing) {
        await this.db
          .collection('settings')
          .insertOne({ ...legacySettings, _id: ownerId } as never);
        settings = true;
      }
    }

    return {
      projects: projects.modifiedCount ?? 0,
      scans: scans.modifiedCount ?? 0,
      issues: issues.modifiedCount ?? 0,
      settings
    };
  }
}
