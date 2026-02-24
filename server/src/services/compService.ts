import fs from 'fs';
import path from 'path';
import FileService from './fileService';
import BrowserService from './browserService';
import CompCacheService from './compCacheService';
import SportsCardsProAdapter from './adapters/sportsCardsPro';
import EbayAdapter from './adapters/ebay';
import CardLadderAdapter from './adapters/cardLadder';
import MarketMoversAdapter from './adapters/marketMovers';
import { CompAdapter, CompRequest, CompReport, CompResult, StoredCompReport } from '../types';
import Database from '../database';

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
    ];
  }

  async generateComps(request: CompRequest): Promise<CompReport> {
    const results: CompResult[] = [];

    for (const adapter of this.adapters) {
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

    // Calculate aggregates from successful sources
    const successfulResults = results.filter(r => !r.error && r.averagePrice !== null);
    let aggregateAverage: number | null = null;
    let aggregateLow: number | null = null;
    let aggregateHigh: number | null = null;

    if (successfulResults.length > 0) {
      const averages = successfulResults.map(r => r.averagePrice!);
      aggregateAverage = averages.reduce((sum, v) => sum + v, 0) / averages.length;

      const lows = successfulResults.filter(r => r.low !== null).map(r => r.low!);
      if (lows.length > 0) {
        aggregateLow = Math.min(...lows);
      }

      const highs = successfulResults.filter(r => r.high !== null).map(r => r.high!);
      if (highs.length > 0) {
        aggregateHigh = Math.max(...highs);
      }
    }

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
