import { CompRequest, PopulationData, PopRarityTier, PopScraper } from '../types';
import BrowserService from './browserService';
import Database from '../database';

// ─── Constants ───────────────────────────────────────────────────────────────

export const POP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const POP_MULTIPLIERS: Record<PopRarityTier, number> = {
  'ultra-low': 1.25,
  'low': 1.10,
  'medium': 1.00,
  'high': 1.00,
  'very-high': 0.95,
};

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

export function getMultiplier(popData: PopulationData): number {
  return POP_MULTIPLIERS[popData.rarityTier];
}

// ─── Service ────────────────────────────────────────────────────────────────

class PopulationReportService {
  private scrapers: PopScraper[];
  private db?: Database;

  constructor(scrapers: PopScraper[], db?: Database) {
    this.scrapers = scrapers;
    this.db = db;
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

    // Find scraper for this grading company
    const scraper = this.scrapers.find(
      s => s.company.toLowerCase() === request.gradingCompany!.toLowerCase()
    );
    if (!scraper) return null;

    // Fetch from scraper
    const popData = await scraper.fetchPopulation({
      player: request.player,
      year: request.year,
      brand: request.brand,
      cardNumber: request.cardNumber,
      setName: request.setName,
      parallel: request.parallel,
      grade: request.grade,
      category: request.condition, // pass category if available
    });

    if (!popData) return null;

    // Store snapshot
    if (this.db) {
      await this.db.savePopSnapshot(request.cardId, popData);
    }

    return popData;
  }
}

export default PopulationReportService;
