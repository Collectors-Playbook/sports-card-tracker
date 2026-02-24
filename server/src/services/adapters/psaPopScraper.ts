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
 * Parse grade breakdown from PSA's JSON API Counts object.
 */
function parsePopJson(counts: Record<string, number>): PopGradeEntry[] {
  const entries: PopGradeEntry[] = [];
  for (const [key, grade] of COUNTS_GRADE_MAP) {
    const count = counts[key];
    if (typeof count === 'number' && count > 0) {
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

      // Step 1: Navigate to search page
      page = await this.browserService.navigateWithThrottle('PSA', PSA_SEARCH_URL);

      // Step 2: Try each query, submit the form, find the best match
      let bestSpecId: string | null = null;
      let bestDescription = '';

      for (const query of queries) {
        console.log(`[PsaPopScraper] Trying query: "${query}" (category: "${categoryValue || 'All'}")`);

        // Clear input, set values, submit form
        const results = await page.evaluate(`
          (async () => {
            const input = document.getElementById('term');
            const categorySelect = document.getElementById('categoryid');
            const form = document.getElementById('formSearch');
            if (!input || !form) return [];

            input.value = ${JSON.stringify(query)};
            if (categorySelect) categorySelect.value = ${JSON.stringify(categoryValue)};

            // Submit form via jQuery (PSA uses jQuery AJAX form submission)
            return new Promise(resolve => {
              // Listen for the table to populate
              const check = () => {
                const table = document.getElementById('tableResults');
                if (table) {
                  const rows = table.querySelectorAll('tbody tr');
                  if (rows.length > 0) {
                    const results = Array.from(rows).map(tr => {
                      const cells = tr.querySelectorAll('td');
                      const showPop = tr.querySelector('.show-pop');
                      return {
                        description: cells[1] ? cells[1].textContent.trim() : '',
                        specId: showPop ? showPop.getAttribute('data-id') : null,
                      };
                    }).filter(r => r.specId);
                    resolve(results);
                    return;
                  }
                }
                // Check again after delay
                setTimeout(check, 500);
              };

              // Trigger form submit
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

              // Start checking for results after a brief delay
              setTimeout(check, 1000);

              // Timeout after 8 seconds
              setTimeout(() => resolve([]), 8000);
            });
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
      }

      if (!bestSpecId) {
        console.log(`[PsaPopScraper] No results for any query variant`);
        await page.close();
        return null;
      }

      // Step 3: Fetch pop data via JSON API (PSA returns double-encoded JSON)
      console.log(`[PsaPopScraper] Fetching pop JSON for specId ${bestSpecId}`);
      const popJson = await page.evaluate(`
        (async () => {
          try {
            const response = await fetch('${PSA_POP_JSON_URL}?specid=' + ${JSON.stringify(bestSpecId)});
            if (!response.ok) return null;
            const text = await response.text();
            const outer = JSON.parse(text);
            return typeof outer === 'string' ? JSON.parse(outer) : outer;
          } catch {
            return null;
          }
        })()
      `);

      await page.close();
      page = undefined;

      if (!popJson || !popJson.DNAData) {
        console.log(`[PsaPopScraper] Failed to fetch pop JSON`);
        return null;
      }

      const data = popJson.DNAData;
      const counts = data.Counts;

      if (!counts) {
        console.log(`[PsaPopScraper] No Counts in pop JSON`);
        return null;
      }

      // Parse grade breakdown from JSON
      const gradeBreakdown = parsePopJson(counts);
      if (gradeBreakdown.length === 0) {
        console.log(`[PsaPopScraper] No valid grade entries in pop JSON`);
        return null;
      }

      const totalGraded = typeof data.Total === 'number' ? data.Total : gradeBreakdown.reduce((sum, e) => sum + e.count, 0);
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
