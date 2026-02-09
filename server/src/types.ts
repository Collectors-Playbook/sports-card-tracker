import { Request } from 'express';

// ─── Card ────────────────────────────────────────────────────────────────────

export interface Card {
  id: string;
  userId: string;
  collectionId?: string;
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  purchasePrice: number;
  purchaseDate: string;
  sellPrice?: number;
  sellDate?: string;
  currentValue: number;
  images: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardInput {
  userId?: string;
  collectionId?: string;
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  purchasePrice: number;
  purchaseDate: string;
  sellPrice?: number;
  sellDate?: string;
  currentValue: number;
  images: string[];
  notes: string;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserInput {
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

// ─── Collection ──────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionInput {
  userId: string;
  name: string;
  description?: string;
}

// ─── Job ─────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'image-processing' | 'comp-generation' | 'ebay-csv' | string;

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  totalItems: number;
  completedItems: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobInput {
  type: JobType;
  payload?: Record<string, unknown>;
}

// ─── File ────────────────────────────────────────────────────────────────────

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
  type: string;
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  filename: string;
  reason: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthPayload {
  userId: string;
  role: 'admin' | 'user';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}
