import fs from 'fs';
import path from 'path';
import FileService from './fileService';
import BrowserService from './browserService';
import CompCacheService from './compCacheService';
import SportsCardsProAdapter from './adapters/sportsCardsPro';
import EbayAdapter from './adapters/ebay';
import CardLadderAdapter from './adapters/cardLadder';
import MarketMoversAdapter from './adapters/marketMovers';
import OneThirtyPointAdapter from './adapters/oneThirtyPoint';
import PsaAdapter from './adapters/psa';
import { CompAdapter, CompRequest, CompReport, CompResult, CompSource, StoredCompReport } from '../types';
import Database from '../database';

// ─── Aggregation Constants ──────────────────────────────────────────────────

const RECENCY_HALF_LIFE_DAYS = 30;
const DEDUP_PRICE_TOLERANCE = 0.50;       // dollars
const DEDUP_DATE_TOLERANCE_MS = 2 * 86400000; // 2 days
const TRIM_PERCENTAGE = 0.10;
const UNKNOWN_DATE_WEIGHT = 0.10;
const MIN_SALES_FOR_TRIM = 5;
const SOURCE_RELIABILITY: Record<CompSource, number> = {
  'eBay': 1.0,
  'PSA': 0.95,
  '130Point': 0.9,
  'MarketMovers': 0.85,
  'CardLadder': 0.8,
  'SportsCardsPro': 0.6,
};

// ─── Aggregation Types ──────────────────────────────────────────────────────

export interface NormalizedSale {
  price: number;
  dateMs: number | null;
  venue: string;
  sourceAdapter: CompSource;
}

// ─── Aggregation Helpers ────────────────────────────────────────────────────

/**
 * Parse various date formats into epoch ms.
 * Returns null for empty/unparseable strings.
 */
export function normalizeDate(dateStr: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // ISO: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(trimmed + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Slash: MM/DD/YYYY or MM/DD/YY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Natural: "Feb 23, 2026" etc.
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Exponential decay weight based on sale age.
 * Half-life of 30 days: today=1.0, 30d=0.5, 60d=0.25, 90d=0.125
 * Unknown dates get a fixed penalty weight.
 */
export function recencyWeight(saleDateMs: number | null, nowMs: number): number {
  if (saleDateMs === null) return UNKNOWN_DATE_WEIGHT;
  const ageDays = Math.max(0, (nowMs - saleDateMs) / 86400000);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Remove duplicate sales that appear across multiple sources.
 * Two sales are duplicates if: price within $0.50, dates within 2 days, and
 * venues overlap (case-insensitive or both contain "ebay").
 * Input should be pre-sorted by source priority. First-seen wins.
 * Null-date sales are never deduped.
 */
export function deduplicateSales(sales: NormalizedSale[]): NormalizedSale[] {
  const kept: NormalizedSale[] = [];

  for (const sale of sales) {
    if (sale.dateMs === null) {
      kept.push(sale);
      continue;
    }

    const isDup = kept.some(existing => {
      if (existing.dateMs === null) return false;
      if (Math.abs(existing.price - sale.price) > DEDUP_PRICE_TOLERANCE) return false;
      if (Math.abs(existing.dateMs - sale.dateMs!) > DEDUP_DATE_TOLERANCE_MS) return false;
      // Venue overlap check
      const venueA = existing.venue.toLowerCase();
      const venueB = sale.venue.toLowerCase();
      if (venueA === venueB) return true;
      if (venueA.includes('ebay') && venueB.includes('ebay')) return true;
      return false;
    });

    if (!isDup) {
      kept.push(sale);
    }
  }

  return kept;
}

/**
 * Compute a recency-weighted, trimmed mean from pooled sales.
 * Trims 10% of total weight from each tail when 5+ sales.
 * Returns null if no sales provided.
 */
export function computeWeightedTrimmedMean(
  sales: NormalizedSale[],
  nowMs: number
): { average: number; low: number; high: number } | null {
  if (sales.length === 0) return null;

  // Assign weights
  const weighted = sales.map(s => ({
    price: s.price,
    weight: recencyWeight(s.dateMs, nowMs),
  }));

  // Sort by price ascending
  weighted.sort((a, b) => a.price - b.price);

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) return null;

  let trimmedItems = weighted;

  // Trim tails if enough sales
  if (sales.length >= MIN_SALES_FOR_TRIM) {
    const trimWeight = totalWeight * TRIM_PERCENTAGE;

    // Trim low tail
    let lowTrimRemaining = trimWeight;
    let lowIdx = 0;
    while (lowIdx < weighted.length && lowTrimRemaining > 0) {
      if (weighted[lowIdx].weight <= lowTrimRemaining) {
        lowTrimRemaining -= weighted[lowIdx].weight;
        lowIdx++;
      } else {
        // Partial trim: reduce weight of this item
        weighted[lowIdx] = {
          ...weighted[lowIdx],
          weight: weighted[lowIdx].weight - lowTrimRemaining,
        };
        lowTrimRemaining = 0;
      }
    }

    // Trim high tail
    let highTrimRemaining = trimWeight;
    let highIdx = weighted.length - 1;
    while (highIdx >= lowIdx && highTrimRemaining > 0) {
      if (weighted[highIdx].weight <= highTrimRemaining) {
        highTrimRemaining -= weighted[highIdx].weight;
        highIdx--;
      } else {
        weighted[highIdx] = {
          ...weighted[highIdx],
          weight: weighted[highIdx].weight - highTrimRemaining,
        };
        highTrimRemaining = 0;
      }
    }

    trimmedItems = weighted.slice(lowIdx, highIdx + 1);
  }

  if (trimmedItems.length === 0) return null;

  const trimmedTotal = trimmedItems.reduce((sum, w) => sum + w.weight, 0);
  if (trimmedTotal === 0) return null;

  const average = trimmedItems.reduce((sum, w) => sum + w.price * w.weight, 0) / trimmedTotal;
  const low = trimmedItems[0].price;
  const high = trimmedItems[trimmedItems.length - 1].price;

  return { average, low, high };
}

/**
 * Fallback when no individual sales exist: weight market values by source reliability.
 */
export function computeFallbackFromMarketValues(
  results: CompResult[]
): { average: number; low: number; high: number } | null {
  const entries: { value: number; weight: number }[] = [];

  for (const r of results) {
    if (r.error) continue;
    const value = r.marketValue ?? r.averagePrice;
    if (value === null || value === undefined) continue;
    const weight = SOURCE_RELIABILITY[r.source] ?? 0.5;
    entries.push({ value, weight });
  }

  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  const average = entries.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight;
  const low = Math.min(...entries.map(e => e.value));
  const high = Math.max(...entries.map(e => e.value));

  return { average, low, high };
}

class CompService {
  private fileService: FileService;
  private adapters: CompAdapter[];
  private db?: Database;

  constructor(
    fileService: FileService,
    adapters?: CompAdapter[],
    browserService?: BrowserService,
    cacheService?: CompCacheService,
    db?: Database
  ) {
    this.fileService = fileService;
    this.db = db;
    this.adapters = adapters || [
      new SportsCardsProAdapter(browserService, cacheService),
      new EbayAdapter(browserService, cacheService),
      new CardLadderAdapter(browserService, cacheService),
      new MarketMoversAdapter(browserService, cacheService),
      new OneThirtyPointAdapter(browserService, cacheService),
      new PsaAdapter(browserService, cacheService),
    ];
  }

  async generateComps(request: CompRequest): Promise<CompReport> {
    const results: CompResult[] = [];

    for (const adapter of this.adapters) {
      if (adapter.source === 'PSA' && request.isGraded && request.gradingCompany && request.gradingCompany !== 'PSA') {
        continue;
      }
      try {
        const result = await adapter.fetchComps(request);
        results.push(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({
          source: adapter.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: errorMessage,
        });
      }
    }

    // Compute weighted aggregate from pooled sales (or fallback to market values)
    const { aggregateAverage, aggregateLow, aggregateHigh } = this.computeWeightedAggregate(results);

    return {
      cardId: request.cardId,
      player: request.player,
      year: request.year,
      brand: request.brand,
      cardNumber: request.cardNumber,
      condition: request.condition,
      sources: results,
      aggregateAverage,
      aggregateLow,
      aggregateHigh,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateAndWriteComps(request: CompRequest): Promise<CompReport> {
    const report = await this.generateComps(request);

    // Log errors to comp-error.log
    const failedSources = report.sources.filter(s => s.error);
    for (const source of failedSources) {
      const filename = `${request.year}-${request.brand}-${request.player}-${request.cardNumber}`;
      this.fileService.appendLog('comp-error.log', {
        timestamp: new Date().toISOString(),
        filename,
        reason: `${source.source} - ${source.error}`,
      });
    }

    // Persist to DB (primary storage)
    if (this.db) {
      await this.db.saveCompReport(request.cardId, report);
    }

    // Write comp file to processed/ (secondary artifact)
    const compFilename = `${request.year}-${request.brand}-${request.player.replace(/\s+/g, '-')}-${request.cardNumber}-comps.txt`;
    const compContent = this.formatCompReport(report);
    const processedDir = this.fileService.getProcessedDir();
    fs.writeFileSync(path.join(processedDir, compFilename), compContent);

    return report;
  }

  async getStoredComps(cardId: string): Promise<StoredCompReport | undefined> {
    if (!this.db) return undefined;
    return this.db.getLatestCompReport(cardId);
  }

  async getCompHistory(cardId: string, limit?: number): Promise<StoredCompReport[]> {
    if (!this.db) return [];
    return this.db.getCompHistory(cardId, limit);
  }

  private computeWeightedAggregate(results: CompResult[]): {
    aggregateAverage: number | null;
    aggregateLow: number | null;
    aggregateHigh: number | null;
  } {
    const successfulResults = results.filter(r => !r.error);

    // Pool all individual sales from all sources and normalize dates
    const allSales: NormalizedSale[] = [];
    for (const r of successfulResults) {
      for (const sale of r.sales) {
        allSales.push({
          price: sale.price,
          dateMs: normalizeDate(sale.date),
          venue: sale.venue,
          sourceAdapter: r.source,
        });
      }
    }

    if (allSales.length > 0) {
      // Sort by source sales count descending for dedup priority
      const salesCountBySource = new Map<CompSource, number>();
      for (const r of successfulResults) {
        salesCountBySource.set(r.source, r.sales.length);
      }
      allSales.sort((a, b) => {
        const countA = salesCountBySource.get(a.sourceAdapter) || 0;
        const countB = salesCountBySource.get(b.sourceAdapter) || 0;
        return countB - countA;
      });

      // Deduplicate cross-source
      const deduped = deduplicateSales(allSales);

      // Compute weighted trimmed mean
      const nowMs = Date.now();
      const result = computeWeightedTrimmedMean(deduped, nowMs);
      if (result) {
        return {
          aggregateAverage: result.average,
          aggregateLow: result.low,
          aggregateHigh: result.high,
        };
      }
    }

    // Fallback: use market values weighted by source reliability
    const fallback = computeFallbackFromMarketValues(results);
    if (fallback) {
      return {
        aggregateAverage: fallback.average,
        aggregateLow: fallback.low,
        aggregateHigh: fallback.high,
      };
    }

    return {
      aggregateAverage: null,
      aggregateLow: null,
      aggregateHigh: null,
    };
  }

  private formatCompReport(report: CompReport): string {
    const lines: string[] = [];
    lines.push(`Card: ${report.player} ${report.year} ${report.brand} #${report.cardNumber}`);
    if (report.condition) {
      lines.push(`Condition: ${report.condition}`);
    }
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push('');

    for (const source of report.sources) {
      lines.push(`--- ${source.source} ---`);
      if (source.error) {
        lines.push(`Error: ${source.error}`);
      } else {
        if (source.marketValue !== null) lines.push(`Market Value: $${source.marketValue.toFixed(2)}`);
        if (source.averagePrice !== null) lines.push(`Average Price: $${source.averagePrice.toFixed(2)}`);
        if (source.low !== null && source.high !== null) lines.push(`Range: $${source.low.toFixed(2)} - $${source.high.toFixed(2)}`);
        if (source.sales.length > 0) {
          lines.push('Recent Sales:');
          for (const sale of source.sales) {
            lines.push(`  ${sale.date} - $${sale.price.toFixed(2)} (${sale.venue}${sale.grade ? `, ${sale.grade}` : ''})`);
          }
        }
      }
      lines.push('');
    }

    if (report.aggregateAverage !== null) {
      lines.push('--- Aggregate ---');
      lines.push(`Average: $${report.aggregateAverage.toFixed(2)}`);
      if (report.aggregateLow !== null) lines.push(`Low: $${report.aggregateLow.toFixed(2)}`);
      if (report.aggregateHigh !== null) lines.push(`High: $${report.aggregateHigh.toFixed(2)}`);
    }

    return lines.join('\n') + '\n';
  }
}

export default CompService;
