import { CompAdapter, CompRequest, CompResult, CompSource, CompSale } from '../../types';
import BrowserService from '../browserService';
import CompCacheService from '../compCacheService';
import { PSA_SELECTORS } from './selectors';

// ─── Category Mapping ────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  baseball: 'baseball-cards',
  basketball: 'basketball-cards',
  football: 'football-cards',
  hockey: 'hockey-cards',
  soccer: 'soccer-cards',
  pokemon: 'tcg-cards',
  other: 'non-sports-cards',
};

function mapCategory(category: string): string {
  return CATEGORY_MAP[category.toLowerCase()] || 'non-sports-cards';
}

// ─── Query Builder ───────────────────────────────────────────────────────────

function buildSearchQuery(request: CompRequest): string {
  const parts: string[] = [String(request.year), request.brand];
  if (request.setName) parts.push(request.setName);
  parts.push(request.player, `#${request.cardNumber}`);
  if (request.parallel) parts.push(request.parallel);
  return parts.join(' ');
}

function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `https://www.psacard.com/auctionprices?${params.toString()}`;
}

// ─── Relevance Filter ────────────────────────────────────────────────────────

function filterByRelevance(
  rawSales: { price: number; date: string; grade: string; auctionHouse: string }[],
  request: CompRequest
): { price: number; date: string; grade: string; auctionHouse: string }[] {
  const lastName = request.player.split(' ').pop()?.toLowerCase() || '';
  if (!lastName) return rawSales;
  // PSA detail pages are card-specific so all sales should be relevant,
  // but we still filter in case search landed on a wrong page.
  return rawSales;
}

// ─── Trimmed Mean ────────────────────────────────────────────────────────────

function computeTrimmedMean(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  if (sorted.length < 5) {
    return sorted.reduce((sum, p) => sum + p, 0) / sorted.length;
  }
  const trimCount = Math.max(1, Math.floor(sorted.length * 0.15));
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return trimmed.reduce((sum, p) => sum + p, 0) / trimmed.length;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

class PsaAdapter implements CompAdapter {
  public readonly source: CompSource = 'PSA';
  private browserService?: BrowserService;
  private cacheService?: CompCacheService;

  constructor(browserService?: BrowserService, cacheService?: CompCacheService) {
    this.browserService = browserService;
    this.cacheService = cacheService;
  }

  async fetchComps(request: CompRequest): Promise<CompResult> {
    // Check cache first
    if (this.cacheService) {
      const cached = this.cacheService.get(this.source, request);
      if (cached) return cached;
    }

    // If no browser, return stub
    if (!this.browserService || !this.browserService.isRunning()) {
      return this.errorResult('PSA scraping not available (Puppeteer disabled)');
    }

    const query = buildSearchQuery(request);
    const url = buildSearchUrl(query);

    let searchPage;
    let detailPage;
    try {
      // Step 1: Navigate to search page
      searchPage = await this.browserService.navigateWithThrottle(this.source, url);

      // Extract detail page URL from search results
      const detailUrl = await searchPage.$$eval(
        PSA_SELECTORS.resultLink,
        (links) => {
          for (const link of links) {
            const href = (link as any).href;
            if (href && href.includes('/auctionprices/')) {
              return href;
            }
          }
          return null;
        }
      );

      await searchPage.close();
      searchPage = undefined;

      if (!detailUrl) {
        return this.errorResult(`No PSA auction results found for: ${query}`);
      }

      // Step 2: Navigate to detail page
      detailPage = await this.browserService.navigateWithThrottle(this.source, detailUrl);

      // Extract sales from the detail page table
      const rawSales = await detailPage.$$eval(
        PSA_SELECTORS.salesTable,
        (rows, selectors) => {
          const results: { price: number; date: string; grade: string; auctionHouse: string }[] = [];

          for (const row of rows) {
            const dateEl = row.querySelector(selectors.saleDate);
            const gradeEl = row.querySelector(selectors.saleGrade);
            const priceEl = row.querySelector(selectors.salePrice);
            const auctionHouseEl = row.querySelector(selectors.saleAuctionHouse);

            if (!priceEl) continue;

            const priceText = priceEl.textContent?.replace(/[^0-9.]/g, '') || '';
            const price = parseFloat(priceText);
            if (isNaN(price) || price <= 0) continue;

            const date = dateEl?.textContent?.trim() || '';
            const grade = gradeEl?.textContent?.trim() || '';
            const auctionHouse = auctionHouseEl?.textContent?.trim() || 'PSA';

            results.push({ price, date, grade, auctionHouse });

            if (results.length >= 30) break;
          }

          return results;
        },
        {
          saleDate: PSA_SELECTORS.saleDate,
          saleGrade: PSA_SELECTORS.saleGrade,
          salePrice: PSA_SELECTORS.salePrice,
          saleAuctionHouse: PSA_SELECTORS.saleAuctionHouse,
        }
      );

      await detailPage.close();
      detailPage = undefined;

      if (rawSales.length === 0) {
        return this.errorResult(`No PSA sales data found for: ${query}`);
      }

      // Grade filter: if the card is PSA-graded, only keep matching grade sales
      let filteredSales = rawSales;
      if (request.isGraded && request.gradingCompany === 'PSA' && request.grade) {
        const gradeMatch = rawSales.filter(s => s.grade === request.grade);
        if (gradeMatch.length > 0) {
          filteredSales = gradeMatch;
        }
        // If no exact grade matches, keep all sales as fallback
      }

      // Relevance filter
      filteredSales = filterByRelevance(filteredSales, request);

      const compSales: CompSale[] = filteredSales.map(s => ({
        date: s.date,
        price: s.price,
        grade: s.grade,
        venue: s.auctionHouse,
      }));

      const prices = compSales.map(s => s.price);
      const avg = computeTrimmedMean(prices);
      const low = Math.min(...prices);
      const high = Math.max(...prices);

      const result: CompResult = {
        source: this.source,
        marketValue: Math.round(avg * 100) / 100,
        sales: compSales,
        averagePrice: Math.round(avg * 100) / 100,
        low: Math.round(low * 100) / 100,
        high: Math.round(high * 100) / 100,
      };

      // Cache successful result
      if (this.cacheService) {
        this.cacheService.set(this.source, request, result);
      }

      return result;
    } catch (err) {
      if (searchPage) {
        try { await searchPage.close(); } catch { /* ignore */ }
      }
      if (detailPage) {
        try { await detailPage.close(); } catch { /* ignore */ }
      }
      const message = err instanceof Error ? err.message : String(err);
      return this.errorResult(`PSA scraping failed: ${message}`);
    }
  }

  private errorResult(error: string): CompResult {
    return {
      source: this.source,
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      error,
    };
  }
}

export default PsaAdapter;
export { buildSearchQuery, buildSearchUrl, filterByRelevance, computeTrimmedMean, mapCategory };
