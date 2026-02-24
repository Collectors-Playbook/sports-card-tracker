import PsaPopScraper, {
  buildSearchQueries,
  buildPopSearchUrl,
  parseGradeBreakdown,
  parsePopJson,
  computeHigherGradePop,
  scoreMatch,
  mapCategoryToSearchValue,
  CATEGORY_MAP,
} from '../../../services/adapters/psaPopScraper';
import { PopGradeEntry, PopRequest } from '../../../types';

// ─── buildSearchQueries ─────────────────────────────────────────────────────

describe('buildSearchQueries', () => {
  it('builds progressively simpler queries using last name', () => {
    const queries = buildSearchQueries({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      setName: 'Chrome',
      parallel: 'Refractor',
      grade: '10',
    });
    expect(queries.length).toBeGreaterThanOrEqual(3);
    // Most specific includes setName + last name + card number
    expect(queries[0]).toContain('Chrome');
    expect(queries[0]).toContain('Trout');
    expect(queries[0]).toContain('1');
    // Broadest is just year + brand + last name
    expect(queries[queries.length - 1]).toBe('2023 Topps Trout');
  });

  it('deduplicates identical queries', () => {
    const queries = buildSearchQueries({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    const unique = new Set(queries);
    expect(queries.length).toBe(unique.size);
  });

  it('includes card number in specific queries', () => {
    const queries = buildSearchQueries({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(queries[0]).toContain('1');
  });

  it('strips dashes from card numbers', () => {
    const queries = buildSearchQueries({
      player: 'Stephen Curry',
      year: 2021,
      brand: 'Panini',
      cardNumber: 'AUR-SCU',
      setName: 'Obsidian Aurora',
      grade: '9',
    });
    expect(queries[0]).toContain('AURSCU');
    expect(queries[0]).not.toContain('AUR-SCU');
  });
});

// ─── buildPopSearchUrl ──────────────────────────────────────────────────────

describe('buildPopSearchUrl', () => {
  it('builds URL from query string', () => {
    const url = buildPopSearchUrl('2023 Topps Mike Trout #1');
    expect(url).toContain('psacard.com/pop/search');
    expect(url).toContain('2023');
    expect(url).toContain('Topps');
    expect(url).toContain('Mike+Trout');
  });
});

// ─── parseGradeBreakdown (legacy HTML parsing) ─────────────────────────────

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

// ─── parsePopJson ───────────────────────────────────────────────────────────

describe('parsePopJson', () => {
  it('parses PSA JSON Counts object into PopGradeEntry[]', () => {
    const counts = {
      GradeN0: 0, Grade1: 0, Grade1_5: 0,
      Grade2: 0, Grade2_5: 0, Grade3: 0, Grade3_5: 0,
      Grade4: 0, Grade4_5: 0, Grade5: 0, Grade5_5: 0,
      Grade6: 2, Grade6_5: 0, Grade7: 1, Grade7_5: 0,
      Grade8: 1, Grade8_5: 1, Grade9: 3, Grade9_5: 0, Grade10: 0,
    };
    const result = parsePopJson(counts);
    expect(result).toEqual([
      { grade: '6', count: 2 },
      { grade: '7', count: 1 },
      { grade: '8', count: 1 },
      { grade: '8.5', count: 1 },
      { grade: '9', count: 3 },
    ]);
  });

  it('skips grades with count 0', () => {
    const counts = { Grade10: 5, Grade9: 0, Grade8: 3 };
    const result = parsePopJson(counts);
    expect(result).toEqual([
      { grade: '8', count: 3 },
      { grade: '10', count: 5 },
    ]);
  });

  it('handles Auth grade', () => {
    const counts = { GradeN0: 10, Grade10: 0 };
    const result = parsePopJson(counts);
    expect(result).toEqual([{ grade: 'Auth', count: 10 }]);
  });

  it('returns empty array for all-zero counts', () => {
    const counts = { Grade10: 0, Grade9: 0 };
    const result = parsePopJson(counts);
    expect(result).toEqual([]);
  });

  it('handles PSAData format with string grade values', () => {
    // PSAData returns grades as strings, not numbers
    const counts = { GradeN0: '0', Grade1: '0', Grade8: '200', Grade9: '50', Grade10: '3' };
    const result = parsePopJson(counts);
    expect(result).toEqual([
      { grade: '8', count: 200 },
      { grade: '9', count: 50 },
      { grade: '10', count: 3 },
    ]);
  });
});

// ─── scoreMatch ─────────────────────────────────────────────────────────────

describe('scoreMatch', () => {
  const baseRequest: PopRequest = {
    player: 'Stephen Curry',
    year: 2021,
    brand: 'Panini',
    cardNumber: 'AUR-SCU',
    setName: 'Obsidian Aurora',
    parallel: 'Orange',
    grade: '9',
  };

  it('returns -1 when player last name not found', () => {
    expect(scoreMatch('2021 Panini Obsidian Aurora Mike Trout', baseRequest)).toBe(-1);
  });

  it('scores higher for full player name match', () => {
    const fullMatch = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry', baseRequest);
    const partialMatch = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Curry', baseRequest);
    expect(fullMatch).toBeGreaterThan(partialMatch);
  });

  it('scores higher for card number match', () => {
    const withNum = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry', baseRequest);
    const withoutNum = scoreMatch('2021 Panini Obsidian Aurora Autographs Stephen Curry', baseRequest);
    expect(withNum).toBeGreaterThan(withoutNum);
  });

  it('scores higher for parallel match', () => {
    const withParallel = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry Electric Etch Orange', baseRequest);
    const withoutParallel = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry', baseRequest);
    expect(withParallel).toBeGreaterThan(withoutParallel);
  });

  it('prefers base card when no parallel specified', () => {
    const requestNoParallel = { ...baseRequest, parallel: undefined };
    const base = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry', requestNoParallel);
    const parallel = scoreMatch('2021 Panini Obsidian Aurora Autographs Aurscu Stephen Curry Electric Etch Orange', requestNoParallel);
    expect(base).toBeGreaterThan(parallel);
  });
});

// ─── mapCategoryToSearchValue ───────────────────────────────────────────────

describe('mapCategoryToSearchValue', () => {
  it('maps common sports to PSA category values', () => {
    expect(mapCategoryToSearchValue('Basketball')).toBe('basketball cards');
    expect(mapCategoryToSearchValue('baseball')).toBe('baseball cards');
    expect(mapCategoryToSearchValue('Football')).toBe('football cards');
  });

  it('returns empty string for unknown categories', () => {
    expect(mapCategoryToSearchValue('Other')).toBe('');
    expect(mapCategoryToSearchValue(undefined)).toBe('');
  });

  it('maps Pokemon to TCG cards', () => {
    expect(mapCategoryToSearchValue('Pokemon')).toBe('tcg cards');
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

  it('returns null when search finds no results', async () => {
    const mockPage = {
      evaluate: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockRejectedValue(new Error('timeout')),
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
  });

  it('returns PopulationData when scraping succeeds', async () => {
    const searchResults = [
      { description: '2023 Topps Chrome 1 Mike Trout', specId: '12345' },
      { description: '2023 Topps Chrome 1 Mike Trout Refractor', specId: '12346' },
    ];

    const popJsonResponse = {
      DNAData: {
        SpecID: 12345,
        Total: 253,
        Counts: {
          GradeN0: 0, Grade1: 0, Grade2: 0, Grade3: 0, Grade4: 0,
          Grade5: 0, Grade6: 0, Grade7: 0, Grade8: 200, Grade9: 50, Grade10: 3,
        },
      },
    };

    // Mock the AJAX response intercepted via waitForResponse
    const mockPopResponse = {
      text: jest.fn().mockResolvedValue(JSON.stringify(popJsonResponse)),
    };

    let evalCallCount = 0;
    const mockPage = {
      select: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockResolvedValue(mockPopResponse),
      evaluate: jest.fn().mockImplementation(() => {
        evalCallCount++;
        // 1st call: form submit dispatch (return value ignored)
        if (evalCallCount === 1) return Promise.resolve(undefined);
        // 2nd call: extract results from table
        if (evalCallCount === 2) return Promise.resolve(searchResults);
        return Promise.resolve(null);
      }),
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

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('PSA');
    expect(result!.targetGrade).toBe('10');
    expect(result!.targetGradePop).toBe(3);
    expect(result!.totalGraded).toBe(253);
    expect(result!.higherGradePop).toBe(0);
    expect(result!.rarityTier).toBe('ultra-low');
    expect(result!.gradeBreakdown).toHaveLength(3);
  });

  it('returns null and cleans up page on error', async () => {
    const mockPage = {
      select: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockRejectedValue(new Error('Navigation failed')),
      type: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([]),
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
});
