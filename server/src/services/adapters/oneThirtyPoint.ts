import { CompAdapter, CompRequest, CompResult, CompSource, CompSale } from '../../types';
import CompCacheService from '../compCacheService';
import { extractGradeFromTitle, filterByGrade } from './gradeUtils';

// ─── Rate Limiting ──────────────────────────────────────────────────────────

let lastRequestTime = 0;
let blockedUntil = 0;

function _resetRateLimitState(): void {
  lastRequestTime = 0;
  blockedUntil = 0;
}

// ─── Query Builder ──────────────────────────────────────────────────────────

function buildSearchQuery(request: CompRequest): string {
  const parts: string[] = [String(request.year), request.brand];
  if (request.setName) parts.push(request.setName);
  parts.push(request.player, `#${request.cardNumber}`);
  if (request.parallel) parts.push(request.parallel);
  if (request.isGraded && request.gradingCompany && request.grade) {
    parts.push(request.gradingCompany, request.grade);
  }
  return parts.join(' ');
}

// ─── HTML Parsing ───────────────────────────────────────────────────────────

interface ParsedSale {
  price: number;
  date: string;
  title: string;
  marketplace: string;
}

function parseHtmlResponse(html: string): ParsedSale[] {
  const results: ParsedSale[] = [];

  // Match table rows
  const rowRegex = /<tr[\s>][^]*?<\/tr>/gi;
  const rows = html.match(rowRegex);
  if (!rows) return results;

  for (const row of rows) {
    // Skip header rows
    if (/<th[\s>]/i.test(row)) continue;

    // Extract price from data-price attribute first, then fallback to $XX.XX text
    let price: number | null = null;
    const dataPriceMatch = row.match(/data-price=["']?([\d.]+)["']?/i);
    if (dataPriceMatch) {
      price = parseFloat(dataPriceMatch[1]);
    } else {
      const priceTextMatch = row.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
      if (priceTextMatch) {
        price = parseFloat(priceTextMatch[1].replace(/,/g, ''));
      }
    }

    if (price === null || isNaN(price) || price <= 0) continue;

    // Extract cell contents
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Strip HTML tags to get text content
      cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
    }

    if (cells.length === 0) continue;

    // Extract title — typically the first or second cell with meaningful text
    const title = cells.find(c => c.length > 5 && !/^\$/.test(c) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c)) || cells[0] || '';

    // Extract date — look for date pattern in cells
    let date = '';
    for (const cell of cells) {
      const dateMatch = cell.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) {
        date = dateMatch[1];
        break;
      }
    }

    // Detect marketplace from row content
    const rowLower = row.toLowerCase();
    let marketplace = '130Point';
    if (rowLower.includes('goldin')) marketplace = 'Goldin';
    else if (rowLower.includes('pwcc')) marketplace = 'PWCC';
    else if (rowLower.includes('heritage')) marketplace = 'Heritage';
    else if (rowLower.includes('myslabs')) marketplace = 'MySlabs';
    else if (rowLower.includes('pristine')) marketplace = 'Pristine';
    else if (rowLower.includes('ebay')) marketplace = 'eBay';

    results.push({ price, date, title, marketplace });
  }

  return results;
}

// ─── Relevance Filter ───────────────────────────────────────────────────────

function filterByRelevance(
  rawSales: ParsedSale[],
  request: CompRequest
): ParsedSale[] {
  const lastName = request.player.split(' ').pop()?.toLowerCase() || '';
  let filtered = rawSales;
  if (lastName) {
    const relevant = rawSales.filter(s => s.title.toLowerCase().includes(lastName));
    filtered = relevant.length >= 3 ? relevant : rawSales;
  }
  filtered = filterByGrade(filtered, request);
  return filtered;
}

// ─── Trimmed Mean ───────────────────────────────────────────────────────────

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

// ─── Adapter ────────────────────────────────────────────────────────────────

class OneThirtyPointAdapter implements CompAdapter {
  public readonly source: CompSource = '130Point';
  private cacheService?: CompCacheService;
  private rateLimitMs: number;

  constructor(
    _browserService?: unknown,
    cacheService?: CompCacheService,
    rateLimitMs?: number
  ) {
    this.cacheService = cacheService;
    this.rateLimitMs = rateLimitMs ?? 6000;
  }

  async fetchComps(request: CompRequest): Promise<CompResult> {
    // Check cache first
    if (this.cacheService) {
      const cached = this.cacheService.get(this.source, request);
      if (cached) return cached;
    }

    // Check if we're blocked from a previous 429
    if (Date.now() < blockedUntil) {
      const remainingMinutes = Math.ceil((blockedUntil - Date.now()) / 60000);
      return this.errorResult(
        `130Point rate limited — blocked for ${remainingMinutes} more minute(s)`
      );
    }

    // Throttle requests
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitMs - elapsed));
    }

    const query = buildSearchQuery(request);

    try {
      lastRequestTime = Date.now();

      const params = new URLSearchParams({
        query,
        sort: 'date_desc',
        tab_id: '1',
        tz: 'America/New_York',
        width: '1200',
        height: '800',
      });

      const res = await fetch('https://back.130point.com/cards/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (res.status === 429) {
        blockedUntil = Date.now() + 3600000; // 1-hour block
        return this.errorResult('130Point rate limit exceeded — blocked for 1 hour');
      }

      if (!res.ok) {
        return this.errorResult(`130Point HTTP ${res.status}`);
      }

      const html = await res.text();

      // Check for error text in response
      if (html.toLowerCase().includes('error') && html.length < 200) {
        return this.errorResult(`130Point returned error: ${html.substring(0, 100)}`);
      }

      const rawSales = parseHtmlResponse(html);

      if (rawSales.length === 0) {
        return this.errorResult(`No 130Point sold listings found for: ${query}`);
      }

      const filteredSales = filterByRelevance(rawSales, request);

      const compSales: CompSale[] = filteredSales.map(s => {
        const gradeInfo = extractGradeFromTitle(s.title);
        return {
          date: s.date,
          price: s.price,
          venue: s.marketplace,
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
      const message = err instanceof Error ? err.message : String(err);
      return this.errorResult(`130Point fetch failed: ${message}`);
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

export default OneThirtyPointAdapter;
export { buildSearchQuery, parseHtmlResponse, filterByRelevance, computeTrimmedMean, _resetRateLimitState };
