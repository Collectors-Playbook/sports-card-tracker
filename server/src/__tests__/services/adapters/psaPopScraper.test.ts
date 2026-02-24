import PsaPopScraper, { buildPopSearchUrl, parseGradeBreakdown, computeHigherGradePop } from '../../../services/adapters/psaPopScraper';
import { PopGradeEntry, PopRequest } from '../../../types';

// ─── buildPopSearchUrl ──────────────────────────────────────────────────────

describe('buildPopSearchUrl', () => {
  it('builds URL with basic card info', () => {
    const url = buildPopSearchUrl({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(url).toContain('psacard.com/pop/search');
    expect(url).toContain('2023');
    expect(url).toContain('Topps');
    expect(url).toContain('Mike+Trout');
    expect(url).toContain('%231'); // #1 url-encoded
  });

  it('includes setName and parallel when provided', () => {
    const url = buildPopSearchUrl({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      setName: 'Chrome',
      parallel: 'Refractor',
      grade: '10',
    });
    expect(url).toContain('Chrome');
    expect(url).toContain('Refractor');
  });
});

// ─── parseGradeBreakdown ────────────────────────────────────────────────────

describe('parseGradeBreakdown', () => {
  it('parses grade/count rows', () => {
    const rows = [
      ['10', '150'],
      ['9', '500'],
      ['8', '1200'],
    ];
    const result = parseGradeBreakdown(rows);
    expect(result).toEqual([
      { grade: '10', count: 150 },
      { grade: '9', count: 500 },
      { grade: '8', count: 1200 },
    ]);
  });

  it('handles comma-formatted numbers', () => {
    const rows = [['10', '1,500']];
    const result = parseGradeBreakdown(rows);
    expect(result).toEqual([{ grade: '10', count: 1500 }]);
  });

  it('skips rows with insufficient cells', () => {
    const rows = [['10']];
    const result = parseGradeBreakdown(rows);
    expect(result).toEqual([]);
  });

  it('skips rows with non-numeric counts', () => {
    const rows = [['10', 'N/A']];
    const result = parseGradeBreakdown(rows);
    expect(result).toEqual([]);
  });

  it('skips empty grade names', () => {
    const rows = [['', '50']];
    const result = parseGradeBreakdown(rows);
    expect(result).toEqual([]);
  });
});

// ─── computeHigherGradePop ──────────────────────────────────────────────────

describe('computeHigherGradePop', () => {
  const entries: PopGradeEntry[] = [
    { grade: '8', count: 100 },
    { grade: '9', count: 50 },
    { grade: '10', count: 10 },
  ];

  it('returns 0 for the highest grade', () => {
    expect(computeHigherGradePop(entries, '10')).toBe(0);
  });

  it('sums counts of all higher grades', () => {
    expect(computeHigherGradePop(entries, '8')).toBe(60); // 50 + 10
    expect(computeHigherGradePop(entries, '9')).toBe(10);
  });

  it('returns 0 for unrecognized grade', () => {
    expect(computeHigherGradePop(entries, 'unknown')).toBe(0);
  });
});

// ─── PsaPopScraper ──────────────────────────────────────────────────────────

describe('PsaPopScraper', () => {
  it('returns null when browserService is not provided', async () => {
    const scraper = new PsaPopScraper();
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(result).toBeNull();
  });

  it('returns null when browserService is not running', async () => {
    const mockBrowser = { isRunning: () => false } as any;
    const scraper = new PsaPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(result).toBeNull();
  });

  it('returns null when search finds no detail link', async () => {
    const mockPage = {
      evaluate: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new PsaPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(result).toBeNull();
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('returns PopulationData when scraping succeeds', async () => {
    const searchPage = {
      evaluate: jest.fn().mockResolvedValue('https://www.psacard.com/pop/baseball/2023/topps/123'),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const popPage = {
      evaluate: jest.fn().mockResolvedValue([
        ['10', '3'],
        ['9', '50'],
        ['8', '200'],
      ]),
      close: jest.fn().mockResolvedValue(undefined),
    };

    let callCount = 0;
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? searchPage : popPage;
      }),
    } as any;

    const scraper = new PsaPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('PSA');
    expect(result!.targetGrade).toBe('10');
    expect(result!.targetGradePop).toBe(3);
    expect(result!.totalGraded).toBe(253);
    expect(result!.higherGradePop).toBe(0);
    expect(result!.rarityTier).toBe('ultra-low');
    expect(result!.gradeBreakdown).toHaveLength(3);
  });

  it('returns null and cleans up pages on error', async () => {
    const searchPage = {
      evaluate: jest.fn().mockRejectedValue(new Error('Navigation failed')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(searchPage),
    } as any;

    const scraper = new PsaPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(result).toBeNull();
    expect(searchPage.close).toHaveBeenCalled();
  });
});
