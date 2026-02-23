import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  role: text('role').notNull().default('user').$type<'admin' | 'user'>(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  profilePhoto: text('profilePhoto'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// ─── Collections ────────────────────────────────────────────────────────────

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  icon: text('icon').default(''),
  color: text('color').default('#4F46E5'),
  isDefault: integer('isDefault', { mode: 'boolean' }).default(false),
  visibility: text('visibility').default('private').$type<'private' | 'public' | 'shared'>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// ─── Cards ──────────────────────────────────────────────────────────────────

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().default(''),
  collectionId: text('collectionId'),
  collectionType: text('collectionType').notNull().default('Inventory').$type<'PC' | 'Inventory' | 'Pending'>(),
  player: text('player').notNull(),
  team: text('team').notNull(),
  year: integer('year').notNull(),
  brand: text('brand').notNull(),
  category: text('category').notNull(),
  cardNumber: text('cardNumber').notNull(),
  parallel: text('parallel'),
  condition: text('condition').notNull(),
  gradingCompany: text('gradingCompany'),
  setName: text('setName'),
  serialNumber: text('serialNumber'),
  grade: text('grade'),
  isRookie: integer('isRookie', { mode: 'boolean' }).default(false),
  isAutograph: integer('isAutograph', { mode: 'boolean' }).default(false),
  isRelic: integer('isRelic', { mode: 'boolean' }).default(false),
  isNumbered: integer('isNumbered', { mode: 'boolean' }).default(false),
  isGraded: integer('isGraded', { mode: 'boolean' }).default(false),
  purchasePrice: real('purchasePrice').notNull(),
  purchaseDate: text('purchaseDate').notNull(),
  sellPrice: real('sellPrice'),
  sellDate: text('sellDate'),
  currentValue: real('currentValue').notNull(),
  images: text('images', { mode: 'json' }).$type<string[]>().notNull().default([]),
  notes: text('notes').notNull().default(''),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// ─── Jobs ───────────────────────────────────────────────────────────────────

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'running' | 'completed' | 'failed' | 'cancelled'>(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  error: text('error'),
  progress: real('progress').notNull().default(0),
  totalItems: integer('totalItems').notNull().default(0),
  completedItems: integer('completedItems').notNull().default(0),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

// ─── Grading Submissions ────────────────────────────────────────────────────

export const gradingSubmissions = sqliteTable('grading_submissions', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  cardId: text('cardId').notNull().references(() => cards.id),
  gradingCompany: text('gradingCompany').notNull(),
  submissionNumber: text('submissionNumber').notNull(),
  status: text('status').notNull().default('Submitted'),
  tier: text('tier').notNull().default('Regular'),
  cost: real('cost').notNull().default(0),
  declaredValue: real('declaredValue').notNull().default(0),
  submittedAt: text('submittedAt').notNull(),
  receivedAt: text('receivedAt'),
  gradingAt: text('gradingAt'),
  shippedAt: text('shippedAt'),
  completedAt: text('completedAt'),
  estimatedReturnDate: text('estimatedReturnDate'),
  grade: text('grade'),
  notes: text('notes').notNull().default(''),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
}, (table) => [
  index('idx_grading_userId').on(table.userId),
  index('idx_grading_cardId').on(table.cardId),
  index('idx_grading_status').on(table.status),
]);

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('userId'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entityId'),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  ipAddress: text('ipAddress'),
  createdAt: text('createdAt').notNull(),
}, (table) => [
  index('idx_audit_logs_entity').on(table.entity, table.entityId),
  index('idx_audit_logs_userId').on(table.userId),
  index('idx_audit_logs_createdAt').on(table.createdAt),
]);
