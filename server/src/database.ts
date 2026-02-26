import BetterSqlite3 from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, like, desc, asc, sql, count, lt, lte, inArray } from 'drizzle-orm';
import { Card, CardInput, User, UserInput, Collection, CollectionInput, CollectionStats, Job, JobInput, JobStatus, AuditLogEntry, AuditLogInput, AuditLogQuery, GradingSubmission, GradingSubmissionInput, GradingStatus, GradingStats, CompReport, CompSale, CompSource, CompResult, StoredCompReport, PopulationData, EbayOAuthTokenRow, EbayOAuthTokenInput, EbayEnvironment } from './types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as schema from './db/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const { users, collections, cards, jobs, gradingSubmissions, auditLogs, compCache, cardCompReports, cardCompSources, popReportSnapshots, cardValueSnapshots, ebayOAuthTokens } = schema;

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

CREATE TABLE IF NOT EXISTS grading_submissions (
  id text PRIMARY KEY NOT NULL,
  userId text NOT NULL,
  cardId text NOT NULL,
  gradingCompany text NOT NULL,
  submissionNumber text NOT NULL,
  status text DEFAULT 'Submitted' NOT NULL,
  tier text DEFAULT 'Regular' NOT NULL,
  cost real DEFAULT 0 NOT NULL,
  declaredValue real DEFAULT 0 NOT NULL,
  submittedAt text NOT NULL,
  receivedAt text,
  gradingAt text,
  shippedAt text,
  completedAt text,
  estimatedReturnDate text,
  grade text,
  notes text DEFAULT '' NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS idx_grading_userId ON grading_submissions (userId);
CREATE INDEX IF NOT EXISTS idx_grading_cardId ON grading_submissions (cardId);
CREATE INDEX IF NOT EXISTS idx_grading_status ON grading_submissions (status);

CREATE TABLE IF NOT EXISTS comp_cache (
  key text PRIMARY KEY NOT NULL,
  source text NOT NULL,
  result text NOT NULL,
  createdAt text NOT NULL,
  expiresAt text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comp_cache_expiresAt ON comp_cache (expiresAt);

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

CREATE TABLE IF NOT EXISTS card_comp_reports (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  condition text,
  aggregateAverage real,
  aggregateLow real,
  aggregateHigh real,
  popMultiplier real,
  popAdjustedAverage real,
  popData text,
  generatedAt text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_comp_reports_cardId ON card_comp_reports (cardId);
CREATE INDEX IF NOT EXISTS idx_comp_reports_generatedAt ON card_comp_reports (generatedAt);

CREATE TABLE IF NOT EXISTS card_comp_sources (
  id text PRIMARY KEY NOT NULL,
  reportId text NOT NULL,
  source text NOT NULL,
  marketValue real,
  averagePrice real,
  low real,
  high real,
  sales text DEFAULT '[]' NOT NULL,
  error text,
  createdAt text NOT NULL,
  FOREIGN KEY (reportId) REFERENCES card_comp_reports(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_comp_sources_reportId ON card_comp_sources (reportId);

CREATE TABLE IF NOT EXISTS pop_report_snapshots (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  gradingCompany text NOT NULL,
  grade text NOT NULL,
  totalGraded integer NOT NULL,
  targetGradePop integer NOT NULL,
  higherGradePop integer NOT NULL,
  percentile real NOT NULL,
  rarityTier text NOT NULL,
  gradeBreakdown text DEFAULT '[]' NOT NULL,
  fetchedAt text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_pop_snapshots_cardId ON pop_report_snapshots (cardId);
CREATE INDEX IF NOT EXISTS idx_pop_snapshots_fetchedAt ON pop_report_snapshots (fetchedAt);

CREATE TABLE IF NOT EXISTS card_value_snapshots (
  id text PRIMARY KEY NOT NULL,
  cardId text NOT NULL,
  value real NOT NULL,
  source text NOT NULL,
  snapshotAt text NOT NULL,
  createdAt text NOT NULL,
  FOREIGN KEY (cardId) REFERENCES cards(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_cardId ON card_value_snapshots (cardId);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_snapshotAt ON card_value_snapshots (snapshotAt);
CREATE INDEX IF NOT EXISTS idx_value_snapshots_cardId_snapshotAt ON card_value_snapshots (cardId, snapshotAt);

CREATE TABLE IF NOT EXISTS ebay_oauth_tokens (
  id text PRIMARY KEY NOT NULL,
  userId text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  accessTokenEncrypted text NOT NULL,
  refreshTokenEncrypted text NOT NULL,
  accessTokenExpiresAt text NOT NULL,
  refreshTokenExpiresAt text NOT NULL,
  ebayUsername text,
  scopes text DEFAULT '' NOT NULL,
  isActive integer DEFAULT 1 NOT NULL,
  createdAt text NOT NULL,
  updatedAt text NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS idx_ebay_oauth_userId ON ebay_oauth_tokens (userId);
CREATE INDEX IF NOT EXISTS idx_ebay_oauth_environment ON ebay_oauth_tokens (environment);
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

    // Auto-create value snapshot when card is created with a value
    if (card.currentValue > 0) {
      this.createValueSnapshot(card.id, card.currentValue, 'manual', now);
    }

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

    // Auto-create value snapshot when currentValue changes
    if (cardInput.currentValue !== existing.currentValue && cardInput.currentValue > 0) {
      this.createValueSnapshot(id, cardInput.currentValue, 'manual');
    }

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

  public async deleteAuditLog(id: string): Promise<boolean> {
    const result = this.db.delete(auditLogs).where(eq(auditLogs.id, id)).run();
    return result.changes > 0;
  }

  public async deleteAuditLogs(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = this.db.delete(auditLogs).where(inArray(auditLogs.id, ids)).run();
    return result.changes;
  }

  public async purgeAuditLogs(before: string, filters?: { action?: string; entity?: string; userId?: string }): Promise<number> {
    const conditions = [lt(auditLogs.createdAt, before)];
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entity) conditions.push(eq(auditLogs.entity, filters.entity));
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));

    const result = this.db.delete(auditLogs).where(and(...conditions)).run();
    return result.changes;
  }

  public async exportAuditLogs(filters?: { action?: string; entity?: string; userId?: string; before?: string; after?: string }): Promise<AuditLogEntry[]> {
    const conditions = [];
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entity) conditions.push(eq(auditLogs.entity, filters.entity));
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.before) conditions.push(lt(auditLogs.createdAt, filters.before));
    if (filters?.after) {
      // gt is not imported, use sql for after filter
      conditions.push(sql`${auditLogs.createdAt} > ${filters.after}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = this.db.select().from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .all();

    return rows.map(row => ({
      ...row,
      details: (row.details ?? null) as Record<string, unknown> | null,
    }));
  }

  // ─── Grading Submissions ─────────────────────────────────────────────────────

  private mapGradingSubmissionRow(row: typeof gradingSubmissions.$inferSelect): GradingSubmission {
    return {
      ...row,
      gradingCompany: row.gradingCompany as GradingSubmission['gradingCompany'],
      status: row.status as GradingSubmission['status'],
      tier: row.tier as GradingSubmission['tier'],
      receivedAt: row.receivedAt ?? null,
      gradingAt: row.gradingAt ?? null,
      shippedAt: row.shippedAt ?? null,
      completedAt: row.completedAt ?? null,
      estimatedReturnDate: row.estimatedReturnDate ?? null,
      grade: row.grade ?? null,
      notes: row.notes || '',
    };
  }

  public async getAllGradingSubmissions(filters?: { userId?: string; status?: GradingStatus; cardId?: string }): Promise<GradingSubmission[]> {
    const conditions = [];
    if (filters?.userId) conditions.push(eq(gradingSubmissions.userId, filters.userId));
    if (filters?.status) conditions.push(eq(gradingSubmissions.status, filters.status));
    if (filters?.cardId) conditions.push(eq(gradingSubmissions.cardId, filters.cardId));

    const rows = this.db.select().from(gradingSubmissions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(gradingSubmissions.createdAt))
      .all();

    return rows.map(row => this.mapGradingSubmissionRow(row));
  }

  public async getGradingSubmissionById(id: string): Promise<GradingSubmission | undefined> {
    const row = this.db.select().from(gradingSubmissions).where(eq(gradingSubmissions.id, id)).get();
    if (!row) return undefined;
    return this.mapGradingSubmissionRow(row);
  }

  public async createGradingSubmission(userId: string, input: GradingSubmissionInput): Promise<GradingSubmission> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const submission: GradingSubmission = {
      id,
      userId,
      cardId: input.cardId,
      gradingCompany: input.gradingCompany,
      submissionNumber: input.submissionNumber,
      status: 'Submitted',
      tier: input.tier,
      cost: input.cost,
      declaredValue: input.declaredValue ?? 0,
      submittedAt: input.submittedAt,
      receivedAt: null,
      gradingAt: null,
      shippedAt: null,
      completedAt: null,
      estimatedReturnDate: input.estimatedReturnDate ?? null,
      grade: null,
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(gradingSubmissions).values({
      id: submission.id,
      userId: submission.userId,
      cardId: submission.cardId,
      gradingCompany: submission.gradingCompany,
      submissionNumber: submission.submissionNumber,
      status: submission.status,
      tier: submission.tier,
      cost: submission.cost,
      declaredValue: submission.declaredValue,
      submittedAt: submission.submittedAt,
      receivedAt: null,
      gradingAt: null,
      shippedAt: null,
      completedAt: null,
      estimatedReturnDate: submission.estimatedReturnDate,
      grade: null,
      notes: submission.notes,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    }).run();

    return submission;
  }

  public async updateGradingSubmission(id: string, updates: Partial<Omit<GradingSubmission, 'id' | 'userId' | 'createdAt'>>): Promise<GradingSubmission | undefined> {
    const existing = await this.getGradingSubmissionById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: GradingSubmission = { ...existing, ...updates, updatedAt };

    this.db.update(gradingSubmissions).set({
      cardId: updated.cardId,
      gradingCompany: updated.gradingCompany,
      submissionNumber: updated.submissionNumber,
      status: updated.status,
      tier: updated.tier,
      cost: updated.cost,
      declaredValue: updated.declaredValue,
      submittedAt: updated.submittedAt,
      receivedAt: updated.receivedAt,
      gradingAt: updated.gradingAt,
      shippedAt: updated.shippedAt,
      completedAt: updated.completedAt,
      estimatedReturnDate: updated.estimatedReturnDate,
      grade: updated.grade,
      notes: updated.notes,
      updatedAt,
    }).where(eq(gradingSubmissions.id, id)).run();

    return updated;
  }

  public async deleteGradingSubmission(id: string): Promise<boolean> {
    const result = this.db.delete(gradingSubmissions).where(eq(gradingSubmissions.id, id)).run();
    return result.changes > 0;
  }

  public async getGradingStats(userId: string): Promise<GradingStats> {
    const rows = this.db.select().from(gradingSubmissions)
      .where(eq(gradingSubmissions.userId, userId))
      .all();

    const total = rows.length;
    const complete = rows.filter(r => r.status === 'Complete').length;
    const pending = total - complete;
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);

    // Average turnaround for completed submissions
    const completedRows = rows.filter(r => r.status === 'Complete' && r.completedAt);
    let avgTurnaroundDays: number | null = null;
    if (completedRows.length > 0) {
      const totalDays = completedRows.reduce((sum, r) => {
        const submitted = new Date(r.submittedAt).getTime();
        const completed = new Date(r.completedAt!).getTime();
        return sum + (completed - submitted) / (1000 * 60 * 60 * 24);
      }, 0);
      avgTurnaroundDays = Math.round((totalDays / completedRows.length) * 10) / 10;
    }

    // Average grade for completed submissions with numeric grades
    const gradedRows = completedRows.filter(r => r.grade != null);
    let avgGrade: number | null = null;
    if (gradedRows.length > 0) {
      const totalGrade = gradedRows.reduce((sum, r) => sum + parseFloat(r.grade!), 0);
      avgGrade = Math.round((totalGrade / gradedRows.length) * 10) / 10;
    }

    return { totalSubmissions: total, pending, complete, totalCost, avgTurnaroundDays, avgGrade };
  }

  // ─── Comp Cache ─────────────────────────────────────────────────────────────

  public getCompCache(key: string): { result: Record<string, unknown>; expiresAt: string } | null {
    const row = this.db.select().from(compCache).where(eq(compCache.key, key)).get();
    if (!row) return null;
    return { result: row.result, expiresAt: row.expiresAt };
  }

  public setCompCache(key: string, source: string, result: Record<string, unknown>, createdAt: string, expiresAt: string): void {
    // Upsert: delete existing then insert
    this.db.delete(compCache).where(eq(compCache.key, key)).run();
    this.db.insert(compCache).values({
      key,
      source,
      result,
      createdAt,
      expiresAt,
    }).run();
  }

  public purgeCompCache(now: string): number {
    const result = this.db.delete(compCache).where(lte(compCache.expiresAt, now)).run();
    return result.changes;
  }

  // ─── Card Comp Reports ──────────────────────────────────────────────────────

  public async saveCompReport(cardId: string, report: CompReport): Promise<StoredCompReport> {
    const reportId = uuidv4();
    const now = new Date().toISOString();

    this.db.insert(cardCompReports).values({
      id: reportId,
      cardId,
      condition: report.condition || null,
      aggregateAverage: report.aggregateAverage,
      aggregateLow: report.aggregateLow,
      aggregateHigh: report.aggregateHigh,
      popMultiplier: report.popMultiplier ?? null,
      popAdjustedAverage: report.popAdjustedAverage ?? null,
      popData: report.popData ? JSON.stringify(report.popData) : null,
      generatedAt: report.generatedAt,
      createdAt: now,
    }).run();

    const sourceRows: CompResult[] = [];
    for (const source of report.sources) {
      const sourceId = uuidv4();
      this.db.insert(cardCompSources).values({
        id: sourceId,
        reportId,
        source: source.source,
        marketValue: source.marketValue,
        averagePrice: source.averagePrice,
        low: source.low,
        high: source.high,
        sales: source.sales as unknown as Record<string, unknown>[],
        error: source.error || null,
        createdAt: now,
      }).run();
      sourceRows.push(source);
    }

    // Update card's currentValue — prefer pop-adjusted average, fall back to raw aggregate
    const bestValue = report.popAdjustedAverage ?? report.aggregateAverage;
    if (bestValue !== null && bestValue !== undefined) {
      const updatedAt = new Date().toISOString();
      this.db.update(cards).set({
        currentValue: bestValue,
        updatedAt,
      }).where(eq(cards.id, cardId)).run();

      // Auto-create value snapshot from comp report
      this.createValueSnapshot(cardId, bestValue, 'comp', report.generatedAt);
    }

    return {
      id: reportId,
      cardId,
      condition: report.condition,
      sources: sourceRows,
      aggregateAverage: report.aggregateAverage,
      aggregateLow: report.aggregateLow,
      aggregateHigh: report.aggregateHigh,
      popData: report.popData,
      popMultiplier: report.popMultiplier,
      popAdjustedAverage: report.popAdjustedAverage,
      generatedAt: report.generatedAt,
      createdAt: now,
    };
  }

  public async getLatestCompReport(cardId: string): Promise<StoredCompReport | undefined> {
    const reportRow = this.db.select().from(cardCompReports)
      .where(eq(cardCompReports.cardId, cardId))
      .orderBy(desc(cardCompReports.generatedAt))
      .limit(1)
      .get();

    if (!reportRow) return undefined;

    const sourceRows = this.db.select().from(cardCompSources)
      .where(eq(cardCompSources.reportId, reportRow.id))
      .all();

    return this.mapCompReportRow(reportRow, sourceRows);
  }

  public async getCompHistory(cardId: string, limit: number = 20): Promise<StoredCompReport[]> {
    const reportRows = this.db.select().from(cardCompReports)
      .where(eq(cardCompReports.cardId, cardId))
      .orderBy(desc(cardCompReports.generatedAt))
      .limit(limit)
      .all();

    const results: StoredCompReport[] = [];
    for (const reportRow of reportRows) {
      const sourceRows = this.db.select().from(cardCompSources)
        .where(eq(cardCompSources.reportId, reportRow.id))
        .all();
      results.push(this.mapCompReportRow(reportRow, sourceRows));
    }

    return results;
  }

  public async getPopSummary(): Promise<{ cardId: string; rarityTier: string; images: string[] }[]> {
    // Get the latest comp report per card that has popData, joined with card images
    const rows = this.db
      .select({
        cardId: cardCompReports.cardId,
        popData: cardCompReports.popData,
        images: cards.images,
        generatedAt: cardCompReports.generatedAt,
      })
      .from(cardCompReports)
      .innerJoin(cards, eq(cards.id, cardCompReports.cardId))
      .where(sql`${cardCompReports.popData} IS NOT NULL`)
      .orderBy(desc(cardCompReports.generatedAt))
      .all();

    // Dedupe to latest report per card
    const seen = new Set<string>();
    const results: { cardId: string; rarityTier: string; images: string[] }[] = [];
    for (const row of rows) {
      if (seen.has(row.cardId)) continue;
      seen.add(row.cardId);
      try {
        const pop = JSON.parse(row.popData!) as PopulationData;
        if (pop.rarityTier) {
          const images = Array.isArray(row.images) ? row.images as string[] : JSON.parse(row.images as string || '[]');
          results.push({ cardId: row.cardId, rarityTier: pop.rarityTier, images });
        }
      } catch { /* skip malformed */ }
    }
    return results;
  }

  public async deleteCompReports(cardId: string): Promise<number> {
    const result = this.db.delete(cardCompReports)
      .where(eq(cardCompReports.cardId, cardId))
      .run();
    return result.changes;
  }

  private mapCompReportRow(
    row: typeof cardCompReports.$inferSelect,
    sourceRows: (typeof cardCompSources.$inferSelect)[]
  ): StoredCompReport {
    let popData: PopulationData | null = null;
    if (row.popData) {
      try { popData = JSON.parse(row.popData) as PopulationData; } catch { /* ignore */ }
    }
    return {
      id: row.id,
      cardId: row.cardId,
      condition: row.condition ?? undefined,
      sources: sourceRows.map(s => ({
        source: s.source as CompSource,
        marketValue: s.marketValue,
        averagePrice: s.averagePrice,
        low: s.low,
        high: s.high,
        sales: (s.sales ?? []) as unknown as CompSale[],
        error: s.error ?? undefined,
      })),
      aggregateAverage: row.aggregateAverage,
      aggregateLow: row.aggregateLow,
      aggregateHigh: row.aggregateHigh,
      popData,
      popMultiplier: row.popMultiplier ?? undefined,
      popAdjustedAverage: row.popAdjustedAverage ?? undefined,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
    };
  }

  // ─── Pop Report Snapshots ───────────────────────────────────────────────────

  public async savePopSnapshot(cardId: string, data: PopulationData): Promise<void> {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.insert(popReportSnapshots).values({
      id,
      cardId,
      gradingCompany: data.gradingCompany,
      grade: data.targetGrade,
      totalGraded: data.totalGraded,
      targetGradePop: data.targetGradePop,
      higherGradePop: data.higherGradePop,
      percentile: data.percentile,
      rarityTier: data.rarityTier,
      gradeBreakdown: data.gradeBreakdown as unknown as { grade: string; count: number }[],
      fetchedAt: data.fetchedAt,
      createdAt: now,
    }).run();
  }

  public async getLatestPopSnapshot(
    cardId: string,
    gradingCompany: string,
    grade: string
  ): Promise<PopulationData | null> {
    const row = this.db.select().from(popReportSnapshots)
      .where(and(
        eq(popReportSnapshots.cardId, cardId),
        eq(popReportSnapshots.gradingCompany, gradingCompany),
        eq(popReportSnapshots.grade, grade),
      ))
      .orderBy(desc(popReportSnapshots.fetchedAt))
      .limit(1)
      .get();

    if (!row) return null;

    return {
      gradingCompany: row.gradingCompany,
      totalGraded: row.totalGraded,
      gradeBreakdown: (row.gradeBreakdown ?? []) as { grade: string; count: number }[],
      targetGrade: row.grade,
      targetGradePop: row.targetGradePop,
      higherGradePop: row.higherGradePop,
      percentile: row.percentile,
      rarityTier: row.rarityTier as PopulationData['rarityTier'],
      fetchedAt: row.fetchedAt,
    };
  }

  public async getPopHistory(cardId: string, limit: number = 50): Promise<PopulationData[]> {
    const rows = this.db.select().from(popReportSnapshots)
      .where(eq(popReportSnapshots.cardId, cardId))
      .orderBy(desc(popReportSnapshots.fetchedAt))
      .limit(limit)
      .all();

    return rows.map(row => ({
      gradingCompany: row.gradingCompany,
      totalGraded: row.totalGraded,
      gradeBreakdown: (row.gradeBreakdown ?? []) as { grade: string; count: number }[],
      targetGrade: row.grade,
      targetGradePop: row.targetGradePop,
      higherGradePop: row.higherGradePop,
      percentile: row.percentile,
      rarityTier: row.rarityTier as PopulationData['rarityTier'],
      fetchedAt: row.fetchedAt,
    }));
  }

  // ─── Card Value Snapshots ─────────────────────────────────────────────────

  public createValueSnapshot(cardId: string, value: number, source: string, snapshotAt?: string): void {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.insert(cardValueSnapshots).values({
      id,
      cardId,
      value,
      source,
      snapshotAt: snapshotAt || now,
      createdAt: now,
    }).run();
  }

  public getHeatmapDataForPeriod(periodStartDate: string): {
    cardId: string;
    currentValue: number;
    purchasePrice: number;
    periodStartValue: number | null;
    player: string;
    team: string;
    year: number;
    brand: string;
    category: string;
    cardNumber: string;
    isGraded: boolean;
  }[] {
    // Use raw SQL for the correlated subquery to get the closest snapshot value
    // on or before the period start date for each unsold card
    const stmt = this.sqlite.prepare(`
      SELECT
        c.id AS cardId,
        c.currentValue,
        c.purchasePrice,
        c.player,
        c.team,
        c.year,
        c.brand,
        c.category,
        c.cardNumber,
        c.isGraded,
        (
          SELECT cvs.value
          FROM card_value_snapshots cvs
          WHERE cvs.cardId = c.id AND cvs.snapshotAt <= ?
          ORDER BY cvs.snapshotAt DESC
          LIMIT 1
        ) AS periodStartValue
      FROM cards c
      WHERE c.sellDate IS NULL AND c.currentValue > 0
    `);

    const rows = stmt.all(periodStartDate) as {
      cardId: string;
      currentValue: number;
      purchasePrice: number;
      periodStartValue: number | null;
      player: string;
      team: string;
      year: number;
      brand: string;
      category: string;
      cardNumber: string;
      isGraded: number | boolean;
    }[];

    return rows.map(row => ({
      ...row,
      isGraded: !!row.isGraded,
    }));
  }

  public backfillValueSnapshots(): number {
    // Get all comp reports ordered by generatedAt ascending
    const reports = this.db.select().from(cardCompReports)
      .orderBy(asc(cardCompReports.generatedAt))
      .all();

    let count = 0;
    const seen = new Set<string>(); // track cardId+snapshotAt to skip dupes

    for (const report of reports) {
      const value = report.popAdjustedAverage ?? report.aggregateAverage;
      if (value === null || value === undefined) continue;

      const key = `${report.cardId}:${report.generatedAt}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if a snapshot already exists for this cardId + snapshotAt
      const existing = this.db.select({ id: cardValueSnapshots.id })
        .from(cardValueSnapshots)
        .where(and(
          eq(cardValueSnapshots.cardId, report.cardId),
          eq(cardValueSnapshots.snapshotAt, report.generatedAt),
        ))
        .get();

      if (existing) continue;

      this.createValueSnapshot(report.cardId, value, 'comp', report.generatedAt);
      count++;
    }

    return count;
  }

  // ─── eBay OAuth Tokens ────────────────────────────────────────────────────────

  public async getEbayOAuthToken(userId: string, environment: EbayEnvironment): Promise<EbayOAuthTokenRow | undefined> {
    const row = this.db.select().from(ebayOAuthTokens)
      .where(and(
        eq(ebayOAuthTokens.userId, userId),
        eq(ebayOAuthTokens.environment, environment),
        eq(ebayOAuthTokens.isActive, true),
      ))
      .get();

    if (!row) return undefined;

    return {
      ...row,
      isActive: !!row.isActive,
      ebayUsername: row.ebayUsername ?? null,
    };
  }

  public async upsertEbayOAuthToken(input: EbayOAuthTokenInput): Promise<EbayOAuthTokenRow> {
    const now = new Date().toISOString();

    // Check for existing active token for this user+environment
    const existing = this.db.select().from(ebayOAuthTokens)
      .where(and(
        eq(ebayOAuthTokens.userId, input.userId),
        eq(ebayOAuthTokens.environment, input.environment),
        eq(ebayOAuthTokens.isActive, true),
      ))
      .get();

    if (existing) {
      this.db.update(ebayOAuthTokens).set({
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        ebayUsername: input.ebayUsername ?? existing.ebayUsername,
        scopes: input.scopes,
        updatedAt: now,
      }).where(eq(ebayOAuthTokens.id, existing.id)).run();

      return {
        ...existing,
        accessTokenEncrypted: input.accessTokenEncrypted,
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        ebayUsername: input.ebayUsername ?? existing.ebayUsername ?? null,
        scopes: input.scopes,
        isActive: true,
        updatedAt: now,
      };
    }

    const id = uuidv4();
    const row: EbayOAuthTokenRow = {
      id,
      userId: input.userId,
      environment: input.environment,
      accessTokenEncrypted: input.accessTokenEncrypted,
      refreshTokenEncrypted: input.refreshTokenEncrypted,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshTokenExpiresAt: input.refreshTokenExpiresAt,
      ebayUsername: input.ebayUsername ?? null,
      scopes: input.scopes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.db.insert(ebayOAuthTokens).values({
      id: row.id,
      userId: row.userId,
      environment: row.environment,
      accessTokenEncrypted: row.accessTokenEncrypted,
      refreshTokenEncrypted: row.refreshTokenEncrypted,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
      refreshTokenExpiresAt: row.refreshTokenExpiresAt,
      ebayUsername: row.ebayUsername,
      scopes: row.scopes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).run();

    return row;
  }

  public async deactivateEbayOAuthToken(userId: string, environment: EbayEnvironment): Promise<boolean> {
    const now = new Date().toISOString();
    const result = this.db.update(ebayOAuthTokens).set({
      isActive: false,
      updatedAt: now,
    }).where(and(
      eq(ebayOAuthTokens.userId, userId),
      eq(ebayOAuthTokens.environment, environment),
      eq(ebayOAuthTokens.isActive, true),
    )).run();

    return result.changes > 0;
  }

  public async updateEbayAccessToken(id: string, accessTokenEncrypted: string, accessTokenExpiresAt: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.update(ebayOAuthTokens).set({
      accessTokenEncrypted,
      accessTokenExpiresAt,
      updatedAt: now,
    }).where(eq(ebayOAuthTokens.id, id)).run();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  public close(): Promise<void> {
    this.sqlite.close();
    return Promise.resolve();
  }
}

export default Database;
