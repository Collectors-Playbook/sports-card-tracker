import BetterSqlite3 from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, like, desc, asc, sql, count } from 'drizzle-orm';
import { Card, CardInput, User, UserInput, Collection, CollectionInput, CollectionStats, Job, JobInput, JobStatus, AuditLogEntry, AuditLogInput, AuditLogQuery } from './types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as schema from './db/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const { users, collections, cards, jobs, auditLogs } = schema;

// Baseline SQL executed for in-memory databases (no migration journal needed)
const BASELINE_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  username text NOT NULL,
  email text NOT NULL,
  passwordHash text NOT NULL,
  role text DEFAULT 'user' NOT NULL,
  isActive integer DEFAULT 1 NOT NULL,
  profilePhoto text,
  createdAt text NOT NULL,
  updatedAt text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY NOT NULL,
  userId text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '' NOT NULL,
  icon text DEFAULT '',
  color text DEFAULT '#4F46E5',
  isDefault integer DEFAULT 0,
  visibility text DEFAULT 'private',
  tags text DEFAULT '[]',
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS cards (
  id text PRIMARY KEY NOT NULL,
  userId text DEFAULT '' NOT NULL,
  collectionId text,
  collectionType text DEFAULT 'Inventory' NOT NULL,
  player text NOT NULL,
  team text NOT NULL,
  year integer NOT NULL,
  brand text NOT NULL,
  category text NOT NULL,
  cardNumber text NOT NULL,
  parallel text,
  condition text NOT NULL,
  gradingCompany text,
  setName text,
  serialNumber text,
  grade text,
  isRookie integer DEFAULT 0,
  isAutograph integer DEFAULT 0,
  isRelic integer DEFAULT 0,
  isNumbered integer DEFAULT 0,
  isGraded integer DEFAULT 0,
  purchasePrice real NOT NULL,
  purchaseDate text NOT NULL,
  sellPrice real,
  sellDate text,
  currentValue real NOT NULL,
  images text DEFAULT '[]' NOT NULL,
  notes text DEFAULT '' NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  payload text DEFAULT '{}' NOT NULL,
  result text,
  error text,
  progress real DEFAULT 0 NOT NULL,
  totalItems integer DEFAULT 0 NOT NULL,
  completedItems integer DEFAULT 0 NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY NOT NULL,
  userId text,
  action text NOT NULL,
  entity text NOT NULL,
  entityId text,
  details text,
  ipAddress text,
  createdAt text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entityId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs (userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs (createdAt);
`;

class Database {
  private sqlite: BetterSqlite3.Database;
  private db: BetterSQLite3Database<typeof schema>;
  private ready: Promise<void>;

  constructor(dbPath: string = ':memory:') {
    this.sqlite = new BetterSqlite3(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });

    if (dbPath === ':memory:') {
      this.sqlite.exec(BASELINE_SQL);
      this.ready = Promise.resolve();
    } else {
      const migrationsFolder = path.resolve(__dirname, '..', 'drizzle');
      if (fs.existsSync(migrationsFolder)) {
        // If this is a pre-existing DB that predates Drizzle migrations,
        // seed the migration journal so the baseline is skipped.
        this.ensureMigrationJournal();
        migrate(this.db, { migrationsFolder });
      } else {
        this.sqlite.exec(BASELINE_SQL);
      }
      this.ready = Promise.resolve();
    }
  }

  /**
   * For pre-existing databases that were created before Drizzle migrations,
   * seed the __drizzle_migrations table so the baseline migration is skipped.
   */
  private ensureMigrationJournal(): void {
    const hasTable = this.sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get();

    if (!hasTable) return; // Fresh DB — migrator will handle everything

    // Create journal table if it doesn't exist
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        hash text NOT NULL,
        created_at numeric
      );
    `);

    const journalCount = this.sqlite.prepare(
      'SELECT COUNT(*) as cnt FROM __drizzle_migrations'
    ).get() as { cnt: number };

    if (journalCount.cnt > 0) return; // Already has migration records

    // Tables exist but no migration records — this is a pre-Drizzle DB.
    // Mark the baseline migration as already applied.
    const migrationsFolder = path.resolve(__dirname, '..', 'drizzle');
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    const baselineEntry = journal.entries[0];
    const migrationSql = fs.readFileSync(
      path.join(migrationsFolder, `${baselineEntry.tag}.sql`), 'utf-8'
    );
    // Drizzle uses SHA-256 to hash migration SQL
    const hash = crypto.createHash('sha256').update(migrationSql).digest('hex');
    this.sqlite.prepare(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
    ).run(hash, baselineEntry.when);
  }

  public async waitReady(): Promise<void> {
    await this.ready;
  }

  // ─── Cards ───────────────────────────────────────────────────────────────────

  public async getAllCards(filters?: { userId?: string; collectionId?: string; collectionType?: string }): Promise<Card[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(cards.userId, filters.userId));
    if (filters?.collectionId) conditions.push(eq(cards.collectionId, filters.collectionId));
    if (filters?.collectionType) conditions.push(eq(cards.collectionType, filters.collectionType as 'PC' | 'Inventory' | 'Pending'));

    const rows = this.db.select().from(cards)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cards.createdAt))
      .all();

    return rows.map(row => this.mapCardRow(row));
  }

  public async getCardById(id: string): Promise<Card | undefined> {
    const row = this.db.select().from(cards).where(eq(cards.id, id)).get();
    if (!row) return undefined;
    return this.mapCardRow(row);
  }

  public async createCard(cardInput: CardInput): Promise<Card> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const card: Card = {
      id,
      userId: cardInput.userId || '',
      collectionId: cardInput.collectionId,
      collectionType: cardInput.collectionType || 'Inventory',
      player: cardInput.player,
      team: cardInput.team,
      year: cardInput.year,
      brand: cardInput.brand,
      category: cardInput.category,
      cardNumber: cardInput.cardNumber,
      parallel: cardInput.parallel,
      condition: cardInput.condition,
      gradingCompany: cardInput.gradingCompany,
      setName: cardInput.setName,
      serialNumber: cardInput.serialNumber,
      grade: cardInput.grade,
      isRookie: cardInput.isRookie,
      isAutograph: cardInput.isAutograph,
      isRelic: cardInput.isRelic,
      isNumbered: cardInput.isNumbered,
      isGraded: cardInput.isGraded,
      purchasePrice: cardInput.purchasePrice,
      purchaseDate: cardInput.purchaseDate,
      sellPrice: cardInput.sellPrice,
      sellDate: cardInput.sellDate,
      currentValue: cardInput.currentValue,
      images: cardInput.images || [],
      notes: cardInput.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(cards).values({
      id: card.id,
      userId: card.userId,
      collectionId: card.collectionId || null,
      collectionType: card.collectionType,
      player: card.player,
      team: card.team,
      year: card.year,
      brand: card.brand,
      category: card.category,
      cardNumber: card.cardNumber,
      parallel: card.parallel || null,
      condition: card.condition,
      gradingCompany: card.gradingCompany || null,
      setName: card.setName || null,
      serialNumber: card.serialNumber || null,
      grade: card.grade || null,
      isRookie: card.isRookie ? true : false,
      isAutograph: card.isAutograph ? true : false,
      isRelic: card.isRelic ? true : false,
      isNumbered: card.isNumbered ? true : false,
      isGraded: card.isGraded ? true : false,
      purchasePrice: card.purchasePrice,
      purchaseDate: card.purchaseDate,
      sellPrice: card.sellPrice || null,
      sellDate: card.sellDate || null,
      currentValue: card.currentValue,
      images: card.images,
      notes: card.notes,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    }).run();

    return card;
  }

  public async updateCard(id: string, cardInput: CardInput): Promise<Card | undefined> {
    const existing = await this.getCardById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();

    this.db.update(cards).set({
      userId: cardInput.userId || existing.userId,
      collectionId: cardInput.collectionId || null,
      collectionType: cardInput.collectionType || existing.collectionType,
      player: cardInput.player,
      team: cardInput.team,
      year: cardInput.year,
      brand: cardInput.brand,
      category: cardInput.category,
      cardNumber: cardInput.cardNumber,
      parallel: cardInput.parallel || null,
      condition: cardInput.condition,
      gradingCompany: cardInput.gradingCompany || null,
      setName: cardInput.setName || null,
      serialNumber: cardInput.serialNumber || null,
      grade: cardInput.grade || null,
      isRookie: cardInput.isRookie ? true : false,
      isAutograph: cardInput.isAutograph ? true : false,
      isRelic: cardInput.isRelic ? true : false,
      isNumbered: cardInput.isNumbered ? true : false,
      isGraded: cardInput.isGraded ? true : false,
      purchasePrice: cardInput.purchasePrice,
      purchaseDate: cardInput.purchaseDate,
      sellPrice: cardInput.sellPrice || null,
      sellDate: cardInput.sellDate || null,
      currentValue: cardInput.currentValue,
      images: cardInput.images || [],
      notes: cardInput.notes || '',
      updatedAt,
    }).where(eq(cards.id, id)).run();

    return {
      ...existing,
      ...cardInput,
      id,
      userId: cardInput.userId || existing.userId,
      collectionType: cardInput.collectionType || existing.collectionType,
      images: cardInput.images || [],
      notes: cardInput.notes || '',
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  public async getCardByImage(imageFilename: string): Promise<Card | undefined> {
    const rows = this.db.select().from(cards)
      .where(like(cards.images, `%${imageFilename}%`))
      .all();
    if (rows.length === 0) return undefined;
    return this.mapCardRow(rows[0]);
  }

  private mapCardRow(row: typeof cards.$inferSelect): Card {
    return {
      ...row,
      collectionId: row.collectionId ?? undefined,
      collectionType: (row.collectionType || 'Inventory') as 'PC' | 'Inventory' | 'Pending',
      parallel: row.parallel ?? undefined,
      gradingCompany: row.gradingCompany ?? undefined,
      setName: row.setName ?? undefined,
      serialNumber: row.serialNumber ?? undefined,
      grade: row.grade ?? undefined,
      isRookie: !!(row.isRookie),
      isAutograph: !!(row.isAutograph),
      isRelic: !!(row.isRelic),
      isNumbered: !!(row.isNumbered),
      isGraded: !!(row.isGraded),
      sellPrice: row.sellPrice ?? undefined,
      sellDate: row.sellDate ?? undefined,
      images: row.images ?? [],
      notes: row.notes || '',
    };
  }

  public async deleteCard(id: string): Promise<boolean> {
    const result = this.db.delete(cards).where(eq(cards.id, id)).run();
    return result.changes > 0;
  }

  // ─── Users ───────────────────────────────────────────────────────────────────

  public async getAllUsers(): Promise<User[]> {
    const rows = this.db.select().from(users).orderBy(desc(users.createdAt)).all();
    return rows.map(row => this.mapUserRow(row));
  }

  public async getUserById(id: string): Promise<User | undefined> {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    if (!row) return undefined;
    return this.mapUserRow(row);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const row = this.db.select().from(users).where(eq(users.email, email)).get();
    if (!row) return undefined;
    return this.mapUserRow(row);
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    const row = this.db.select().from(users).where(eq(users.username, username)).get();
    if (!row) return undefined;
    return this.mapUserRow(row);
  }

  private mapUserRow(row: typeof users.$inferSelect): User {
    return {
      ...row,
      role: (row.role || 'user') as 'admin' | 'user',
      isActive: !!(row.isActive),
      profilePhoto: row.profilePhoto ?? null,
    };
  }

  public async createUser(input: UserInput): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(input.password, 10);

    const user: User = {
      id,
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role || 'user',
      isActive: true,
      profilePhoto: null,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(users).values({
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      isActive: true,
      profilePhoto: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }).run();

    return user;
  }

  public async updateUser(id: string, updates: Partial<Pick<User, 'username' | 'email' | 'role' | 'isActive' | 'profilePhoto'>>): Promise<User | undefined> {
    const existing = await this.getUserById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: User = { ...existing, ...updates, updatedAt };

    this.db.update(users).set({
      username: updated.username,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
      profilePhoto: updated.profilePhoto,
      updatedAt,
    }).where(eq(users.id, id)).run();

    return updated;
  }

  public async updateUserPassword(id: string, newPasswordHash: string): Promise<boolean> {
    const updatedAt = new Date().toISOString();
    const result = this.db.update(users).set({
      passwordHash: newPasswordHash,
      updatedAt,
    }).where(eq(users.id, id)).run();
    return result.changes > 0;
  }

  public async deleteUser(id: string): Promise<boolean> {
    const result = this.db.delete(users).where(eq(users.id, id)).run();
    return result.changes > 0;
  }

  // ─── Collections ─────────────────────────────────────────────────────────────

  private mapCollectionRow(row: typeof collections.$inferSelect): Collection {
    return {
      ...row,
      description: row.description || '',
      icon: row.icon || '',
      color: row.color || '#4F46E5',
      isDefault: !!(row.isDefault),
      visibility: (row.visibility || 'private') as 'private' | 'public' | 'shared',
      tags: row.tags ?? [],
    };
  }

  public async getAllCollections(userId?: string): Promise<Collection[]> {
    let rows: (typeof collections.$inferSelect)[];
    if (userId) {
      rows = this.db.select().from(collections)
        .where(eq(collections.userId, userId))
        .orderBy(desc(collections.isDefault), asc(collections.name))
        .all();
    } else {
      rows = this.db.select().from(collections)
        .orderBy(desc(collections.createdAt))
        .all();
    }
    return rows.map(row => this.mapCollectionRow(row));
  }

  public async getCollectionById(id: string): Promise<Collection | undefined> {
    const row = this.db.select().from(collections).where(eq(collections.id, id)).get();
    if (!row) return undefined;
    return this.mapCollectionRow(row);
  }

  public async getDefaultCollection(userId: string): Promise<Collection | undefined> {
    const row = this.db.select().from(collections)
      .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
      .get();
    if (!row) return undefined;
    return this.mapCollectionRow(row);
  }

  public async createCollection(input: CollectionInput): Promise<Collection> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const collection: Collection = {
      id,
      userId: input.userId,
      name: input.name,
      description: input.description || '',
      icon: input.icon || '',
      color: input.color || '#4F46E5',
      isDefault: input.isDefault || false,
      visibility: input.visibility || 'private',
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(collections).values({
      id: collection.id,
      userId: collection.userId,
      name: collection.name,
      description: collection.description,
      icon: collection.icon,
      color: collection.color,
      isDefault: collection.isDefault,
      visibility: collection.visibility,
      tags: collection.tags,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    }).run();

    return collection;
  }

  public async updateCollection(id: string, updates: Partial<Omit<Collection, 'id' | 'userId' | 'createdAt'>>): Promise<Collection | undefined> {
    const existing = await this.getCollectionById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: Collection = {
      ...existing,
      ...updates,
      updatedAt,
    };

    this.db.update(collections).set({
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      color: updated.color,
      isDefault: updated.isDefault,
      visibility: updated.visibility,
      tags: updated.tags,
      updatedAt,
    }).where(eq(collections.id, id)).run();

    return updated;
  }

  public async setCollectionAsDefault(collectionId: string, userId: string): Promise<void> {
    // Unset any existing default for this user
    this.db.update(collections).set({ isDefault: false })
      .where(and(eq(collections.userId, userId), eq(collections.isDefault, true)))
      .run();
    // Set the new default
    this.db.update(collections).set({ isDefault: true })
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .run();
  }

  public async getCollectionStats(collectionId: string): Promise<CollectionStats> {
    const rows = this.db.select({
      category: cards.category,
      currentValue: cards.currentValue,
      purchasePrice: cards.purchasePrice,
    }).from(cards)
      .where(eq(cards.collectionId, collectionId))
      .all();

    const stats: CollectionStats = {
      cardCount: rows.length,
      totalValue: rows.reduce((sum, c) => sum + c.currentValue, 0),
      totalCost: rows.reduce((sum, c) => sum + c.purchasePrice, 0),
      categoryBreakdown: {}
    };

    rows.forEach(card => {
      stats.categoryBreakdown[card.category] = (stats.categoryBreakdown[card.category] || 0) + 1;
    });

    return stats;
  }

  public async moveCardsToCollection(cardIds: string[], targetCollectionId: string): Promise<number> {
    const updatedAt = new Date().toISOString();
    let moved = 0;
    for (const cardId of cardIds) {
      const result = this.db.update(cards).set({
        collectionId: targetCollectionId,
        updatedAt,
      }).where(eq(cards.id, cardId)).run();
      if (result.changes > 0) moved++;
    }
    return moved;
  }

  public async initializeUserCollections(userId: string): Promise<Collection> {
    const existing = await this.getDefaultCollection(userId);
    if (existing) return existing;

    return this.createCollection({
      userId,
      name: 'My Collection',
      description: 'Default collection for all cards',
      icon: '',
      color: '#4F46E5',
      isDefault: true,
      visibility: 'private',
      tags: [],
    });
  }

  public async deleteCollection(id: string): Promise<boolean> {
    const result = this.db.delete(collections).where(eq(collections.id, id)).run();
    return result.changes > 0;
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  private mapJobRow(row: typeof jobs.$inferSelect): Job {
    return {
      ...row,
      status: row.status as JobStatus,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      result: (row.result ?? null) as Record<string, unknown> | null,
      error: row.error ?? null,
    };
  }

  public async getAllJobs(filters?: { status?: JobStatus; type?: string; limit?: number }): Promise<Job[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(jobs.status, filters.status));
    if (filters?.type) conditions.push(eq(jobs.type, filters.type));

    let query = this.db.select().from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.createdAt))
      .$dynamic();

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const rows = query.all();
    return rows.map(row => this.mapJobRow(row));
  }

  public async getJobById(id: string): Promise<Job | undefined> {
    const row = this.db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!row) return undefined;
    return this.mapJobRow(row);
  }

  public async createJob(input: JobInput): Promise<Job> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const job: Job = {
      id,
      type: input.type,
      status: 'pending',
      payload: input.payload || {},
      result: null,
      error: null,
      progress: 0,
      totalItems: 0,
      completedItems: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(jobs).values({
      id: job.id,
      type: job.type,
      status: job.status,
      payload: job.payload,
      result: null,
      error: null,
      progress: 0,
      totalItems: 0,
      completedItems: 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }).run();

    return job;
  }

  public async updateJob(id: string, updates: Partial<Pick<Job, 'status' | 'result' | 'error' | 'progress' | 'totalItems' | 'completedItems'>>): Promise<Job | undefined> {
    const existing = await this.getJobById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: Job = { ...existing, ...updates, updatedAt };

    this.db.update(jobs).set({
      status: updated.status,
      result: updated.result,
      error: updated.error,
      progress: updated.progress,
      totalItems: updated.totalItems,
      completedItems: updated.completedItems,
      updatedAt,
    }).where(eq(jobs.id, id)).run();

    return updated;
  }

  public async getNextPendingJob(): Promise<Job | undefined> {
    const row = this.db.select().from(jobs)
      .where(eq(jobs.status, 'pending'))
      .orderBy(asc(jobs.createdAt))
      .limit(1)
      .get();
    if (!row) return undefined;
    return this.mapJobRow(row);
  }

  // ─── Audit Logs ─────────────────────────────────────────────────────────────

  public async insertAuditLog(input: AuditLogInput): Promise<AuditLogEntry> {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const entry: AuditLogEntry = {
      id,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
      ipAddress: input.ipAddress ?? null,
      createdAt,
    };

    this.db.insert(auditLogs).values({
      id: entry.id,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt,
    }).run();

    return entry;
  }

  public async queryAuditLogs(query: AuditLogQuery): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const conditions = [];
    if (query.userId) conditions.push(eq(auditLogs.userId, query.userId));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.entity) conditions.push(eq(auditLogs.entity, query.entity));
    if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = this.db.select({ value: count() }).from(auditLogs).where(whereClause).get();
    const total = countResult?.value ?? 0;

    const allowedSortColumns = ['createdAt', 'action', 'entity', 'entityId'];
    const sortCol = query.sortBy && allowedSortColumns.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = query.sortDirection === 'asc' ? 'ASC' : 'DESC';

    const limit = query.limit ?? 50;

    let dbQuery = this.db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(sql.raw(`${sortCol} ${sortDir}`))
      .limit(limit)
      .$dynamic();

    if (query.offset) {
      dbQuery = dbQuery.offset(query.offset);
    }

    const rows = dbQuery.all();
    const entries: AuditLogEntry[] = rows.map(row => ({
      ...row,
      details: (row.details ?? null) as Record<string, unknown> | null,
    }));

    return { entries, total };
  }

  public async getDistinctAuditActions(): Promise<string[]> {
    const rows = this.db.selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action))
      .all();
    return rows.map(r => r.action);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  public close(): Promise<void> {
    this.sqlite.close();
    return Promise.resolve();
  }
}

export default Database;
