import { PopScraper, PopRequest, PopulationData, PopGradeEntry } from '../../types';
import { classifyRarityTier, computePercentile } from '../populationReportService';
import BrowserService from '../browserService';

const PSA_SEARCH_URL = 'https://www.psacard.com/pop/search';
const PSA_POP_JSON_URL = 'https://www.psacard.com/pop/getpopulationjson';

// Numeric grade ordering (higher index = higher grade)
const PSA_GRADE_ORDER = ['Auth', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];

// Map from JSON Counts keys to our grade strings
const COUNTS_GRADE_MAP: [string, string][] = [
  ['GradeN0', 'Auth'],
  ['Grade1', '1'], ['Grade1_5', '1.5'],
  ['Grade2', '2'], ['Grade2_5', '2.5'],
  ['Grade3', '3'], ['Grade3_5', '3.5'],
  ['Grade4', '4'], ['Grade4_5', '4.5'],
  ['Grade5', '5'], ['Grade5_5', '5.5'],
  ['Grade6', '6'], ['Grade6_5', '6.5'],
  ['Grade7', '7'], ['Grade7_5', '7.5'],
  ['Grade8', '8'], ['Grade8_5', '8.5'],
  ['Grade9', '9'], ['Grade9_5', '9.5'],
  ['Grade10', '10'],
];

// Map card sport category to PSA search category dropdown value
const CATEGORY_MAP: Record<string, string> = {
  'baseball': 'baseball cards',
  'basketball': 'basketball cards',
  'football': 'football cards',
  'hockey': 'hockey cards',
  'soccer': 'soccer cards',
  'golf': 'golf cards',
  'pokemon': 'tcg cards',
};

/**
 * Build progressively simpler search queries for PSA's form-based search.
 * PSA pop search is strict — too many terms yields 0 results.
 */
function buildSearchQueries(request: PopRequest): string[] {
  const queries: string[] = [];
  const playerLastName = request.player.split(' ').pop() || request.player;

  // Normalize card number (PSA stores AUR-SCU as AURSCU)
  const cleanCardNum = request.cardNumber.replace(/[-]/g, '');

  // Most specific: setName + player last name + card number
  if (request.setName) {
    queries.push(`${request.setName} ${playerLastName} ${cleanCardNum}`);
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

function buildPopSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `${PSA_SEARCH_URL}?${params.toString()}`;
}

/**
 * Parse grade breakdown from PSA's JSON API.
 * Handles both DNAData.Counts (numeric values) and PSAData (string values) formats.
 */
function parsePopJson(counts: Record<string, number | string>): PopGradeEntry[] {
  const entries: PopGradeEntry[] = [];
  for (const [key, grade] of COUNTS_GRADE_MAP) {
    const raw = counts[key];
    const count = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (!isNaN(count) && count > 0) {
      entries.push({ grade, count });
    }
  }
  return entries;
}

function parseGradeBreakdown(rows: string[][]): PopGradeEntry[] {
  const entries: PopGradeEntry[] = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const grade = row[0].trim();
    const countStr = row[1].replace(/[^0-9]/g, '');
    const count = parseInt(countStr, 10);
    if (isNaN(count)) continue;
    if (grade) entries.push({ grade, count });
  }
  return entries;
}

function computeHigherGradePop(entries: PopGradeEntry[], targetGrade: string): number {
  const targetIdx = PSA_GRADE_ORDER.indexOf(targetGrade);
  if (targetIdx < 0) return 0;
  let total = 0;
  for (const entry of entries) {
    const idx = PSA_GRADE_ORDER.indexOf(entry.grade);
    if (idx > targetIdx) total += entry.count;
  }
  return total;
}

/**
 * Score how well a PSA search result description matches the requested card.
 * Higher score = better match.
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
    // PSA often uses "Electric Etch {Color}" for Obsidian parallels
    if (desc.includes('electric etch') && desc.includes(parallel)) score += 2;
  } else {
    // Prefer base cards (no Electric Etch / Refractor etc.) when no parallel specified
    if (!desc.includes('electric etch') && !desc.includes('refractor') && !desc.includes('prizm') && !desc.includes('1/1')) {
      score += 3;
    }
  }

  // Set name match
  if (request.setName && desc.includes(request.setName.toLowerCase())) score += 4;

  return score;
}

function mapCategoryToSearchValue(category?: string): string {
  if (!category) return '';
  return CATEGORY_MAP[category.toLowerCase()] || '';
}

class PsaPopScraper implements PopScraper {
  public readonly company = 'PSA';
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
      const categoryValue = mapCategoryToSearchValue(request.category);

      // Step 2: Try each query — use a fresh page per query to avoid stale results
      let bestSpecId: string | null = null;
      let bestDescription = '';

      for (const query of queries) {
        console.log(`[PsaPopScraper] Trying query: "${query}" (category: "${categoryValue || 'All'}")`);

        // Navigate to fresh search page for each query
        page = await this.browserService.navigateWithThrottle('PSA', PSA_SEARCH_URL);

        // Set category dropdown
        if (categoryValue) {
          await page.select('#categoryid', categoryValue);
        }

        // Type query using Puppeteer's native type (fires proper keyboard events)
        await page.focus('#term');
        await page.type('#term', query, { delay: 30 });

        // Submit the form (dispatch submit event — more reliable with jQuery than button click)
        await page.evaluate(`document.getElementById('formSearch').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);

        // Wait for actual results to populate (look for .show-pop elements, not just tbody tr)
        try {
          await page.waitForSelector('#tableResults .show-pop[data-id]', { timeout: 10000 });
        } catch {
          // Timeout — no results for this query
          console.log(`[PsaPopScraper] No results appeared for query`);
          await page.close();
          page = undefined;
          continue;
        }

        // Extract results from the table
        const results = await page.evaluate(`
          (() => {
            const table = document.getElementById('tableResults');
            if (!table) return [];
            return Array.from(table.querySelectorAll('tbody tr')).map(tr => {
              const cells = tr.querySelectorAll('td');
              const showPop = tr.querySelector('.show-pop');
              return {
                description: cells[1] ? cells[1].textContent.trim() : '',
                specId: showPop ? showPop.getAttribute('data-id') : null,
              };
            }).filter(r => r.specId);
          })()
        `) as Array<{ description: string; specId: string }>;

        console.log(`[PsaPopScraper] Found ${results.length} results`);

        if (results.length > 0) {
          // Score each result and pick the best match
          let bestScore = -1;
          for (const r of results) {
            const score = scoreMatch(r.description, request);
            if (score > bestScore) {
              bestScore = score;
              bestSpecId = r.specId;
              bestDescription = r.description;
            }
          }

          if (bestSpecId && bestScore > 0) {
            console.log(`[PsaPopScraper] Best match (score ${bestScore}): "${bestDescription}" (specId: ${bestSpecId})`);
            break;
          }
        }

        // Close this page before trying the next query
        await page.close();
        page = undefined;
      }

      if (!bestSpecId) {
        console.log(`[PsaPopScraper] No results for any query variant`);
        if (page) await page.close();
        return null;
      }

      // Step 3: Click "Show Pop" button and intercept the AJAX response.
      // PSA's JSON API is behind Cloudflare — our own fetch() gets challenged,
      // but clicking the button lets PSA's jQuery make the request with proper tokens.
      console.log(`[PsaPopScraper] Clicking Show Pop for specId ${bestSpecId}`);

      let popJson: any = null;
      try {
        // Set up response listener BEFORE clicking
        const popResponsePromise = page.waitForResponse(
          (resp: any) => resp.url().includes('getpopulationjson'),
          { timeout: 15000 }
        );

        // Click the Show Pop button for the best match
        await page.click(`.show-pop[data-id="${bestSpecId}"]`);

        // Wait for the AJAX response
        const popResponse = await popResponsePromise;
        const popText = await popResponse.text();

        // PSA returns double-encoded JSON (JSON string wrapped in JSON)
        const outer = JSON.parse(popText);
        popJson = typeof outer === 'string' ? JSON.parse(outer) : outer;
      } catch (fetchErr) {
        console.log(`[PsaPopScraper] Failed to intercept pop JSON:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      }

      await page.close();
      page = undefined;

      if (!popJson) {
        console.log(`[PsaPopScraper] Failed to fetch pop JSON`);
        return null;
      }

      // PSA returns data in one of two formats:
      // 1. DNAData.Counts — numeric grade values in a Counts sub-object
      // 2. PSAData — string grade values as top-level properties (DNAData will be null)
      let counts: Record<string, number | string> | null = null;
      let totalFromData: number | undefined;

      if (popJson.DNAData?.Counts) {
        counts = popJson.DNAData.Counts;
        totalFromData = typeof popJson.DNAData.Total === 'number' ? popJson.DNAData.Total : undefined;
      } else if (popJson.PSAData) {
        counts = popJson.PSAData;
        const rawTotal = popJson.PSAData.TotalPop ?? popJson.PSAData.Total;
        totalFromData = rawTotal != null ? parseInt(String(rawTotal), 10) : undefined;
      }

      if (!counts) {
        console.log(`[PsaPopScraper] No grade data in pop JSON (DNAData and PSAData both empty)`);
        return null;
      }

      // Parse grade breakdown from JSON
      const gradeBreakdown = parsePopJson(counts);
      if (gradeBreakdown.length === 0) {
        console.log(`[PsaPopScraper] No valid grade entries in pop JSON`);
        return null;
      }

      const totalGraded = totalFromData && !isNaN(totalFromData) ? totalFromData : gradeBreakdown.reduce((sum, e) => sum + e.count, 0);
      const targetEntry = gradeBreakdown.find(e => e.grade === request.grade);
      const targetGradePop = targetEntry?.count ?? 0;
      const higherGradePop = computeHigherGradePop(gradeBreakdown, request.grade);
      const percentile = computePercentile(targetGradePop, higherGradePop, totalGraded);
      const rarityTier = classifyRarityTier(targetGradePop);

      console.log(`[PsaPopScraper] Success: grade=${request.grade} pop=${targetGradePop} total=${totalGraded} tier=${rarityTier} (${bestDescription})`);

      return {
        gradingCompany: 'PSA',
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
      console.error(`[PsaPopScraper] Error:`, err instanceof Error ? err.message : err);
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
      return null;
    }
  }
}

export default PsaPopScraper;
export { buildSearchQueries, buildPopSearchUrl, parseGradeBreakdown, parsePopJson, computeHigherGradePop, scoreMatch, mapCategoryToSearchValue, CATEGORY_MAP };
