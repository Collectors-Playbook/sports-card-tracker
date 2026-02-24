import { CompAdapter, CompRequest, CompResult, CompSource, CompSale } from '../../types';
import BrowserService from '../browserService';
import CompCacheService from '../compCacheService';
import { EBAY_SELECTORS } from './selectors';
import { extractGradeFromTitle, filterByGrade } from './gradeUtils';

function buildSearchQuery(request: CompRequest): string {
  const parts: string[] = [String(request.year), request.brand];
  if (request.setName) parts.push(request.setName);
  parts.push(request.player, `#${request.cardNumber}`);
  if (request.parallel) parts.push(request.parallel);
  if (request.isGraded && request.gradingCompany && request.grade) {
    parts.push(request.gradingCompany, request.grade);
  }
  if (request.isAutograph) parts.push('auto');
  if (request.isRelic) parts.push('relic');
  return parts.join(' ');
}

function filterByRelevance(
  rawSales: { price: number; date: string; title: string }[],
  request: CompRequest
): { price: number; date: string; title: string }[] {
  const lastName = request.player.split(' ').pop()?.toLowerCase() || '';
  let filtered = rawSales;
  if (lastName) {
    const relevant = rawSales.filter(s => s.title.toLowerCase().includes(lastName));
    filtered = relevant.length >= 3 ? relevant : rawSales;
  }
  filtered = filterByGrade(filtered, request);
  return filtered;
}

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

function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query,
    LH_Complete: '1',
    LH_Sold: '1',
    _sop: '13', // Sort by end date: most recent first
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

class EbayAdapter implements CompAdapter {
  public readonly source: CompSource = 'eBay';
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
      return {
        source: this.source,
        marketValue: null,
        sales: [],
        averagePrice: null,
        low: null,
        high: null,
        error: 'eBay scraping not available (Puppeteer disabled)',
      };
    }

    const query = buildSearchQuery(request);
    const url = buildSearchUrl(query);

    let page;
    try {
      page = await this.browserService.navigateWithThrottle(this.source, url);

      const rawSales = await page.$$eval(
        EBAY_SELECTORS.itemContainer,
        (items, selectors) => {
          const results: { price: number; date: string; title: string }[] = [];

          for (const item of items) {
            // Skip the first "Shop on eBay" item that eBay injects
            const titleEl = item.querySelector(selectors.itemTitle);
            if (!titleEl || titleEl.textContent?.trim() === 'Shop on eBay') continue;

            const priceEl = item.querySelector(selectors.itemPrice);
            const dateEl = item.querySelector(selectors.itemDate);

            if (!priceEl) continue;

            const priceText = priceEl.textContent?.replace(/[^0-9.]/g, '') || '';
            const price = parseFloat(priceText);
            if (isNaN(price) || price <= 0) continue;

            const dateText = dateEl?.textContent?.replace(/^Sold\s+/i, '').trim() || '';

            results.push({
              price,
              date: dateText,
              title: titleEl.textContent?.trim() || '',
            });

            if (results.length >= 20) break;
          }

          return results;
        },
        {
          itemTitle: EBAY_SELECTORS.itemTitle,
          itemPrice: EBAY_SELECTORS.itemPrice,
          itemDate: EBAY_SELECTORS.itemDate,
        }
      );

      await page.close();

      if (rawSales.length === 0) {
        return {
          source: this.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: `No eBay sold listings found for: ${query}`,
        };
      }

      // Filter by title relevance (must contain player's last name)
      const filteredSales = filterByRelevance(rawSales, request);

      const compSales: CompSale[] = filteredSales.map(s => {
        const gradeInfo = extractGradeFromTitle(s.title);
        return {
          date: s.date,
          price: s.price,
          venue: 'eBay',
          ...(gradeInfo ? { grade: `${gradeInfo.company} ${gradeInfo.grade}` } : {}),
        };
      });

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
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        source: this.source,
        marketValue: null,
        sales: [],
        averagePrice: null,
        low: null,
        high: null,
        error: `eBay scraping failed: ${message}`,
      };
    }
  }
}

export default EbayAdapter;
export { buildSearchQuery, filterByRelevance, computeTrimmedMean };
