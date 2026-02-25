import { CompRequest, PopulationData, PopRarityTier, PopScraper } from '../types';
import BrowserService from './browserService';
import Database from '../database';

// ─── Constants ───────────────────────────────────────────────────────────────

export const POP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Pure Functions ──────────────────────────────────────────────────────────

export function classifyRarityTier(targetGradePop: number): PopRarityTier {
  if (targetGradePop <= 5) return 'ultra-low';
  if (targetGradePop <= 25) return 'low';
  if (targetGradePop <= 100) return 'medium';
  if (targetGradePop <= 500) return 'high';
  return 'very-high';
}

export function computePercentile(
  targetGradePop: number,
  higherGradePop: number,
  totalGraded: number
): number {
  if (totalGraded === 0) return 0;
  return Math.round(((targetGradePop + higherGradePop) / totalGraded) * 10000) / 100;
}

/**
 * Continuous log₁₀ decay curve mapping population count to a price multiplier.
 * ~1.25 at pop 1, ~1.15 at pop 10, ~1.05 at pop 100, ~0.95 at pop 1000+.
 * Clamped at a 0.95 floor so very-high-pop cards still retain most of their value.
 */
export function popMultiplier(targetGradePop: number): number {
  if (targetGradePop <= 0) return 1.25;
  const raw = 1.25 - 0.30 * Math.log10(targetGradePop) / Math.log10(1000);
  return Math.max(0.95, Math.round(raw * 1000) / 1000);
}

// ─── Service ────────────────────────────────────────────────────────────────

class PopulationReportService {
  private scrapers: PopScraper[];
  private db?: Database;
  private fallbackScraper?: PopScraper;

  constructor(scrapers: PopScraper[], db?: Database, fallbackScraper?: PopScraper) {
    this.scrapers = scrapers;
    this.db = db;
    this.fallbackScraper = fallbackScraper;
  }

  async getPopulationData(request: CompRequest): Promise<PopulationData | null> {
    // Only fetch pop data for graded cards
    if (!request.isGraded || !request.gradingCompany || !request.grade) {
      return null;
    }

    // Check cache (DB snapshot within TTL)
    if (this.db) {
      const cached = await this.db.getLatestPopSnapshot(
        request.cardId,
        request.gradingCompany,
        request.grade
      );
      if (cached) {
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < POP_CACHE_TTL_MS) {
          return cached;
        }
      }
    }

    const popRequest = {
      player: request.player,
      year: request.year,
      brand: request.brand,
      cardNumber: request.cardNumber,
      setName: request.setName,
      parallel: request.parallel,
      grade: request.grade,
      category: request.category,
      gradingCompany: request.gradingCompany,
    };

    // Find scraper for this grading company
    const scraper = this.scrapers.find(
      s => s.company.toLowerCase() === request.gradingCompany!.toLowerCase()
    );

    // Try primary scraper
    let popData: PopulationData | null = null;
    if (scraper) {
      console.log(`[PopService] Fetching pop for ${request.player} ${request.year} ${request.brand} #${request.cardNumber} grade=${request.grade} via ${scraper.company}`);
      popData = await scraper.fetchPopulation(popRequest);
    } else {
      console.log(`[PopService] No primary scraper for company: ${request.gradingCompany}`);
    }

    // Try fallback scraper if primary returned null
    if (!popData && this.fallbackScraper) {
      console.log(`[PopService] Primary scraper returned null, trying fallback (${this.fallbackScraper.company}) for ${request.player}`);
      popData = await this.fallbackScraper.fetchPopulation(popRequest);
    }

    if (!popData) {
      console.log(`[PopService] No pop data found for ${request.player}`);
      return null;
    }
    console.log(`[PopService] Got pop data: targetGradePop=${popData.targetGradePop} totalGraded=${popData.totalGraded} tier=${popData.rarityTier}`);

    // Store snapshot
    if (this.db) {
      await this.db.savePopSnapshot(request.cardId, popData);
    }

    return popData;
  }
}

export default PopulationReportService;
