import GemRatePopScraper, {
  buildSearchQueries,
  scoreMatch,
  parseGemRateResponse,
  computeHigherGradePop,
  normalizeGemRateGrade,
  UNIVERSAL_GRADE_ORDER,
} from '../../../services/adapters/gemratePopScraper';
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
    expect(queries.length).toBe(2);
    expect(queries[0]).toBe('2022 Panini Doncic 44');
    expect(queries[1]).toBe('2022 Panini Doncic');
  });
});

// ─── normalizeGemRateGrade ──────────────────────────────────────────────────

describe('normalizeGemRateGrade', () => {
  it('extracts numeric grade from company prefix', () => {
    expect(normalizeGemRateGrade('PSA 10')).toBe('10');
    expect(normalizeGemRateGrade('BGS 9.5')).toBe('9.5');
    expect(normalizeGemRateGrade('CGC 8')).toBe('8');
    expect(normalizeGemRateGrade('SGC 9')).toBe('9');
  });

  it('extracts numeric grade from qualifier label', () => {
    expect(normalizeGemRateGrade('Pristine 10')).toBe('10');
    expect(normalizeGemRateGrade('Gem Mint 9.5')).toBe('9.5');
    expect(normalizeGemRateGrade('Mint 9')).toBe('9');
  });

  it('passes through bare numeric grades', () => {
    expect(normalizeGemRateGrade('10')).toBe('10');
    expect(normalizeGemRateGrade('9.5')).toBe('9.5');
    expect(normalizeGemRateGrade('1')).toBe('1');
  });

  it('returns null for empty or non-numeric strings', () => {
    expect(normalizeGemRateGrade('')).toBeNull();
    expect(normalizeGemRateGrade('N/A')).toBeNull();
    expect(normalizeGemRateGrade('Auth')).toBeNull();
  });

  it('returns null for grades not in UNIVERSAL_GRADE_ORDER', () => {
    expect(normalizeGemRateGrade('11')).toBeNull();
    expect(normalizeGemRateGrade('0.5')).toBeNull();
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

// ─── parseGemRateResponse ───────────────────────────────────────────────────

describe('parseGemRateResponse', () => {
  it('parses grade-keyed object filtered by company', () => {
    const data = {
      PSA: { '10': 50, '9.5': 120, '9': 300 },
      BGS: { '10': 10, '9.5': 30 },
    };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual(expect.arrayContaining([
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
    ]));
    expect(result!.totalGraded).toBe(470);
  });

  it('filters correctly for BGS when multiple companies present', () => {
    const data = {
      PSA: { '10': 50, '9': 300 },
      BGS: { '10': 10, '9.5': 30, '9': 80 },
    };
    const result = parseGemRateResponse(data, 'BGS');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual(expect.arrayContaining([
      { grade: '10', count: 10 },
      { grade: '9.5', count: 30 },
      { grade: '9', count: 80 },
    ]));
    expect(result!.totalGraded).toBe(120);
  });

  it('parses array format', () => {
    const data = [
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
    ];
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual([
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
    ]);
    expect(result!.totalGraded).toBe(470);
  });

  it('parses nested pop structure with company keys', () => {
    const data = {
      pop: {
        PSA: { '10': 5, '9': 20 },
        BGS: { '10': 2, '9': 10 },
      },
    };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual(expect.arrayContaining([
      { grade: '10', count: 5 },
      { grade: '9', count: 20 },
    ]));
    expect(result!.totalGraded).toBe(25);
  });

  it('handles string count values', () => {
    const data = { PSA: { '10': '50', '9': '120' } };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual(expect.arrayContaining([
      { grade: '10', count: 50 },
      { grade: '9', count: 120 },
    ]));
  });

  it('skips zero-count grades', () => {
    const data = { PSA: { '10': 50, '9': 0, '8': 0 } };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual([{ grade: '10', count: 50 }]);
  });

  it('returns null for null/undefined input', () => {
    expect(parseGemRateResponse(null, 'PSA')).toBeNull();
    expect(parseGemRateResponse(undefined, 'PSA')).toBeNull();
  });

  it('parses flat grade object when no company separation exists', () => {
    const data = { '10': 50, '9.5': 120, '9': 300, '8': 500 };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual(expect.arrayContaining([
      { grade: '10', count: 50 },
      { grade: '9.5', count: 120 },
      { grade: '9', count: 300 },
      { grade: '8', count: 500 },
    ]));
    expect(result!.totalGraded).toBe(970);
  });

  it('handles case-insensitive company matching', () => {
    const data = { psa: { '10': 50 } };
    const result = parseGemRateResponse(data, 'PSA');
    expect(result).not.toBeNull();
    expect(result!.gradeBreakdown).toEqual([{ grade: '10', count: 50 }]);
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

// ─── GemRatePopScraper ──────────────────────────────────────────────────────

describe('GemRatePopScraper', () => {
  it('has company set to GemRate', () => {
    const scraper = new GemRatePopScraper();
    expect(scraper.company).toBe('GemRate');
  });

  it('returns null when browserService is not provided', async () => {
    const scraper = new GemRatePopScraper();
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      gradingCompany: 'PSA',
    });
    expect(result).toBeNull();
  });

  it('returns null when browserService is not running', async () => {
    const mockBrowser = { isRunning: () => false } as any;
    const scraper = new GemRatePopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      gradingCompany: 'PSA',
    });
    expect(result).toBeNull();
  });

  it('returns null when no gradingCompany specified', async () => {
    const mockBrowser = { isRunning: () => true } as any;
    const scraper = new GemRatePopScraper(mockBrowser);
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
      waitForResponse: jest.fn().mockResolvedValue(null),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new GemRatePopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      gradingCompany: 'PSA',
    });
    expect(result).toBeNull();
  });

  it('returns PopulationData when API interception succeeds (PSA card)', async () => {
    const apiResponseData = JSON.stringify([{
      description: '2023 Topps Chrome 1 Mike Trout',
      PSA: { '10': 3, '9.5': 20, '9': 50, '8': 200 },
    }]);

    const mockApiResponse = {
      url: () => 'https://gemrate.com/universal-search-query',
      text: jest.fn().mockResolvedValue(apiResponseData),
    };

    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockResolvedValue(mockApiResponse),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new GemRatePopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      gradingCompany: 'PSA',
    });

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('PSA');
    expect(result!.targetGrade).toBe('10');
    expect(result!.targetGradePop).toBe(3);
    expect(result!.totalGraded).toBe(273);
    expect(result!.higherGradePop).toBe(0);
    expect(result!.rarityTier).toBe('ultra-low');
    expect(result!.gradeBreakdown).toHaveLength(4);
  });

  it('returns PopulationData for BGS card', async () => {
    const apiResponseData = JSON.stringify([{
      description: '2023 Topps Chrome 1 Mike Trout',
      PSA: { '10': 50, '9': 300 },
      BGS: { '10': 5, '9.5': 15, '9': 40 },
    }]);

    const mockApiResponse = {
      url: () => 'https://gemrate.com/universal-search-query',
      text: jest.fn().mockResolvedValue(apiResponseData),
    };

    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockResolvedValue(undefined),
      type: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockResolvedValue(mockApiResponse),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new GemRatePopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '9.5',
      gradingCompany: 'BGS',
    });

    expect(result).not.toBeNull();
    expect(result!.gradingCompany).toBe('BGS');
    expect(result!.targetGrade).toBe('9.5');
    expect(result!.targetGradePop).toBe(15);
    expect(result!.totalGraded).toBe(60);
    expect(result!.higherGradePop).toBe(5);
  });

  it('returns null and cleans up page on error', async () => {
    const mockPage = {
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      focus: jest.fn().mockRejectedValue(new Error('Navigation failed')),
      type: jest.fn().mockResolvedValue(undefined),
      waitForResponse: jest.fn().mockResolvedValue(null),
      evaluate: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const mockBrowser = {
      isRunning: () => true,
      navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    } as any;

    const scraper = new GemRatePopScraper(mockBrowser);
    const result = await scraper.fetchPopulation({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      gradingCompany: 'PSA',
    });
    expect(result).toBeNull();
    expect(mockPage.close).toHaveBeenCalled();
  });
});
