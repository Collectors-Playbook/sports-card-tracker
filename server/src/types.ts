import { Request } from 'express';

// ─── Card ────────────────────────────────────────────────────────────────────

export interface Card {
  id: string;
  userId: string;
  collectionId?: string;
  collectionType: 'PC' | 'Inventory';
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
  collectionType?: 'PC' | 'Inventory';
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

// ─── Comps ───────────────────────────────────────────────────────────────────

export type CompSource = 'SportsCardsPro' | 'eBay' | 'CardLadder' | 'MarketMovers';

export interface CompSale {
  date: string;
  price: number;
  grade?: string;
  venue: string;
}

export interface CompResult {
  source: CompSource;
  marketValue: number | null;
  sales: CompSale[];
  averagePrice: number | null;
  low: number | null;
  high: number | null;
  error?: string;
}

export interface CompReport {
  cardId: string;
  player: string;
  year: number;
  brand: string;
  cardNumber: string;
  condition?: string;
  sources: CompResult[];
  aggregateAverage: number | null;
  aggregateLow: number | null;
  aggregateHigh: number | null;
  generatedAt: string;
}

export interface CompRequest {
  cardId: string;
  player: string;
  year: number;
  brand: string;
  cardNumber: string;
  condition?: string;
}

export interface CompAdapter {
  source: CompSource;
  fetchComps(request: CompRequest): Promise<CompResult>;
}

// ─── Image Processing ───────────────────────────────────────────────────────

export interface ImageProcessingPayload {
  filenames: string[];
  skipExisting?: boolean;
  confidenceThreshold?: number;
}

export interface ImageProcessingResult {
  totalFiles: number;
  processed: number;
  skipped: number;
  duplicates: number;
  failed: number;
  results: ImageProcessingItemResult[];
}

export interface ImageProcessingItemResult {
  filename: string;
  status: 'processed' | 'skipped' | 'duplicate' | 'failed';
  processedFilename?: string;
  cardId?: string;
  confidence?: number;
  error?: string;
}

export interface ExtractedCardData {
  player?: string;
  year?: string;
  brand?: string;
  setName?: string;
  cardNumber?: string;
  team?: string;
  category?: string;
  parallel?: string;
  serialNumber?: string;
  features?: CardFeatures;
  confidence?: DetectionConfidence;
  rawText?: string;
}

export interface CardFeatures {
  isRookie: boolean;
  isAutograph: boolean;
  isRelic: boolean;
  isNumbered: boolean;
  isGraded: boolean;
  isParallel: boolean;
}

export interface DetectionConfidence {
  score: number;
  level: 'high' | 'medium' | 'low';
  detectedFields: number;
  missingFields?: string[];
}
