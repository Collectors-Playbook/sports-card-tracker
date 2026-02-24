import PsaAdapter, { buildSearchQuery, buildSearchUrl, filterByRelevance, computeTrimmedMean, mapCategory } from '../../../services/adapters/psa';
import { CompRequest, CompResult } from '../../../types';

function createMockBrowserService(options: {
  searchResults?: string | null;
  salesData?: { price: number; date: string; grade: string; auctionHouse: string }[];
} = {}) {
  const { searchResults = 'https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123', salesData = [] } = options;

  const searchPage = {
    $$eval: jest.fn().mockResolvedValue(searchResults ? [searchResults] : []),
    $eval: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const detailPage = {
    $$eval: jest.fn().mockResolvedValue(salesData),
    $eval: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  // navigateWithThrottle returns searchPage first, then detailPage
  let callCount = 0;
  const browserService = {
    isRunning: jest.fn().mockReturnValue(true),
    navigateWithThrottle: jest.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? Promise.resolve(searchPage) : Promise.resolve(detailPage);
    }),
    throttle: jest.fn().mockResolvedValue(undefined),
    newPage: jest.fn().mockResolvedValue(searchPage),
    launch: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };

  // Override searchPage $$eval to return the detail URL (simulating link extraction)
  searchPage.$$eval.mockResolvedValue(searchResults);

  return { browserService, searchPage, detailPage };
}

function createMockCacheService() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    buildCacheKey: jest.fn().mockReturnValue('test-key'),
    purgeExpired: jest.fn().mockReturnValue(0),
  };
}

const sampleRequest: CompRequest = {
  cardId: 'card-1',
  player: 'Mike Trout',
  year: 2023,
  brand: 'Topps',
  cardNumber: '1',
  condition: 'RAW',
};

describe('PsaAdapter', () => {
  it('returns stub error when no browser service', async () => {
    const adapter = new PsaAdapter();
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer disabled');
    expect(result.sales).toEqual([]);
  });

  it('returns stub error when browser not running', async () => {
    const { browserService } = createMockBrowserService();
    browserService.isRunning.mockReturnValue(false);
    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer disabled');
  });

  it('returns cache hit without scraping', async () => {
    const { browserService } = createMockBrowserService();
    const cacheService = createMockCacheService();
    const cachedResult: CompResult = {
      source: 'PSA',
      marketValue: 100,
      sales: [{ date: '2026-01-15', price: 100, grade: '10', venue: 'eBay' }],
      averagePrice: 100,
      low: 100,
      high: 100,
    };
    cacheService.get.mockReturnValue(cachedResult);

    const adapter = new PsaAdapter(browserService as any, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result).toBe(cachedResult);
    expect(browserService.navigateWithThrottle).not.toHaveBeenCalled();
  });

  it('extracts auction results successfully with two-step navigation', async () => {
    const salesData = [
      { price: 150, date: '01/15/2026', grade: '10', auctionHouse: 'eBay' },
      { price: 120, date: '01/10/2026', grade: '10', auctionHouse: 'Goldin' },
      { price: 135, date: '01/05/2026', grade: '10', auctionHouse: 'Heritage' },
    ];

    const { browserService, searchPage, detailPage } = createMockBrowserService({ salesData });
    // searchPage $$eval returns a detail URL
    searchPage.$$eval.mockResolvedValue('https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123');
    // detailPage $$eval returns sales data
    detailPage.$$eval.mockResolvedValue(salesData);

    const cacheService = createMockCacheService();
    const adapter = new PsaAdapter(browserService as any, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.sales).toHaveLength(3);
    expect(result.averagePrice).toBeCloseTo(135, 0);
    expect(result.low).toBe(120);
    expect(result.high).toBe(150);
    expect(cacheService.set).toHaveBeenCalled();
    // Both pages navigated
    expect(browserService.navigateWithThrottle).toHaveBeenCalledTimes(2);
    // Both pages closed
    expect(searchPage.close).toHaveBeenCalled();
    expect(detailPage.close).toHaveBeenCalled();
  });

  it('returns error when no search results found', async () => {
    const { browserService, searchPage } = createMockBrowserService();
    // No detail URL found
    searchPage.$$eval.mockResolvedValue(null);

    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No PSA auction results found');
    expect(result.sales).toEqual([]);
  });

  it('returns error when no sales on detail page', async () => {
    const { browserService, searchPage, detailPage } = createMockBrowserService();
    searchPage.$$eval.mockResolvedValue('https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123');
    detailPage.$$eval.mockResolvedValue([]);

    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No PSA sales data found');
    expect(result.sales).toEqual([]);
  });

  it('handles scraping errors gracefully', async () => {
    const { browserService } = createMockBrowserService();
    browserService.navigateWithThrottle.mockRejectedValue(new Error('Page closed'));

    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('PSA scraping failed');
    expect(result.error).toContain('Page closed');
  });

  it('filters to matching PSA grade only for PSA-graded cards', async () => {
    const salesData = [
      { price: 500, date: '01/15/2026', grade: '10', auctionHouse: 'eBay' },
      { price: 480, date: '01/10/2026', grade: '10', auctionHouse: 'Goldin' },
      { price: 50, date: '01/05/2026', grade: '8', auctionHouse: 'eBay' },
      { price: 30, date: '01/01/2026', grade: '7', auctionHouse: 'Heritage' },
    ];

    const { browserService, searchPage, detailPage } = createMockBrowserService();
    searchPage.$$eval.mockResolvedValue('https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123');
    detailPage.$$eval.mockResolvedValue(salesData);

    const gradedRequest: CompRequest = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    };

    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(gradedRequest);

    expect(result.error).toBeUndefined();
    // Should only include grade 10 sales
    expect(result.sales).toHaveLength(2);
    expect(result.sales!.every(s => s.grade === '10')).toBe(true);
    expect(result.low).toBe(480);
    expect(result.high).toBe(500);
  });

  it('returns all grades for ungraded cards', async () => {
    const salesData = [
      { price: 500, date: '01/15/2026', grade: '10', auctionHouse: 'eBay' },
      { price: 50, date: '01/05/2026', grade: '8', auctionHouse: 'eBay' },
      { price: 30, date: '01/01/2026', grade: '7', auctionHouse: 'Heritage' },
    ];

    const { browserService, searchPage, detailPage } = createMockBrowserService();
    searchPage.$$eval.mockResolvedValue('https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123');
    detailPage.$$eval.mockResolvedValue(salesData);

    // Not graded — should return all grades
    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.sales).toHaveLength(3);
  });

  it('returns all grades for non-PSA graded cards', async () => {
    const salesData = [
      { price: 500, date: '01/15/2026', grade: '10', auctionHouse: 'eBay' },
      { price: 50, date: '01/05/2026', grade: '8', auctionHouse: 'eBay' },
    ];

    const { browserService, searchPage, detailPage } = createMockBrowserService();
    searchPage.$$eval.mockResolvedValue('https://www.psacard.com/auctionprices/baseball-cards/2023-topps/mike-trout/values/123');
    detailPage.$$eval.mockResolvedValue(salesData);

    const bgsRequest: CompRequest = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'BGS',
      grade: '9.5',
    };

    const adapter = new PsaAdapter(browserService as any);
    const result = await adapter.fetchComps(bgsRequest);

    expect(result.error).toBeUndefined();
    // BGS card — PSA adapter returns all grades since it's not PSA-graded
    expect(result.sales).toHaveLength(2);
  });

  it('source is PSA', () => {
    const adapter = new PsaAdapter();
    expect(adapter.source).toBe('PSA');
  });
});

describe('buildSearchQuery', () => {
  it('builds basic query from required fields', () => {
    const query = buildSearchQuery(sampleRequest);
    expect(query).toBe('2023 Topps Mike Trout #1');
  });

  it('includes setName when provided', () => {
    const query = buildSearchQuery({ ...sampleRequest, setName: 'Chrome' });
    expect(query).toBe('2023 Topps Chrome Mike Trout #1');
  });

  it('includes parallel when provided', () => {
    const query = buildSearchQuery({ ...sampleRequest, parallel: 'Refractor' });
    expect(query).toBe('2023 Topps Mike Trout #1 Refractor');
  });

  it('does not include grading info (PSA search is card-level)', () => {
    const query = buildSearchQuery({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    });
    // PSA search doesn't include grading info — grade filtering happens on results
    expect(query).toBe('2023 Topps Mike Trout #1');
  });
});

describe('buildSearchUrl', () => {
  it('builds correct URL with query parameter', () => {
    const url = buildSearchUrl('2023 Topps Mike Trout #1');
    expect(url).toBe('https://www.psacard.com/auctionprices?q=2023+Topps+Mike+Trout+%231');
  });

  it('encodes special characters', () => {
    const url = buildSearchUrl('2023 Topps Chrome Mike Trout #1 Refractor');
    expect(url).toContain('https://www.psacard.com/auctionprices?q=');
    expect(url).toContain('Topps');
    expect(url).toContain('Trout');
  });
});

describe('filterByRelevance', () => {
  const sales = [
    { price: 150, date: '01/15/2026', grade: '10', auctionHouse: 'eBay' },
    { price: 120, date: '01/10/2026', grade: '10', auctionHouse: 'Goldin' },
    { price: 500, date: '01/03/2026', grade: '10', auctionHouse: 'Heritage' },
  ];

  it('returns all sales (PSA detail pages are card-specific)', () => {
    const result = filterByRelevance(sales, sampleRequest);
    expect(result).toHaveLength(3);
  });

  it('handles empty player name gracefully', () => {
    const result = filterByRelevance(sales, { ...sampleRequest, player: '' });
    expect(result).toHaveLength(3);
  });
});

describe('mapCategory', () => {
  it('maps baseball correctly', () => {
    expect(mapCategory('Baseball')).toBe('baseball-cards');
  });

  it('maps basketball correctly', () => {
    expect(mapCategory('Basketball')).toBe('basketball-cards');
  });

  it('maps football correctly', () => {
    expect(mapCategory('Football')).toBe('football-cards');
  });

  it('maps hockey correctly', () => {
    expect(mapCategory('Hockey')).toBe('hockey-cards');
  });

  it('maps soccer correctly', () => {
    expect(mapCategory('Soccer')).toBe('soccer-cards');
  });

  it('maps pokemon correctly', () => {
    expect(mapCategory('Pokemon')).toBe('tcg-cards');
  });

  it('maps other/unknown to non-sports-cards', () => {
    expect(mapCategory('Other')).toBe('non-sports-cards');
    expect(mapCategory('random')).toBe('non-sports-cards');
  });

  it('is case insensitive', () => {
    expect(mapCategory('BASEBALL')).toBe('baseball-cards');
    expect(mapCategory('basketball')).toBe('basketball-cards');
    expect(mapCategory('POKEMON')).toBe('tcg-cards');
  });
});

describe('computeTrimmedMean', () => {
  it('returns 0 for empty array', () => {
    expect(computeTrimmedMean([])).toBe(0);
  });

  it('returns simple average for fewer than 5 prices', () => {
    expect(computeTrimmedMean([100, 200, 300])).toBeCloseTo(200, 5);
  });

  it('returns simple average for exactly 4 prices', () => {
    expect(computeTrimmedMean([10, 20, 30, 40])).toBeCloseTo(25, 5);
  });

  it('trims top and bottom 15% for 5+ prices', () => {
    // 10 prices: trim 1 from each end (floor(10 * 0.15) = 1)
    const prices = [1, 10, 20, 30, 40, 50, 60, 70, 80, 1000];
    // After trimming: [10, 20, 30, 40, 50, 60, 70, 80] => avg = 45
    expect(computeTrimmedMean(prices)).toBeCloseTo(45, 5);
  });

  it('removes outliers effectively', () => {
    const prices = [100, 110, 120, 130, 140, 5000];
    // Sorted: [100, 110, 120, 130, 140, 5000], trim 1 from each end
    // Trimmed: [110, 120, 130, 140] => avg = 125
    const result = computeTrimmedMean(prices);
    expect(result).toBeCloseTo(125, 5);
    expect(result).toBeLessThan(200);
  });

  it('returns single value for array of 1', () => {
    expect(computeTrimmedMean([42])).toBe(42);
  });
});
