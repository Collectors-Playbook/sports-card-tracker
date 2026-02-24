import { CompAdapter, CompRequest, CompResult, CompSource, CompSale } from '../../types';
import BrowserService from '../browserService';
import CompCacheService from '../compCacheService';
import { SPORTSCARDSPRO_SELECTORS } from './selectors';

function buildSearchQuery(request: CompRequest): string {
  const parts: string[] = [String(request.year), request.brand];
  if (request.setName) parts.push(request.setName);
  parts.push(request.player, request.cardNumber);
  if (request.parallel) parts.push(request.parallel);
  return parts.join(' ');
}

function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    type: 'prices',
  });
  return `https://www.sportscardspro.com/search-products?${params.toString()}`;
}

/**
 * Pick the right price field from PriceCharting API response based on card condition.
 * Prices are in pennies; returns dollars or null.
 */
function pickPrice(product: Record<string, unknown>, request: CompRequest): number | null {
  if (request.isGraded && request.gradingCompany && request.grade) {
    const company = request.gradingCompany.toUpperCase();
    const grade = request.grade;

    // BGS 10
    if (company === 'BGS' && grade === '10') {
      const bgs10 = product['bgs-10-price'];
      if (typeof bgs10 === 'number' && bgs10 > 0) return bgs10 / 100;
    }

    // PSA 10
    if (company === 'PSA' && grade === '10') {
      const psa10 = product['condition-18-price'];
      if (typeof psa10 === 'number' && psa10 > 0) return psa10 / 100;
    }

    // PSA 9
    if (company === 'PSA' && grade === '9') {
      const psa9 = product['condition-17-price'];
      if (typeof psa9 === 'number' && psa9 > 0) return psa9 / 100;
    }

    // Generic graded fallback
    const graded = product['graded-price'];
    if (typeof graded === 'number' && graded > 0) return graded / 100;
  }

  // Raw / ungraded
  const loose = product['loose-price'];
  if (typeof loose === 'number' && loose > 0) return loose / 100;

  return null;
}

class SportsCardsProAdapter implements CompAdapter {
  public readonly source: CompSource = 'SportsCardsPro';
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

    // API-first: if token is set, use PriceCharting REST API
    const apiToken = process.env.PRICECHARTING_API_TOKEN;
    if (apiToken) {
      return this.fetchViaApi(request, apiToken);
    }

    // Fallback: Puppeteer scraping
    return this.fetchViaScraping(request);
  }

  private async fetchViaApi(request: CompRequest, token: string): Promise<CompResult> {
    const query = buildSearchQuery(request);

    try {
      // Step 1: Search for products
      const searchUrl = `https://www.pricecharting.com/api/products?q=${encodeURIComponent(query)}&t=${token}`;
      const searchRes = await fetch(searchUrl);

      if (!searchRes.ok) {
        return {
          source: this.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: `PriceCharting API search failed: HTTP ${searchRes.status}`,
        };
      }

      const searchData = await searchRes.json() as { products?: Array<{ id: string; ['product-name']?: string }> };
      const products = searchData.products;

      if (!products || products.length === 0) {
        return {
          source: this.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: `No PriceCharting results found for: ${query}`,
        };
      }

      // Use the first (best) match
      const productId = products[0].id;

      // Step 2: Get product detail with prices
      const detailUrl = `https://www.pricecharting.com/api/product?id=${productId}&t=${token}`;
      const detailRes = await fetch(detailUrl);

      if (!detailRes.ok) {
        return {
          source: this.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: `PriceCharting API detail failed: HTTP ${detailRes.status}`,
        };
      }

      const product = await detailRes.json() as Record<string, unknown>;
      const price = pickPrice(product, request);

      const result: CompResult = {
        source: this.source,
        marketValue: price,
        sales: [],
        averagePrice: price,
        low: null,
        high: null,
      };

      // Cache successful result
      if (this.cacheService) {
        this.cacheService.set(this.source, request, result);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        source: this.source,
        marketValue: null,
        sales: [],
        averagePrice: null,
        low: null,
        high: null,
        error: `PriceCharting API error: ${message}`,
      };
    }
  }

  private async fetchViaScraping(request: CompRequest): Promise<CompResult> {
    // If no browser, return stub
    if (!this.browserService || !this.browserService.isRunning()) {
      return {
        source: this.source,
        marketValue: null,
        sales: [],
        averagePrice: null,
        low: null,
        high: null,
        error: 'SportsCardsPro scraping not available (Puppeteer disabled)',
      };
    }

    const query = buildSearchQuery(request);
    const searchUrl = buildSearchUrl(query);

    let page;
    try {
      // Step 1: Search for the card
      page = await this.browserService.navigateWithThrottle(this.source, searchUrl);

      // Find the first matching result link
      const detailUrl = await page.$eval(
        SPORTSCARDSPRO_SELECTORS.resultLink,
        (el) => (el as unknown as { href: string }).href
      ).catch(() => null);

      await page.close();
      page = undefined;

      if (!detailUrl) {
        return {
          source: this.source,
          marketValue: null,
          sales: [],
          averagePrice: null,
          low: null,
          high: null,
          error: `No SportsCardsPro results found for: ${query}`,
        };
      }

      // Step 2: Navigate to detail page
      page = await this.browserService.navigateWithThrottle(this.source, detailUrl);

      // Extract market value
      const marketValue = await page.$eval(
        SPORTSCARDSPRO_SELECTORS.priceValue,
        (el) => {
          const text = el.textContent?.replace(/[^0-9.]/g, '') || '';
          return parseFloat(text) || null;
        }
      ).catch(() => null);

      // Extract recent sales
      const sales: CompSale[] = await page.$$eval(
        SPORTSCARDSPRO_SELECTORS.recentSaleRow,
        (rows, selectors) => {
          const results: { price: number; date: string }[] = [];
          for (const row of rows) {
            const dateCell = row.querySelector(selectors.saleDate);
            const priceCell = row.querySelector(selectors.salePrice);
            if (!priceCell) continue;

            const priceText = priceCell.textContent?.replace(/[^0-9.]/g, '') || '';
            const price = parseFloat(priceText);
            if (isNaN(price) || price <= 0) continue;

            results.push({
              price,
              date: dateCell?.textContent?.trim() || '',
            });

            if (results.length >= 15) break;
          }
          return results;
        },
        {
          salePrice: SPORTSCARDSPRO_SELECTORS.salePrice as string,
          saleDate: SPORTSCARDSPRO_SELECTORS.saleDate as string,
        }
      ).then(rows => rows.map(r => ({
        date: r.date,
        price: r.price,
        venue: 'SportsCardsPro',
      })));

      await page.close();

      const prices = sales.map(s => s.price);
      let averagePrice: number | null = null;
      let low: number | null = null;
      let high: number | null = null;

      if (prices.length > 0) {
        averagePrice = Math.round((prices.reduce((sum, p) => sum + p, 0) / prices.length) * 100) / 100;
        low = Math.round(Math.min(...prices) * 100) / 100;
        high = Math.round(Math.max(...prices) * 100) / 100;
      } else if (marketValue !== null) {
        averagePrice = marketValue;
      }

      const result: CompResult = {
        source: this.source,
        marketValue: marketValue !== null ? Math.round(marketValue * 100) / 100 : null,
        sales,
        averagePrice,
        low,
        high,
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
        error: `SportsCardsPro scraping failed: ${message}`,
      };
    }
  }
}

export default SportsCardsProAdapter;
export { buildSearchQuery, pickPrice };
