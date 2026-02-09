import sqlite3 from 'sqlite3';
import { Card, CardInput, User, UserInput, Collection, CollectionInput, Job, JobInput, JobStatus } from './types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

class Database {
  private db: sqlite3.Database;
  private ready: Promise<void>;

  constructor(dbPath: string = ':memory:') {
    this.db = new sqlite3.Database(dbPath);
    this.ready = this.initTables();
  }

  // ─── Promise Helpers ─────────────────────────────────────────────────────────

  private runAsync(sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  private getAsync<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T | undefined);
      });
    });
  }

  private allAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve((rows || []) as T[]);
      });
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  private async initTables(): Promise<void> {
    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL DEFAULT '',
        collectionId TEXT,
        player TEXT NOT NULL,
        team TEXT NOT NULL,
        year INTEGER NOT NULL,
        brand TEXT NOT NULL,
        category TEXT NOT NULL,
        cardNumber TEXT NOT NULL,
        parallel TEXT,
        condition TEXT NOT NULL,
        gradingCompany TEXT,
        purchasePrice REAL NOT NULL,
        purchaseDate TEXT NOT NULL,
        sellPrice REAL,
        sellDate TEXT,
        currentValue REAL NOT NULL,
        images TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    await this.runAsync(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload TEXT NOT NULL DEFAULT '{}',
        result TEXT,
        error TEXT,
        progress REAL NOT NULL DEFAULT 0,
        totalItems INTEGER NOT NULL DEFAULT 0,
        completedItems INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  }

  public async waitReady(): Promise<void> {
    await this.ready;
  }

  // ─── Cards ───────────────────────────────────────────────────────────────────

  public async getAllCards(filters?: { userId?: string; collectionId?: string }): Promise<Card[]> {
    await this.ready;
    let sql = 'SELECT * FROM cards';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters?.userId) {
      conditions.push('userId = ?');
      params.push(filters.userId);
    }
    if (filters?.collectionId) {
      conditions.push('collectionId = ?');
      params.push(filters.collectionId);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY createdAt DESC';

    const rows = await this.allAsync<Record<string, unknown>>(sql, params);
    return rows.map(row => ({
      ...row,
      images: JSON.parse((row.images as string) || '[]'),
    })) as Card[];
  }

  public async getCardById(id: string): Promise<Card | undefined> {
    await this.ready;
    const row = await this.getAsync<Record<string, unknown>>(
      'SELECT * FROM cards WHERE id = ?',
      [id]
    );
    if (!row) return undefined;
    return { ...row, images: JSON.parse((row.images as string) || '[]') } as Card;
  }

  public async createCard(cardInput: CardInput): Promise<Card> {
    await this.ready;
    const id = uuidv4();
    const now = new Date().toISOString();

    const card: Card = {
      id,
      userId: cardInput.userId || '',
      collectionId: cardInput.collectionId,
      player: cardInput.player,
      team: cardInput.team,
      year: cardInput.year,
      brand: cardInput.brand,
      category: cardInput.category,
      cardNumber: cardInput.cardNumber,
      parallel: cardInput.parallel,
      condition: cardInput.condition,
      gradingCompany: cardInput.gradingCompany,
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

    await this.runAsync(
      `INSERT INTO cards (
        id, userId, collectionId, player, team, year, brand, category, cardNumber,
        parallel, condition, gradingCompany, purchasePrice, purchaseDate,
        sellPrice, sellDate, currentValue, images, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id, card.userId, card.collectionId || null, card.player, card.team,
        card.year, card.brand, card.category, card.cardNumber, card.parallel || null,
        card.condition, card.gradingCompany || null, card.purchasePrice, card.purchaseDate,
        card.sellPrice || null, card.sellDate || null, card.currentValue,
        JSON.stringify(card.images), card.notes, card.createdAt, card.updatedAt,
      ]
    );

    return card;
  }

  public async updateCard(id: string, cardInput: CardInput): Promise<Card | undefined> {
    await this.ready;
    const existing = await this.getCardById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();

    await this.runAsync(
      `UPDATE cards SET
        userId = ?, collectionId = ?, player = ?, team = ?, year = ?, brand = ?,
        category = ?, cardNumber = ?, parallel = ?, condition = ?, gradingCompany = ?,
        purchasePrice = ?, purchaseDate = ?, sellPrice = ?, sellDate = ?,
        currentValue = ?, images = ?, notes = ?, updatedAt = ?
      WHERE id = ?`,
      [
        cardInput.userId || existing.userId, cardInput.collectionId || null,
        cardInput.player, cardInput.team, cardInput.year, cardInput.brand,
        cardInput.category, cardInput.cardNumber, cardInput.parallel || null,
        cardInput.condition, cardInput.gradingCompany || null, cardInput.purchasePrice,
        cardInput.purchaseDate, cardInput.sellPrice || null, cardInput.sellDate || null,
        cardInput.currentValue, JSON.stringify(cardInput.images || []),
        cardInput.notes || '', updatedAt, id,
      ]
    );

    return {
      ...existing,
      ...cardInput,
      id,
      userId: cardInput.userId || existing.userId,
      images: cardInput.images || [],
      notes: cardInput.notes || '',
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  public async deleteCard(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.runAsync('DELETE FROM cards WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  // ─── Users ───────────────────────────────────────────────────────────────────

  public async getAllUsers(): Promise<User[]> {
    await this.ready;
    return this.allAsync<User>('SELECT * FROM users ORDER BY createdAt DESC');
  }

  public async getUserById(id: string): Promise<User | undefined> {
    await this.ready;
    return this.getAsync<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    await this.ready;
    return this.getAsync<User>('SELECT * FROM users WHERE email = ?', [email]);
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    await this.ready;
    return this.getAsync<User>('SELECT * FROM users WHERE username = ?', [username]);
  }

  public async createUser(input: UserInput): Promise<User> {
    await this.ready;
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
      createdAt: now,
      updatedAt: now,
    };

    await this.runAsync(
      `INSERT INTO users (id, username, email, passwordHash, role, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.username, user.email, user.passwordHash, user.role, 1, user.createdAt, user.updatedAt]
    );

    return user;
  }

  public async updateUser(id: string, updates: Partial<Pick<User, 'username' | 'email' | 'role' | 'isActive'>>): Promise<User | undefined> {
    await this.ready;
    const existing = await this.getUserById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: User = { ...existing, ...updates, updatedAt };

    await this.runAsync(
      `UPDATE users SET username = ?, email = ?, role = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [updated.username, updated.email, updated.role, updated.isActive ? 1 : 0, updatedAt, id]
    );

    return updated;
  }

  public async deleteUser(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.runAsync('DELETE FROM users WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  // ─── Collections ─────────────────────────────────────────────────────────────

  public async getAllCollections(userId?: string): Promise<Collection[]> {
    await this.ready;
    if (userId) {
      return this.allAsync<Collection>(
        'SELECT * FROM collections WHERE userId = ? ORDER BY createdAt DESC',
        [userId]
      );
    }
    return this.allAsync<Collection>('SELECT * FROM collections ORDER BY createdAt DESC');
  }

  public async getCollectionById(id: string): Promise<Collection | undefined> {
    await this.ready;
    return this.getAsync<Collection>('SELECT * FROM collections WHERE id = ?', [id]);
  }

  public async createCollection(input: CollectionInput): Promise<Collection> {
    await this.ready;
    const id = uuidv4();
    const now = new Date().toISOString();

    const collection: Collection = {
      id,
      userId: input.userId,
      name: input.name,
      description: input.description || '',
      createdAt: now,
      updatedAt: now,
    };

    await this.runAsync(
      `INSERT INTO collections (id, userId, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [collection.id, collection.userId, collection.name, collection.description, collection.createdAt, collection.updatedAt]
    );

    return collection;
  }

  public async deleteCollection(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.runAsync('DELETE FROM collections WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  // ─── Jobs ────────────────────────────────────────────────────────────────────

  public async getAllJobs(filters?: { status?: JobStatus; type?: string; limit?: number }): Promise<Job[]> {
    await this.ready;
    let sql = 'SELECT * FROM jobs';
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (filters?.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY createdAt DESC';
    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = await this.allAsync<Record<string, unknown>>(sql, params);
    return rows.map(row => ({
      ...row,
      payload: JSON.parse((row.payload as string) || '{}'),
      result: row.result ? JSON.parse(row.result as string) : null,
    })) as Job[];
  }

  public async getJobById(id: string): Promise<Job | undefined> {
    await this.ready;
    const row = await this.getAsync<Record<string, unknown>>(
      'SELECT * FROM jobs WHERE id = ?',
      [id]
    );
    if (!row) return undefined;
    return {
      ...row,
      payload: JSON.parse((row.payload as string) || '{}'),
      result: row.result ? JSON.parse(row.result as string) : null,
    } as Job;
  }

  public async createJob(input: JobInput): Promise<Job> {
    await this.ready;
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

    await this.runAsync(
      `INSERT INTO jobs (id, type, status, payload, result, error, progress, totalItems, completedItems, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [job.id, job.type, job.status, JSON.stringify(job.payload), null, null, 0, 0, 0, job.createdAt, job.updatedAt]
    );

    return job;
  }

  public async updateJob(id: string, updates: Partial<Pick<Job, 'status' | 'result' | 'error' | 'progress' | 'totalItems' | 'completedItems'>>): Promise<Job | undefined> {
    await this.ready;
    const existing = await this.getJobById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const updated: Job = { ...existing, ...updates, updatedAt };

    await this.runAsync(
      `UPDATE jobs SET status = ?, result = ?, error = ?, progress = ?, totalItems = ?, completedItems = ?, updatedAt = ? WHERE id = ?`,
      [
        updated.status, updated.result ? JSON.stringify(updated.result) : null,
        updated.error, updated.progress, updated.totalItems, updated.completedItems,
        updatedAt, id,
      ]
    );

    return updated;
  }

  public async getNextPendingJob(): Promise<Job | undefined> {
    await this.ready;
    const row = await this.getAsync<Record<string, unknown>>(
      `SELECT * FROM jobs WHERE status = 'pending' ORDER BY createdAt ASC LIMIT 1`
    );
    if (!row) return undefined;
    return {
      ...row,
      payload: JSON.parse((row.payload as string) || '{}'),
      result: row.result ? JSON.parse(row.result as string) : null,
    } as Job;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export default Database;
