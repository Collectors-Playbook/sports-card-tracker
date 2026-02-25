import { PopScraper, PopRequest, PopulationData, PopGradeEntry } from '../../types';
import { classifyRarityTier, computePercentile } from '../populationReportService';
import BrowserService from '../browserService';

// ─── Constants ──────────────────────────────────────────────────────────────

const GEMRATE_SEARCH_URL = 'https://gemrate.com/universal-search';

// Universal grade ordering covering all grading companies (higher index = higher grade).
const UNIVERSAL_GRADE_ORDER = [
  '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5',
  '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5',
  '9', '9.5', '10',
];

// ─── Pure Functions (exported for testing) ──────────────────────────────────

/**
 * Build progressively simpler search queries for GemRate's universal search.
 * Same progressive-narrowing strategy as PSA/CGC.
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
 * Score how well a GemRate search result description matches the requested card.
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
 * Parse GemRate's API response into PopGradeEntry[], filtering to a specific grading company.
 * GemRate aggregates data from multiple companies, so we need to extract only the target company's data.
 *
 * Handles multiple possible response formats:
 *  1. Grade-keyed object: { "10": 50, "9.5": 120, ... }
 *  2. Array of objects: [{ grade: "10", count: 50 }, ...]
 *  3. Nested structure with company-keyed sub-objects: { PSA: { "10": 50 }, BGS: { "9.5": 30 } }
 */
function parseGemRateResponse(
  data: any,
  targetCompany: string
): { gradeBreakdown: PopGradeEntry[]; totalGraded: number } | null {
  if (!data) return null;

  // Log raw response for debugging
  console.log('[GemRatePopScraper] Raw response shape:', JSON.stringify(data).substring(0, 500));

  const companyLower = targetCompany.toLowerCase();

  // Check for company-keyed structure: { PSA: {...}, BGS: {...} }
  if (typeof data === 'object' && !Array.isArray(data)) {
    // Look for target company key (case-insensitive)
    const companyKey = Object.keys(data).find(k => k.toLowerCase() === companyLower);
    if (companyKey && typeof data[companyKey] === 'object') {
      const companyData = data[companyKey];
      const entries = parseGradeData(companyData);
      if (entries.length > 0) {
        const totalGraded = entries.reduce((sum, e) => sum + e.count, 0);
        return { gradeBreakdown: entries, totalGraded };
      }
    }

    // Try nested pop/population/grades sub-objects that may contain company keys
    const popContainer = data.pop ?? data.population ?? data.grades ?? data.data;
    if (popContainer && typeof popContainer === 'object') {
      const innerKey = Object.keys(popContainer).find(k => k.toLowerCase() === companyLower);
      if (innerKey && typeof popContainer[innerKey] === 'object') {
        const entries = parseGradeData(popContainer[innerKey]);
        if (entries.length > 0) {
          const totalGraded = entries.reduce((sum, e) => sum + e.count, 0);
          return { gradeBreakdown: entries, totalGraded };
        }
      }
    }

    // No company separation — parse as flat grade data
    const entries = parseGradeData(data);
    if (entries.length > 0) {
      const totalGraded = entries.reduce((sum, e) => sum + e.count, 0);
      return { gradeBreakdown: entries, totalGraded };
    }
  }

  // Array format
  if (Array.isArray(data)) {
    const entries = parseArrayFormat(data);
    if (entries.length > 0) {
      const totalGraded = entries.reduce((sum, e) => sum + e.count, 0);
      return { gradeBreakdown: entries, totalGraded };
    }
  }

  return null;
}

/**
 * Parse grade data from an object (grade-keyed or nested).
 */
function parseGradeData(data: any): PopGradeEntry[] {
  if (!data || typeof data !== 'object') return [];

  // If it's an array, use array parser
  if (Array.isArray(data)) return parseArrayFormat(data);

  // Check for nested grades/counts sub-object first
  const inner = data.grades ?? data.counts ?? data.Grades ?? data.Counts ?? data;

  if (typeof inner === 'object' && !Array.isArray(inner)) {
    const entries: PopGradeEntry[] = [];
    for (const [key, value] of Object.entries(inner)) {
      const grade = normalizeGemRateGrade(key);
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

  return [];
}

function parseArrayFormat(arr: any[]): PopGradeEntry[] {
  const entries: PopGradeEntry[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const gradeRaw = item.grade ?? item.Grade ?? item.label ?? item.name;
    const countRaw = item.count ?? item.Count ?? item.pop ?? item.population ?? item.total ?? item.value;
    const grade = normalizeGemRateGrade(String(gradeRaw));
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
 * Strips company prefixes ("PSA 10" → "10", "BGS 9.5" → "9.5") and qualifier labels.
 */
function normalizeGemRateGrade(raw: string): string | null {
  if (!raw) return null;
  // Extract numeric portion — strips prefixes like "PSA ", "BGS ", "CGC ", qualifier labels
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const grade = match[1];
  if (!UNIVERSAL_GRADE_ORDER.includes(grade)) return null;
  return grade;
}

/**
 * Sum population counts for all grades strictly above the target grade.
 */
function computeHigherGradePop(entries: PopGradeEntry[], targetGrade: string): number {
  const targetIdx = UNIVERSAL_GRADE_ORDER.indexOf(targetGrade);
  if (targetIdx < 0) return 0;
  let total = 0;
  for (const entry of entries) {
    const idx = UNIVERSAL_GRADE_ORDER.indexOf(entry.grade);
    if (idx > targetIdx) total += entry.count;
  }
  return total;
}

// ─── Scraper Class ──────────────────────────────────────────────────────────

class GemRatePopScraper implements PopScraper {
  public readonly company = 'GemRate';
  private browserService?: BrowserService;

  constructor(browserService?: BrowserService) {
    this.browserService = browserService;
  }

  async fetchPopulation(request: PopRequest): Promise<PopulationData | null> {
    if (!this.browserService || !this.browserService.isRunning()) {
      return null;
    }

    if (!request.gradingCompany) {
      console.log('[GemRatePopScraper] No gradingCompany specified, cannot filter results');
      return null;
    }

    let page: any;

    try {
      const queries = buildSearchQueries(request);
      const targetCompany = request.gradingCompany;

      let bestResult: { description: string } | null = null;
      let bestScore = -1;
      let apiResponseData: any = null;

      for (const query of queries) {
        console.log(`[GemRatePopScraper] Trying query: "${query}"`);

        page = await this.browserService.navigateWithThrottle('GemRate', GEMRATE_SEARCH_URL);

        // Type into the search input (GemRate triggers search after 5+ chars)
        try {
          await page.waitForSelector('#search', { timeout: 10000 });
        } catch {
          console.log('[GemRatePopScraper] Search input not found');
          await page.close();
          page = undefined;
          continue;
        }

        // Set up API response interception before typing
        const apiResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes('universal-search-query'),
          { timeout: 15000 }
        ).catch(() => null);

        await page.focus('#search');
        await page.type('#search', query, { delay: 30 });

        // Wait for API response
        const apiResponse = await apiResponsePromise;

        if (apiResponse) {
          try {
            const responseText = await apiResponse.text();
            const responseData = JSON.parse(responseText);

            // Response may be an array of results or a single object
            const results = Array.isArray(responseData) ? responseData : (responseData.results ?? responseData.data ?? [responseData]);

            if (Array.isArray(results)) {
              for (const result of results) {
                const desc = result.description ?? result.name ?? result.title ?? '';
                if (!desc) continue;
                const sc = scoreMatch(desc, request);
                if (sc > bestScore) {
                  bestScore = sc;
                  bestResult = { description: desc };
                  apiResponseData = result;
                }
              }
            }

            if (bestResult && bestScore > 0) {
              console.log(`[GemRatePopScraper] Best match (score ${bestScore}): "${bestResult.description}"`);
              await page.close();
              page = undefined;
              break;
            }
          } catch (parseErr) {
            console.log('[GemRatePopScraper] Failed to parse API response:', parseErr instanceof Error ? parseErr.message : parseErr);
          }
        }

        await page.close();
        page = undefined;
      }

      if (!bestResult || bestScore <= 0 || !apiResponseData) {
        console.log('[GemRatePopScraper] No results for any query variant');
        if (page) await page.close();
        return null;
      }

      // Parse response, filtering to target grading company
      const parsed = parseGemRateResponse(apiResponseData, targetCompany);
      if (!parsed || parsed.gradeBreakdown.length === 0) {
        console.log(`[GemRatePopScraper] No grade breakdown data found for ${targetCompany}`);
        return null;
      }

      const { gradeBreakdown, totalGraded } = parsed;
      const targetEntry = gradeBreakdown.find(e => e.grade === request.grade);
      const targetGradePop = targetEntry?.count ?? 0;
      const higherGradePop = computeHigherGradePop(gradeBreakdown, request.grade);
      const percentile = computePercentile(targetGradePop, higherGradePop, totalGraded);
      const rarityTier = classifyRarityTier(targetGradePop);

      console.log(`[GemRatePopScraper] Success: grade=${request.grade} pop=${targetGradePop} total=${totalGraded} tier=${rarityTier}`);

      return {
        gradingCompany: targetCompany,
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
      console.error('[GemRatePopScraper] Error:', err instanceof Error ? err.message : err);
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
      return null;
    }
  }
}

export default GemRatePopScraper;
export {
  buildSearchQueries,
  scoreMatch,
  parseGemRateResponse,
  computeHigherGradePop,
  normalizeGemRateGrade,
  GEMRATE_SEARCH_URL,
  UNIVERSAL_GRADE_ORDER,
};
