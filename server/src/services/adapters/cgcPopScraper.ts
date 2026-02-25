import { PopScraper, PopRequest, PopulationData, PopGradeEntry } from '../../types';
import { classifyRarityTier, computePercentile } from '../populationReportService';
import BrowserService from '../browserService';

// ─── Constants ──────────────────────────────────────────────────────────────

const CGC_POP_URL = 'https://www.cgccards.com/population-report/';
const CGC_API_HOST = 'production.api.aws.ccg-ops.com';

// CGC grade ordering (higher index = higher grade).
// CGC uses qualifier labels (Pristine, Gem Mint, etc.) but the numeric grade
// is what matters for pop counting — qualifiers are display-only.
const CGC_GRADE_ORDER = [
  '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5',
  '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5',
  '9', '9.5', '10',
];

// Map card sport categories to CGC URL path segments
const CATEGORY_PATH_MAP: Record<string, string> = {
  'baseball': 'sports',
  'basketball': 'sports',
  'football': 'sports',
  'hockey': 'sports',
  'soccer': 'sports',
  'golf': 'sports',
  'pokemon': 'tcg',
};

// ─── Pure Functions (exported for testing) ──────────────────────────────────

/**
 * Build progressively simpler search queries for CGC's autocomplete.
 * Same progressive-narrowing strategy as PSA.
 */
function buildSearchQueries(request: PopRequest): string[] {
  const queries: string[] = [];
  const playerLastName = request.player.split(' ').pop() || request.player;
  const cleanCardNum = request.cardNumber.replace(/[-]/g, '');

  // Most specific: year + brand + setName + player last name + card number
  if (request.setName) {
    queries.push(`${request.year} ${request.brand} ${request.setName} ${playerLastName} ${cleanCardNum}`);
  }

  // year + brand + setName + player last name
  if (request.setName) {
    queries.push(`${request.year} ${request.brand} ${request.setName} ${playerLastName}`);
  }

  // year + brand + player last name + card number
  queries.push(`${request.year} ${request.brand} ${playerLastName} ${cleanCardNum}`);

  // year + brand + player last name (broadest)
  queries.push(`${request.year} ${request.brand} ${playerLastName}`);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return queries.filter(q => {
    if (seen.has(q)) return false;
    seen.add(q);
    return true;
  });
}

/**
 * Score how well a CGC search result description matches the requested card.
 * Higher score = better match. Returns -1 if the player last name is missing.
 */
function scoreMatch(description: string, request: PopRequest): number {
  const desc = description.toLowerCase();
  let score = 0;

  // Player name match (required — return -1 if no match)
  const playerParts = request.player.toLowerCase().split(' ');
  const lastName = playerParts[playerParts.length - 1];
  if (!desc.includes(lastName)) return -1;
  if (playerParts.every(p => desc.includes(p))) score += 10;
  else score += 5;

  // Year match
  if (desc.includes(String(request.year))) score += 5;

  // Card number match (normalize dashes)
  const cleanNum = request.cardNumber.replace(/[-]/g, '').toLowerCase();
  if (desc.includes(cleanNum)) score += 8;

  // Parallel match
  if (request.parallel) {
    const parallel = request.parallel.toLowerCase();
    if (desc.includes(parallel)) score += 6;
  } else {
    // Prefer base cards when no parallel specified
    if (!desc.includes('refractor') && !desc.includes('prizm') && !desc.includes('1/1') && !desc.includes('holo')) {
      score += 3;
    }
  }

  // Set name match
  if (request.setName && desc.includes(request.setName.toLowerCase())) score += 4;

  return score;
}

/**
 * Parse CGC's API JSON response into PopGradeEntry[].
 * Handles multiple possible response formats since the exact API shape is undocumented:
 *  1. Grade-keyed object: { "10": 50, "9.5": 120, ... }
 *  2. Array of objects: [{ grade: "10", count: 50 }, ...]
 *  3. Nested structure with a `grades` or `counts` sub-object
 */
function parsePopResponse(data: any): PopGradeEntry[] {
  if (!data) return [];

  // Log raw response for debugging on first encounters
  console.log('[CgcPopScraper] Raw pop response shape:', JSON.stringify(data).substring(0, 500));

  // Format 1: Grade-keyed object { "10": 50, "9.5": 120 }
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Check for nested grades/counts sub-object first
    const inner = data.grades ?? data.counts ?? data.Grades ?? data.Counts ?? data;

    if (typeof inner === 'object' && !Array.isArray(inner)) {
      const entries: PopGradeEntry[] = [];
      for (const [key, value] of Object.entries(inner)) {
        const grade = normalizeGrade(key);
        if (!grade) continue;
        const count = typeof value === 'number' ? value : parseInt(String(value), 10);
        if (!isNaN(count) && count > 0) {
          entries.push({ grade, count });
        }
      }
      if (entries.length > 0) return entries;
    }

    // Check for array inside nested structure
    const arr = data.grades ?? data.items ?? data.data ?? data.Grades;
    if (Array.isArray(arr)) {
      return parseArrayFormat(arr);
    }
  }

  // Format 2: Array of objects [{ grade: "10", count: 50 }, ...]
  if (Array.isArray(data)) {
    return parseArrayFormat(data);
  }

  return [];
}

function parseArrayFormat(arr: any[]): PopGradeEntry[] {
  const entries: PopGradeEntry[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const gradeRaw = item.grade ?? item.Grade ?? item.label ?? item.name;
    const countRaw = item.count ?? item.Count ?? item.pop ?? item.population ?? item.total ?? item.value;
    const grade = normalizeGrade(String(gradeRaw));
    if (!grade) continue;
    const count = typeof countRaw === 'number' ? countRaw : parseInt(String(countRaw), 10);
    if (!isNaN(count) && count > 0) {
      entries.push({ grade, count });
    }
  }
  return entries;
}

/**
 * Normalize a grade string to our canonical format.
 * Strips CGC qualifier labels (Pristine, Gem Mint, Mint, etc.).
 */
function normalizeGrade(raw: string): string | null {
  if (!raw) return null;
  // Extract numeric portion — e.g. "Pristine 10" → "10", "9.5" → "9.5"
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const grade = match[1];
  // Verify it's a known grade
  if (!CGC_GRADE_ORDER.includes(grade)) return null;
  return grade;
}

/**
 * Sum population counts for all grades strictly above the target grade.
 */
function computeHigherGradePop(entries: PopGradeEntry[], targetGrade: string): number {
  const targetIdx = CGC_GRADE_ORDER.indexOf(targetGrade);
  if (targetIdx < 0) return 0;
  let total = 0;
  for (const entry of entries) {
    const idx = CGC_GRADE_ORDER.indexOf(entry.grade);
    if (idx > targetIdx) total += entry.count;
  }
  return total;
}

function mapCategoryToPath(category?: string): string {
  if (!category) return '';
  return CATEGORY_PATH_MAP[category.toLowerCase()] || '';
}

// ─── Scraper Class ──────────────────────────────────────────────────────────

class CgcPopScraper implements PopScraper {
  public readonly company = 'CGC';
  private browserService?: BrowserService;

  constructor(browserService?: BrowserService) {
    this.browserService = browserService;
  }

  async fetchPopulation(request: PopRequest): Promise<PopulationData | null> {
    if (!this.browserService || !this.browserService.isRunning()) {
      return null;
    }

    let page: any;

    try {
      const queries = buildSearchQueries(request);
      const categoryPath = mapCategoryToPath(request.category);
      const popUrl = categoryPath ? `${CGC_POP_URL}${categoryPath}/` : CGC_POP_URL;

      let bestResult: { description: string } | null = null;
      let bestScore = -1;

      for (const query of queries) {
        console.log(`[CgcPopScraper] Trying query: "${query}"`);

        page = await this.browserService.navigateWithThrottle('CGC', popUrl);

        // Type into the autocomplete search input
        try {
          await page.waitForSelector('input[type="text"]', { timeout: 10000 });
        } catch {
          console.log('[CgcPopScraper] Search input not found');
          await page.close();
          page = undefined;
          continue;
        }

        await page.focus('input[type="text"]');
        await page.type('input[type="text"]', query, { delay: 30 });

        // Wait for autocomplete suggestions to appear
        try {
          await page.waitForSelector('.angucomplete-row, .suggestion-row, .autocomplete-suggestion, [class*="suggestion"], [class*="result"]', { timeout: 8000 });
        } catch {
          console.log('[CgcPopScraper] No autocomplete suggestions appeared');
          await page.close();
          page = undefined;
          continue;
        }

        // Extract and score suggestions
        const suggestions = await page.evaluate(`
          (() => {
            const rows = document.querySelectorAll('.angucomplete-row, .suggestion-row, .autocomplete-suggestion, [class*="suggestion-item"]');
            return Array.from(rows).map((row, i) => ({
              description: row.textContent.trim(),
              index: i,
            }));
          })()
        `) as Array<{ description: string; index: number }>;

        console.log(`[CgcPopScraper] Found ${suggestions.length} suggestions`);

        if (suggestions.length > 0) {
          let localBestIdx = -1;
          for (const s of suggestions) {
            const sc = scoreMatch(s.description, request);
            if (sc > bestScore) {
              bestScore = sc;
              bestResult = s;
              localBestIdx = s.index;
            }
          }

          if (localBestIdx >= 0 && bestScore > 0) {
            console.log(`[CgcPopScraper] Best match (score ${bestScore}): "${bestResult!.description}"`);

            // Click the best suggestion
            await page.evaluate(`
              (() => {
                const rows = document.querySelectorAll('.angucomplete-row, .suggestion-row, .autocomplete-suggestion, [class*="suggestion-item"]');
                if (rows[${localBestIdx}]) rows[${localBestIdx}].click();
              })()
            `);

            break;
          }
        }

        await page.close();
        page = undefined;
      }

      if (!bestResult || bestScore <= 0) {
        console.log('[CgcPopScraper] No results for any query variant');
        if (page) await page.close();
        return null;
      }

      // Wait for grade data to load — try API interception first, then DOM fallback
      let gradeBreakdown: PopGradeEntry[] = [];

      // Attempt 1: Intercept CGC API response
      try {
        const apiResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes(CGC_API_HOST),
          { timeout: 15000 }
        );

        const apiResponse = await apiResponsePromise;
        const responseText = await apiResponse.text();
        const responseData = JSON.parse(responseText);
        gradeBreakdown = parsePopResponse(responseData);
      } catch (interceptErr) {
        console.log('[CgcPopScraper] API interception failed:', interceptErr instanceof Error ? interceptErr.message : interceptErr);
      }

      // Attempt 2: DOM scraping fallback — scrape ui.grid or table
      if (gradeBreakdown.length === 0) {
        console.log('[CgcPopScraper] Falling back to DOM scraping');
        try {
          await page.waitForSelector('.ui-grid-row, table tbody tr, [class*="grade"]', { timeout: 10000 });

          const domData = await page.evaluate(`
            (() => {
              // Try ui.grid rows first
              const gridRows = document.querySelectorAll('.ui-grid-row');
              if (gridRows.length > 0) {
                return Array.from(gridRows).map(row => {
                  const cells = row.querySelectorAll('.ui-grid-cell-contents');
                  return {
                    grade: cells[0] ? cells[0].textContent.trim() : '',
                    count: cells[1] ? cells[1].textContent.trim() : '0',
                  };
                });
              }

              // Fallback to standard table
              const rows = document.querySelectorAll('table tbody tr');
              return Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                return {
                  grade: cells[0] ? cells[0].textContent.trim() : '',
                  count: cells[1] ? cells[1].textContent.trim() : '0',
                };
              });
            })()
          `) as Array<{ grade: string; count: string }>;

          gradeBreakdown = parsePopResponse(domData);
        } catch (domErr) {
          console.log('[CgcPopScraper] DOM scraping failed:', domErr instanceof Error ? domErr.message : domErr);
        }
      }

      await page.close();
      page = undefined;

      if (gradeBreakdown.length === 0) {
        console.log('[CgcPopScraper] No grade breakdown data found');
        return null;
      }

      const totalGraded = gradeBreakdown.reduce((sum, e) => sum + e.count, 0);
      const targetEntry = gradeBreakdown.find(e => e.grade === request.grade);
      const targetGradePop = targetEntry?.count ?? 0;
      const higherGradePop = computeHigherGradePop(gradeBreakdown, request.grade);
      const percentile = computePercentile(targetGradePop, higherGradePop, totalGraded);
      const rarityTier = classifyRarityTier(targetGradePop);

      console.log(`[CgcPopScraper] Success: grade=${request.grade} pop=${targetGradePop} total=${totalGraded} tier=${rarityTier}`);

      return {
        gradingCompany: 'CGC',
        totalGraded,
        gradeBreakdown,
        targetGrade: request.grade,
        targetGradePop,
        higherGradePop,
        percentile,
        rarityTier,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[CgcPopScraper] Error:', err instanceof Error ? err.message : err);
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
      return null;
    }
  }
}

export default CgcPopScraper;
export {
  buildSearchQueries,
  scoreMatch,
  parsePopResponse,
  computeHigherGradePop,
  normalizeGrade,
  mapCategoryToPath,
  CATEGORY_PATH_MAP,
  CGC_GRADE_ORDER,
};
