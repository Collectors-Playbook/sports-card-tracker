import { Request } from 'express';

// ─── Card ────────────────────────────────────────────────────────────────────

export interface Card {
  id: string;
  userId: string;
  collectionId?: string;
  collectionType: 'PC' | 'Inventory' | 'Pending';
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  setName?: string;
  serialNumber?: string;
  grade?: string;
  isRookie?: boolean;
  isAutograph?: boolean;
  isRelic?: boolean;
  isNumbered?: boolean;
  isGraded?: boolean;
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
  collectionType?: 'PC' | 'Inventory' | 'Pending';
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  setName?: string;
  serialNumber?: string;
  grade?: string;
  isRookie?: boolean;
  isAutograph?: boolean;
  isRelic?: boolean;
  isNumbered?: boolean;
  isGraded?: boolean;
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
  profilePhoto: string | null;
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
  icon: string;
  color: string;
  isDefault: boolean;
  visibility: 'private' | 'public' | 'shared';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionInput {
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean;
  visibility?: 'private' | 'public' | 'shared';
  tags?: string[];
}

export interface CollectionStats {
  cardCount: number;
  totalValue: number;
  totalCost: number;
  categoryBreakdown: { [category: string]: number };
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

// ─── eBay Export ────────────────────────────────────────────────────────────

export interface EbayExportOptions {
  priceMultiplier: number;
  shippingCost: number;
  duration: string;
  location: string;
  dispatchTime: number;
  cardIds?: string[];
}

export interface EbayExportResult {
  filename: string;
  totalCards: number;
  skippedPcCards: number;
  totalListingValue: number;
  generatedAt: string;
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
  gradingCompany?: string;
  grade?: string;
  features?: CardFeatures;
  confidence?: DetectionConfidence;
  rawText?: string;
  _apiMeta?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    imageCount: number;
  };
  _parseFailed?: boolean;
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

// ─── Audit Log ──────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface AuditLogQuery {
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'action' | 'entity' | 'entityId';
  sortDirection?: 'asc' | 'desc';
}
