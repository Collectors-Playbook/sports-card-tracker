import { PopScraper, PopRequest, PopulationData, PopGradeEntry } from '../../types';
import { classifyRarityTier, computePercentile } from '../populationReportService';
import BrowserService from '../browserService';

const PSA_POP_URL = 'https://www.psacard.com/pop';

// Numeric grade ordering (higher index = higher grade)
const PSA_GRADE_ORDER = ['Auth', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10'];

function buildPopSearchUrl(request: PopRequest): string {
  const parts: string[] = [String(request.year), request.brand];
  if (request.setName) parts.push(request.setName);
  parts.push(request.player, `#${request.cardNumber}`);
  if (request.parallel) parts.push(request.parallel);
  const query = parts.join(' ');
  const params = new URLSearchParams({ q: query });
  return `${PSA_POP_URL}/search?${params.toString()}`;
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

    const url = buildPopSearchUrl(request);
    let searchPage;
    let popPage;

    try {
      // Step 1: Search for the card in PSA pop report
      searchPage = await this.browserService.navigateWithThrottle('PSA', url);

      // Find the first pop report detail link
      const detailUrl = await searchPage.evaluate(`
        (() => {
          const links = document.querySelectorAll('a[href*="/pop/"]');
          for (const link of links) {
            const href = link.href;
            if (href.includes('/search')) continue;
            if (/\\/pop\\/[^/]+\\/[^/]+/.test(href)) return href;
          }
          return null;
        })()
      `) as string | null;

      await searchPage.close();
      searchPage = undefined;

      if (!detailUrl) return null;

      // Step 2: Navigate to the pop report page
      popPage = await this.browserService.navigateWithThrottle('PSA', detailUrl);

      // Extract grade breakdown table
      const tableRows = await popPage.evaluate(`
        (() => {
          const tables = document.querySelectorAll('table');
          for (const table of tables) {
            const headerCells = table.querySelectorAll('th');
            const headerText = Array.from(headerCells).map(th => th.textContent.trim().toLowerCase());
            if (headerText.some(h => h.includes('grade') || h.includes('pop'))) {
              const rows = table.querySelectorAll('tbody tr');
              return Array.from(rows).map(tr => {
                return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
              });
            }
          }
          return [];
        })()
      `) as string[][];

      await popPage.close();
      popPage = undefined;

      const gradeBreakdown = parseGradeBreakdown(tableRows);
      if (gradeBreakdown.length === 0) return null;

      const totalGraded = gradeBreakdown.reduce((sum, e) => sum + e.count, 0);
      const targetEntry = gradeBreakdown.find(e => e.grade === request.grade);
      const targetGradePop = targetEntry?.count ?? 0;
      const higherGradePop = computeHigherGradePop(gradeBreakdown, request.grade);
      const percentile = computePercentile(targetGradePop, higherGradePop, totalGraded);
      const rarityTier = classifyRarityTier(targetGradePop);

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
      if (searchPage) {
        try { await searchPage.close(); } catch { /* ignore */ }
      }
      if (popPage) {
        try { await popPage.close(); } catch { /* ignore */ }
      }
      return null;
    }
  }
}

export default PsaPopScraper;
export { buildPopSearchUrl, parseGradeBreakdown, computeHigherGradePop };
