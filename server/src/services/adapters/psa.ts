import { CompAdapter, CompRequest, CompResult, CompSource, CompSale } from '../../types';
import BrowserService from '../browserService';
import CompCacheService from '../compCacheService';

// ─── Constants ───────────────────────────────────────────────────────────────

const PSA_SEARCH_URL = 'https://www.psacard.com/auctionprices';

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
  return `${PSA_SEARCH_URL}/search?${params.toString()}`;
}

// ─── Sale Parsing ────────────────────────────────────────────────────────────

interface ParsedSale {
  price: number;
  date: string;
  grade: string;
  auctionHouse: string;
}

/**
 * Parse sale rows extracted from PSA detail page table.
 * Sale rows have 7 cells: [image, date, auctionHouse, saleType, certNo, grade, price]
 * Grade summary rows have 5 cells and are skipped.
 */
function parseSaleRows(rows: string[][]): ParsedSale[] {
  const results: ParsedSale[] = [];
  for (const cells of rows) {
    // Sale rows have 7 cells; skip grade summary rows (5 cells)
    if (cells.length < 7) continue;

    const date = cells[1] || '';
    const auctionHouse = cells[2] || 'PSA';
    const grade = cells[5] || '';
    const priceText = (cells[6] || '').replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);
    if (isNaN(price) || price <= 0) continue;

    results.push({ price, date, grade, auctionHouse });
  }
  return results;
}

// ─── Spec ID Extraction ──────────────────────────────────────────────────────

function extractSpecId(url: string): string | null {
  const valuesMatch = url.match(/\/values\/(\d+)/);
  if (valuesMatch) return valuesMatch[1];
  const segmentMatch = url.match(/\/(\d+)(?:[?#].*)?$/);
  return segmentMatch ? segmentMatch[1] : null;
}

// ─── Relevance Filter ────────────────────────────────────────────────────────

function filterByRelevance(
  rawSales: ParsedSale[],
  _request: CompRequest
): ParsedSale[] {
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
    if (this.cacheService) {
      const cached = this.cacheService.get(this.source, request);
      if (cached) return cached;
    }

    if (!this.browserService || !this.browserService.isRunning()) {
      return this.errorResult('PSA scraping not available (Puppeteer disabled)');
    }

    const query = buildSearchQuery(request);
    const url = buildSearchUrl(query);

    let searchPage;
    let detailPage;
    try {
      // Step 1: Navigate to search results page
      searchPage = await this.browserService.navigateWithThrottle(this.source, url);

      const detailUrl = await searchPage.evaluate(`
        (() => {
          const links = document.querySelectorAll('a[href*="/auctionprices/"]');
          for (const link of links) {
            const href = link.href;
            if (href.includes('/search')) continue;
            const match = href.match(/\\/auctionprices\\/[^/]+\\/[^/]+\\/[^/]+\\/(\\d+)/);
            if (match) return href;
          }
          return null;
        })()
      `) as string | null;

      await searchPage.close();
      searchPage = undefined;

      if (!detailUrl) {
        return this.errorResult(`No PSA auction results found for: ${query}`);
      }

      // Step 2: Navigate to the card detail page
      detailPage = await this.browserService.navigateWithThrottle(this.source, detailUrl);

      // Extract table rows as arrays of cell text
      // Sale rows: [image, date, auctionHouse, saleType, certNo, grade, price]
      const tableRows = await detailPage.evaluate(`
        (() => {
          const trs = document.querySelectorAll('table tbody tr');
          return Array.from(trs).map(tr => {
            return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
          });
        })()
      `) as string[][];

      await detailPage.close();
      detailPage = undefined;

      const rawSales = parseSaleRows(tableRows);

      if (rawSales.length === 0) {
        return this.errorResult(`No PSA sales data found for: ${query}`);
      }

      // Grade filter: if PSA-graded, only keep matching grade
      let filteredSales = rawSales;
      if (request.isGraded && request.gradingCompany === 'PSA' && request.grade) {
        const gradeMatch = rawSales.filter(s => s.grade === request.grade);
        if (gradeMatch.length > 0) {
          filteredSales = gradeMatch;
        }
      }

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
export { buildSearchQuery, buildSearchUrl, filterByRelevance, computeTrimmedMean, mapCategory, extractSpecId, parseSaleRows };
