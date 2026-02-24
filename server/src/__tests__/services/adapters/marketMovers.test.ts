import MarketMoversAdapter, {
  buildSearchQuery,
  buildCollectiblesSearchInput,
  buildRawSalesSearchInput,
  scoreCollectibleMatch,
  getTokenExpiry,
  _resetTokenCache,
} from '../../../services/adapters/marketMovers';
import { CompRequest, CompResult } from '../../../types';

// ─── Mock Helpers ───────────────────────────────────────────────────────────

function createMockCacheService() {
  return {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    buildCacheKey: jest.fn().mockReturnValue('test-key'),
    purgeExpired: jest.fn().mockReturnValue(0),
  };
}

function createMockBrowserService(overrides: Record<string, unknown> = {}) {
  const mockPage = {
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    waitForFunction: jest.fn().mockResolvedValue(undefined),
    evaluate: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const browserService = {
    isRunning: jest.fn().mockReturnValue(true),
    navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    throttle: jest.fn().mockResolvedValue(undefined),
    newPage: jest.fn().mockResolvedValue(mockPage),
    launch: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { browserService, mockPage };
}

// Create a valid JWT with a future expiry
function createMockJwt(expiresInSeconds = 3600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: '12345',
    email: 'test@example.com',
    pro: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  })).toString('base64url');
  return `${header}.${payload}.fakesignature`;
}

function createMockCollectibleItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1234,
    searchTitle: '2023 Topps Chrome Mike Trout #1 Base Raw Baseball',
    collectibleType: 'sports-card',
    imageUrl: null,
    stats: {
      last30: {
        avgPrice: 55.5,
        maxPrice: 70,
        minPrice: 40,
        totalSalesCount: 15,
        endAvgPrice: 58,
        priceChangePercentage: 5,
      },
      last90: {
        avgPrice: 52,
        maxPrice: 75,
        minPrice: 35,
        totalSalesCount: 45,
        endAvgPrice: 54,
        priceChangePercentage: 3,
      },
    },
    player: { id: 112, name: 'Mike Trout' },
    set: { id: 100, name: 'Topps Chrome', year: '2023' },
    grade: null,
    cardNumber: '1',
    isRookie: false,
    setVariation: null,
    ...overrides,
  };
}

function createMockRawSaleItem(overrides: Record<string, unknown> = {}) {
  return {
    displayTitle: '2023 Topps Chrome Mike Trout #1 Base',
    finalPrice: 55,
    saleDate: '2026-02-20T06:00:00Z',
    seller: { name: 'eBay' },
    saleUrl: 'https://ebay.com/itm/123',
    imageUrls: [],
    listingType: 'Auction',
    isBestOfferAccepted: false,
    offerPrice: null,
    ...overrides,
  };
}

const sampleRequest: CompRequest = {
  cardId: 'card-1',
  player: 'Mike Trout',
  year: 2023,
  brand: 'Topps',
  cardNumber: '1',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MarketMoversAdapter', () => {
  const originalEnv = process.env;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    _resetTokenCache();
    process.env = {
      ...originalEnv,
      MARKETMOVERS_EMAIL: 'test@example.com',
      MARKETMOVERS_PASSWORD: 'testpass',
    };
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { data: { items: [], totalCount: 0 } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchSpy.mockRestore();
  });

  it('source is MarketMovers', () => {
    const adapter = new MarketMoversAdapter();
    expect(adapter.source).toBe('MarketMovers');
  });

  // ─── Credential Checks ─────────────────────────────────────────────────

  it('returns error when MARKETMOVERS_EMAIL not set', async () => {
    delete process.env.MARKETMOVERS_EMAIL;
    const { browserService } = createMockBrowserService();
    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('credentials not configured');
    expect(result.marketValue).toBeNull();
  });

  it('returns error when MARKETMOVERS_PASSWORD not set', async () => {
    delete process.env.MARKETMOVERS_PASSWORD;
    const { browserService } = createMockBrowserService();
    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('credentials not configured');
  });

  // ─── Puppeteer Requirement ──────────────────────────────────────────────

  it('returns error when no browserService provided', async () => {
    const adapter = new MarketMoversAdapter();
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer');
  });

  it('returns error when browserService is not running', async () => {
    const { browserService } = createMockBrowserService({
      isRunning: jest.fn().mockReturnValue(false),
    });
    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer disabled');
  });

  // ─── Cache ──────────────────────────────────────────────────────────────

  it('returns cache hit without making API calls', async () => {
    const cacheService = createMockCacheService();
    const cachedResult: CompResult = {
      source: 'MarketMovers',
      marketValue: 48,
      sales: [],
      averagePrice: 48,
      low: 40,
      high: 56,
    };
    cacheService.get.mockReturnValue(cachedResult);

    const adapter = new MarketMoversAdapter(undefined, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result).toBe(cachedResult);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('caches successful results', async () => {
    const cacheService = createMockCacheService();
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();

    mockPage.evaluate
      .mockResolvedValueOnce(token)   // mm_token
      .mockResolvedValueOnce('rt');   // mm_rt

    // Collectibles search returns a match
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { items: [{ item: createMockCollectibleItem(), score: 1 }] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      // Raw sales returns results
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 1, items: [createMockRawSaleItem()] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(cacheService.set).toHaveBeenCalledWith('MarketMovers', sampleRequest, result);
  });

  // ─── Authentication ─────────────────────────────────────────────────────

  it('returns error when Puppeteer auth fails', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    // mm_token returns null (auth failed)
    mockPage.evaluate.mockResolvedValue(null);

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('authentication failed');
  });

  it('uses cached token without re-authenticating', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();

    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    fetchSpy.mockResolvedValue(new Response(JSON.stringify({
      result: { data: { items: [{ item: createMockCollectibleItem(), score: 1 }], totalCount: 1 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);

    // First call authenticates via Puppeteer
    await adapter.fetchComps(sampleRequest);
    expect(browserService.navigateWithThrottle).toHaveBeenCalledTimes(1);

    // Second call should use cached token
    await adapter.fetchComps(sampleRequest);
    expect(browserService.navigateWithThrottle).toHaveBeenCalledTimes(1); // Not called again
  });

  // ─── Data Fetching ────────────────────────────────────────────────────

  it('returns market value from collectibles search', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { items: [{ item: createMockCollectibleItem(), score: 1 }] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 0, items: [] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.marketValue).toBe(58); // endAvgPrice from last30
    expect(result.averagePrice).toBe(58); // Falls back to marketValue
    expect(result.error).toBeUndefined();
  });

  it('returns sales from raw sales search', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    const sales = [
      createMockRawSaleItem({ finalPrice: 50, saleDate: '2026-02-20T06:00:00Z' }),
      createMockRawSaleItem({ finalPrice: 60, saleDate: '2026-02-19T06:00:00Z' }),
      createMockRawSaleItem({ finalPrice: 45, saleDate: '2026-02-18T06:00:00Z' }),
    ];

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { items: [] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 3, items: sales } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.sales).toHaveLength(3);
    expect(result.sales[0].price).toBe(50);
    expect(result.sales[0].date).toBe('2026-02-20');
    expect(result.sales[0].venue).toBe('eBay');
    expect(result.averagePrice).toBeCloseTo(51.67, 1);
    expect(result.low).toBe(45);
    expect(result.high).toBe(60);
  });

  it('uses offerPrice when best offer was accepted', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    const sale = createMockRawSaleItem({
      finalPrice: 100,
      isBestOfferAccepted: true,
      offerPrice: 75,
    });

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { items: [] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 1, items: [sale] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.sales[0].price).toBe(75); // offerPrice, not finalPrice
  });

  it('filters sales by player relevance', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    const sales = [
      createMockRawSaleItem({ displayTitle: '2023 Topps Chrome Mike Trout #1', finalPrice: 50 }),
      createMockRawSaleItem({ displayTitle: '2023 Topps Chrome Mike Trout #1 Refractor', finalPrice: 80 }),
      createMockRawSaleItem({ displayTitle: '2023 Topps Chrome Mike Trout #1 Gold', finalPrice: 120 }),
      createMockRawSaleItem({ displayTitle: '2023 Topps Chrome Random Player #5', finalPrice: 5 }),
    ];

    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { items: [] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 4, items: sales } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    // Should filter out "Random Player" since 3+ relevant results exist
    expect(result.sales).toHaveLength(3);
    expect(result.sales.every(s => s.price !== 5)).toBe(true);
  });

  it('returns error when both endpoints return no data', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    fetchSpy.mockResolvedValue(new Response(JSON.stringify({
      result: { data: { items: [], totalCount: 0 } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No Market Movers data found');
  });

  it('returns partial data when one endpoint fails', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    const token = createMockJwt();
    mockPage.evaluate
      .mockResolvedValueOnce(token)
      .mockResolvedValueOnce('rt');

    // Collectibles search fails, raw sales succeeds
    fetchSpy
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { data: { totalCount: 1, items: [createMockRawSaleItem()] } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const adapter = new MarketMoversAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBeNull(); // Collectibles failed
    expect(result.sales).toHaveLength(1); // Raw sales succeeded
  });
});

// ─── Exported Helper Tests ──────────────────────────────────────────────────

describe('buildSearchQuery', () => {
  it('builds basic query', () => {
    expect(buildSearchQuery(sampleRequest)).toBe('2023 Topps Mike Trout #1');
  });

  it('includes setName when present', () => {
    expect(buildSearchQuery({ ...sampleRequest, setName: 'Chrome' }))
      .toBe('2023 Topps Chrome Mike Trout #1');
  });

  it('includes parallel when present', () => {
    expect(buildSearchQuery({ ...sampleRequest, parallel: 'Refractor' }))
      .toBe('2023 Topps Mike Trout #1 Refractor');
  });

  it('includes grading info when graded', () => {
    expect(buildSearchQuery({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    })).toBe('2023 Topps Mike Trout #1 PSA 10');
  });

  it('includes all fields together', () => {
    expect(buildSearchQuery({
      ...sampleRequest,
      setName: 'Chrome',
      parallel: 'Gold',
      isGraded: true,
      gradingCompany: 'BGS',
      grade: '9.5',
    })).toBe('2023 Topps Chrome Mike Trout #1 Gold BGS 9.5');
  });
});

describe('scoreCollectibleMatch', () => {
  const baseItem = createMockCollectibleItem() as any;

  it('returns -1 when year does not match', () => {
    const item = { ...baseItem, set: { ...baseItem.set, year: '2022' } };
    expect(scoreCollectibleMatch(item, sampleRequest)).toBe(-1);
  });

  it('returns -1 when player does not match', () => {
    const item = { ...baseItem, player: { id: 1, name: 'Shohei Ohtani' } };
    expect(scoreCollectibleMatch(item, sampleRequest)).toBe(-1);
  });

  it('scores card number match highly', () => {
    const score = scoreCollectibleMatch(baseItem, sampleRequest);
    expect(score).toBeGreaterThanOrEqual(30); // player(10) + cardNumber(20)
  });

  it('scores set name match', () => {
    const reqWithSet = { ...sampleRequest, setName: 'Chrome' };
    const score = scoreCollectibleMatch(baseItem, reqWithSet);
    expect(score).toBeGreaterThan(scoreCollectibleMatch(baseItem, sampleRequest));
  });

  it('scores grade match for graded cards', () => {
    const gradedItem = {
      ...baseItem,
      grade: { id: 1, name: 'PSA 10' },
    };
    const gradedReq = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    };
    const score = scoreCollectibleMatch(gradedItem, gradedReq);
    // player(10) + cardNumber(20) + brand(5) + grade(15) = 50+
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('prefers ungraded when request is raw', () => {
    const rawScore = scoreCollectibleMatch(baseItem, sampleRequest);
    const gradedItem = { ...baseItem, grade: { id: 1, name: 'PSA 10' } };
    const gradedScore = scoreCollectibleMatch(gradedItem, sampleRequest);
    expect(rawScore).toBeGreaterThan(gradedScore);
  });

  it('adds rookie bonus', () => {
    const rookieItem = { ...baseItem, isRookie: true };
    const rookieReq = { ...sampleRequest, isRookie: true };
    const normalScore = scoreCollectibleMatch(baseItem, sampleRequest);
    const rookieScore = scoreCollectibleMatch(rookieItem, rookieReq);
    expect(rookieScore).toBe(normalScore + 3);
  });
});

describe('getTokenExpiry', () => {
  it('extracts expiry from valid JWT', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockJwt(3600);
    const expiry = getTokenExpiry(token);
    // Should be within a second of expected
    expect(Math.abs(expiry - futureExp * 1000)).toBeLessThan(2000);
  });

  it('returns 0 for invalid token', () => {
    expect(getTokenExpiry('not.a.jwt')).toBe(0);
    expect(getTokenExpiry('')).toBe(0);
  });
});

describe('buildCollectiblesSearchInput', () => {
  it('includes card details in search text', () => {
    const input = buildCollectiblesSearchInput(sampleRequest) as any;
    expect(input.titleSearchQueryText).toContain('2023');
    expect(input.titleSearchQueryText).toContain('Topps');
    expect(input.titleSearchQueryText).toContain('Mike Trout');
    expect(input.collectibleType).toBe('sports-card');
    expect(input.limit).toBe(20);
  });
});

describe('buildRawSalesSearchInput', () => {
  it('builds search with exclusion terms', () => {
    const input = buildRawSalesSearchInput(sampleRequest) as any;
    expect(input.titleSearchQueryText).toContain('Mike Trout');
    expect(input.titleSearchQuery.excludeTerms).toContain('lot');
    expect(input.titleSearchQuery.excludeTerms).toContain('reprint');
    expect(input.sort[0].sortBy).toBe('saleDate');
    expect(input.limit).toBe(20);
  });
});
