import CgcPopScraper, {
  buildSearchQueries,
  scoreMatch,
  parsePopResponse,
  computeHigherGradePop,
  normalizeGrade,
  mapCategoryToPath,
  CATEGORY_PATH_MAP,
  CGC_GRADE_ORDER,
} from '../../../services/adapters/cgcPopScraper';
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

  it('omits setName-based queries when setName is undefined', () => {
    const queries = buildSearchQueries({
      player: 'Luka Doncic',
      year: 2022,
      brand: 'Panini',
      cardNumber: '44',
      grade: '9.5',
    });
    // Without setName, only 2 queries: year+brand+lastName+cardNum & year+brand+lastName
    expect(queries.length).toBe(2);
    expect(queries[0]).toBe('2022 Panini Doncic 44');
    expect(queries[1]).toBe('2022 Panini Doncic');
  });
});

// ─── normalizeGrade ─────────────────────────────────────────────────────────

describe('normalizeGrade', () => {
  it('extracts numeric grade from qualifier label', () => {
    expect(normalizeGrade('Pristine 10')).toBe('10');
    expect(normalizeGrade('Gem Mint 10')).toBe('10');
    expect(normalizeGrade('Mint 9')).toBe('9');
    expect(normalizeGrade('9.5')).toBe('9.5');
  });

  it('returns null for empty or non-numeric strings', () => {
    expect(normalizeGrade('')).toBeNull();
    expect(normalizeGrade('N/A')).toBeNull();
    expect(normalizeGrade('Auth')).toBeNull();
  });

  it('returns null for grades not in CGC_GRADE_ORDER', () => {
    expect(normalizeGrade('11')).toBeNull();
    expect(normalizeGrade('0.5')).toBeNull();
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
    const fullMatch = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry', baseRequest);
    const partialMatch = scoreMatch('2021 Panini Obsidian Aurora AURSCU Curry', baseRequest);
    expect(fullMatch).toBeGreaterThan(partialMatch);
  });

  it('scores higher for card number match', () => {
    const withNum = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry', baseRequest);
    const withoutNum = scoreMatch('2021 Panini Obsidian Aurora Stephen Curry', baseRequest);
    expect(withNum).toBeGreaterThan(withoutNum);
  });

  it('scores higher for parallel match', () => {
    const withParallel = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry Orange', baseRequest);
    const withoutParallel = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry', baseRequest);
    expect(withParallel).toBeGreaterThan(withoutParallel);
  });

  it('prefers base card when no parallel specified', () => {
    const requestNoParallel = { ...baseRequest, parallel: undefined };
    const base = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry', requestNoParallel);
    const parallel = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry Refractor', requestNoParallel);
    expect(base).toBeGreaterThan(parallel);
  });

  it('scores higher for set name match', () => {
    const withSet = scoreMatch('2021 Panini Obsidian Aurora AURSCU Stephen Curry', baseRequest);
    const withoutSet = scoreMatch('2021 Panini AURSCU Stephen Curry', baseRequest);
    expect(withSet).toBeGreaterThan(withoutSet);
  });
});

// ─── parsePopResponse ───────────────────────────────────────────────────────

describe('parsePopResponse', () => {
  it('parses grade-keyed object format', () => {
    const data = { '10': 50, '9.5': 120, '9': 300, '8': 500 };
    const result = parsePopResponse(data);
    expect(result).toEqual(expect.arrayContaining([
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
      { grade: '8', count: 500 },
    ]));
    expect(result).toHaveLength(4);
  });

  it('parses array of objects format', () => {
    const data = [
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
    ];
    const result = parsePopResponse(data);
    expect(result).toEqual([
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
    ]);
  });

  it('parses nested grades sub-object', () => {
    const data = {
      grades: { '10': 5, '9': 20 },
    };
    const result = parsePopResponse(data);
    expect(result).toEqual(expect.arrayContaining([
      { grade: '10', count: 5 },
      { grade: '9', count: 20 },
    ]));
  });

  it('parses nested counts sub-object', () => {
    const data = {
      counts: { '10': 5, '9': 20 },
    };
    const result = parsePopResponse(data);
    expect(result).toEqual(expect.arrayContaining([
      { grade: '10', count: 5 },
      { grade: '9', count: 20 },
    ]));
  });

  it('handles qualifier labels in grade keys', () => {
    const data = { 'Pristine 10': 3, 'Gem Mint 10': 47, 'Mint 9': 200 };
    const result = parsePopResponse(data);
    // Both "Pristine 10" and "Gem Mint 10" normalize to grade "10"
    // Only the first one encountered is kept (object iteration order)
    expect(result.some(e => e.grade === '10')).toBe(true);
    expect(result.some(e => e.grade === '9')).toBe(true);
  });

  it('handles string count values', () => {
    const data = { '10': '50', '9': '120' };
    const result = parsePopResponse(data);
    expect(result).toEqual(expect.arrayContaining([
      { grade: '10', count: 50 },
      { grade: '9', count: 120 },
    ]));
  });

  it('skips zero-count grades', () => {
    const data = { '10': 50, '9': 0, '8': 0 };
    const result = parsePopResponse(data);
    expect(result).toEqual([{ grade: '10', count: 50 }]);
  });

  it('returns empty array for null/undefined input', () => {
    expect(parsePopResponse(null)).toEqual([]);
    expect(parsePopResponse(undefined)).toEqual([]);
  });

  it('returns empty array for invalid data', () => {
    expect(parsePopResponse('not an object')).toEqual([]);
    expect(parsePopResponse(42)).toEqual([]);
  });

  it('parses array with alternative field names', () => {
    const data = [
      { Grade: 'Pristine 10', pop: 5 },
      { Grade: '9.5', pop: 25 },
    ];
    const result = parsePopResponse(data);
    expect(result).toEqual([
      { grade: '10', count: 5 },
      { grade: '9.5', count: 25 },
    ]);
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

  it('handles half-step grades', () => {
    const withHalf: PopGradeEntry[] = [
      { grade: '8.5', count: 30 },
      { grade: '9', count: 50 },
      { grade: '9.5', count: 20 },
      { grade: '10', count: 5 },
    ];
    expect(computeHigherGradePop(withHalf, '8.5')).toBe(75); // 50 + 20 + 5
    expect(computeHigherGradePop(withHalf, '9')).toBe(25); // 20 + 5
  });
});

// ─── mapCategoryToPath ──────────────────────────────────────────────────────

describe('mapCategoryToPath', () => {
  it('maps sports categories to "sports"', () => {
    expect(mapCategoryToPath('Baseball')).toBe('sports');
    expect(mapCategoryToPath('basketball')).toBe('sports');
    expect(mapCategoryToPath('Football')).toBe('sports');
  });

  it('maps Pokemon to "tcg"', () => {
    expect(mapCategoryToPath('Pokemon')).toBe('tcg');
  });

  it('returns empty string for unknown categories', () => {
    expect(mapCategoryToPath('Other')).toBe('');
    expect(mapCategoryToPath(undefined)).toBe('');
  });
});

// ─── CgcPopScraper ──────────────────────────────────────────────────────────

describe('CgcPopScraper', () => {
  it('returns null when browserService is not provided', async () => {
    const scraper = new CgcPopScraper();
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
    const scraper = new CgcPopScraper(mockBrowser);
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
      waitForSelector: jest.fn().mockRejectedValue(new Error('timeout')),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new CgcPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });
    expect(result).toBeNull();
  });

  it('returns PopulationData when API interception succeeds', async () => {
    const apiResponseData = { '10': 3, '9.5': 20, '9': 50, '8': 200 };

    const mockApiResponse = {
      url: () => `https://${('production.api.aws.ccg-ops.com')}/api/pop/123`,
      text: jest.fn().mockResolvedValue(JSON.stringify(apiResponseData)),
    };

    const suggestions = [
      { description: '2023 Topps Chrome 1 Mike Trout', index: 0 },
      { description: '2023 Topps Chrome 1 Mike Trout Refractor', index: 1 },
    ];

    let evalCallCount = 0;
    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockResolvedValue(mockApiResponse),
      evaluate: jest.fn().mockImplementation(() => {
        evalCallCount++;
        // 1st call: extract suggestions
        if (evalCallCount === 1) return Promise.resolve(suggestions);
        // 2nd call: click suggestion
        if (evalCallCount === 2) return Promise.resolve(undefined);
        return Promise.resolve(null);
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new CgcPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('CGC');
    expect(result!.targetGrade).toBe('10');
    expect(result!.targetGradePop).toBe(3);
    expect(result!.totalGraded).toBe(273); // 3 + 20 + 50 + 200
    expect(result!.higherGradePop).toBe(0);
    expect(result!.rarityTier).toBe('ultra-low');
    expect(result!.gradeBreakdown).toHaveLength(4);
  });

  it('falls back to DOM scraping when API interception fails', async () => {
    const domGradeData = [
      { grade: '10', count: '5' },
      { grade: '9', count: '100' },
    ];

    let evalCallCount = 0;
    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockRejectedValue(new Error('timeout')),
      evaluate: jest.fn().mockImplementation(() => {
        evalCallCount++;
        // 1st call: extract suggestions
        if (evalCallCount === 1) return Promise.resolve([
          { description: '2023 Topps Chrome 1 Mike Trout', index: 0 },
        ]);
        // 2nd call: click suggestion
        if (evalCallCount === 2) return Promise.resolve(undefined);
        // 3rd call: DOM scraping fallback
        if (evalCallCount === 3) return Promise.resolve(domGradeData);
        return Promise.resolve(null);
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new CgcPopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
    });

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('CGC');
    expect(result!.targetGradePop).toBe(5);
    expect(result!.totalGraded).toBe(105);
  });

  it('returns null and cleans up page on error', async () => {
    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockRejectedValue(new Error('Navigation failed')),
      type: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new CgcPopScraper(mockBrowser);
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

  it('has company set to CGC', () => {
    const scraper = new CgcPopScraper();
    expect(scraper.company).toBe('CGC');
  });
});
