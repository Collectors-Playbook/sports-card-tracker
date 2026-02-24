import SportsCardsProAdapter, { buildSearchQuery, pickPrice } from '../../../services/adapters/sportsCardsPro';
import { CompRequest, CompResult } from '../../../types';

function createMockBrowserService() {
  const mockPage = {
    $$eval: jest.fn().mockResolvedValue([]),
    $eval: jest.fn().mockResolvedValue(null),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const browserService = {
    isRunning: jest.fn().mockReturnValue(true),
    navigateWithThrottle: jest.fn().mockResolvedValue(mockPage),
    throttle: jest.fn().mockResolvedValue(undefined),
    newPage: jest.fn().mockResolvedValue(mockPage),
    launch: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  };

  return { browserService, mockPage };
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

// ─── API mode ────────────────────────────────────────────────────────────────

describe('SportsCardsProAdapter — API mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, PRICECHARTING_API_TOKEN: 'test-token-123' };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns market value from API for a raw card (uses loose-price)', async () => {
    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345', 'product-name': '2023 Topps Mike Trout #1' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: '12345',
        'product-name': '2023 Topps Mike Trout #1',
        'loose-price': 5500,     // $55.00
        'graded-price': 12000,   // $120.00
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('SportsCardsPro');
    expect(result.marketValue).toBe(55.00);
    expect(result.averagePrice).toBe(55.00);
    expect(result.sales).toEqual([]);
    expect(result.low).toBeNull();
    expect(result.high).toBeNull();

    // Verify correct API URLs were called
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const searchCall = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(searchCall).toContain('pricecharting.com/api/products');
    expect(searchCall).toContain('t=test-token-123');
    const detailCall = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(detailCall).toContain('pricecharting.com/api/product?id=12345');
  });

  it('returns graded price for a PSA 10 card', async () => {
    const gradedRequest: CompRequest = {
      ...sampleRequest,
      condition: 'Graded',
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    };

    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        'loose-price': 5500,
        'graded-price': 12000,
        'condition-18-price': 25000,  // PSA 10 = $250.00
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(gradedRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBe(250.00);
    expect(result.averagePrice).toBe(250.00);
  });

  it('returns BGS 10 price for a BGS 10 card', async () => {
    const gradedRequest: CompRequest = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'BGS',
      grade: '10',
    };

    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        'loose-price': 5500,
        'graded-price': 12000,
        'bgs-10-price': 30000,  // $300.00
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(gradedRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBe(300.00);
  });

  it('falls back to graded-price when specific grade price is missing', async () => {
    const gradedRequest: CompRequest = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    };

    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        'loose-price': 5500,
        'graded-price': 12000,
        // No condition-18-price
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(gradedRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBe(120.00); // graded-price fallback
  });

  it('returns error when no API search results found', async () => {
    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ products: [] }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No PriceCharting results found');
    expect(result.marketValue).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles API search HTTP errors gracefully', async () => {
    const errorResponse = {
      ok: false,
      status: 403,
      json: jest.fn(),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(errorResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('PriceCharting API search failed: HTTP 403');
    expect(result.marketValue).toBeNull();
  });

  it('handles API detail HTTP errors gracefully', async () => {
    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailError = {
      ok: false,
      status: 500,
      json: jest.fn(),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailError as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('PriceCharting API detail failed: HTTP 500');
  });

  it('handles network errors gracefully', async () => {
    jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network timeout'));

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('PriceCharting API error: Network timeout');
    expect(result.marketValue).toBeNull();
  });

  it('caches successful API result', async () => {
    const cacheService = createMockCacheService();

    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        'loose-price': 5500,
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter(undefined, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.marketValue).toBe(55.00);
    expect(cacheService.set).toHaveBeenCalledWith(
      'SportsCardsPro',
      sampleRequest,
      expect.objectContaining({ marketValue: 55.00 })
    );
  });

  it('returns cached result without calling API', async () => {
    const cacheService = createMockCacheService();
    const cachedResult: CompResult = {
      source: 'SportsCardsPro',
      marketValue: 60,
      sales: [],
      averagePrice: 60,
      low: null,
      high: null,
    };
    cacheService.get.mockReturnValue(cachedResult);

    const fetchSpy = jest.spyOn(global, 'fetch');

    const adapter = new SportsCardsProAdapter(undefined, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result).toBe(cachedResult);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null marketValue when product has no prices', async () => {
    const searchResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        products: [{ id: '12345' }],
      }),
    };
    const detailResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: '12345',
        'loose-price': 0,
      }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(searchResponse as unknown as Response)
      .mockResolvedValueOnce(detailResponse as unknown as Response);

    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBeNull();
    expect(result.averagePrice).toBeNull();
  });
});

// ─── Puppeteer mode ──────────────────────────────────────────────────────────

describe('SportsCardsProAdapter — Puppeteer mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Remove API token so Puppeteer path is used
    process.env = { ...originalEnv };
    delete process.env.PRICECHARTING_API_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('falls back to Puppeteer when no API token is set', async () => {
    const { browserService, mockPage } = createMockBrowserService();
    // Search page returns no results
    mockPage.$eval.mockRejectedValue(new Error('No element'));
    browserService.navigateWithThrottle.mockResolvedValueOnce(mockPage);

    const adapter = new SportsCardsProAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No SportsCardsPro results found');
    expect(browserService.navigateWithThrottle).toHaveBeenCalled();
  });

  it('returns stub error when no browser service', async () => {
    const adapter = new SportsCardsProAdapter();
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer disabled');
    expect(result.sales).toEqual([]);
  });

  it('returns stub error when browser not running', async () => {
    const { browserService } = createMockBrowserService();
    browserService.isRunning.mockReturnValue(false);
    const adapter = new SportsCardsProAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);
    expect(result.error).toContain('Puppeteer disabled');
  });

  it('returns cache hit without scraping', async () => {
    const { browserService } = createMockBrowserService();
    const cacheService = createMockCacheService();
    const cachedResult: CompResult = {
      source: 'SportsCardsPro',
      marketValue: 60,
      sales: [],
      averagePrice: 60,
      low: 55,
      high: 65,
    };
    cacheService.get.mockReturnValue(cachedResult);

    const adapter = new SportsCardsProAdapter(browserService as any, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result).toBe(cachedResult);
    expect(browserService.navigateWithThrottle).not.toHaveBeenCalled();
  });

  it('extracts market value and sales from detail page', async () => {
    const { browserService } = createMockBrowserService();
    const cacheService = createMockCacheService();

    // First call: search page — $eval returns detail URL
    const searchPage = {
      $eval: jest.fn().mockResolvedValue('https://www.sportscardspro.com/game/card/123'),
      close: jest.fn().mockResolvedValue(undefined),
    };
    // Second call: detail page
    const detailPage = {
      $eval: jest.fn().mockResolvedValue(55.00),
      $$eval: jest.fn().mockResolvedValue([
        { price: 52, date: 'Jan 15, 2026' },
        { price: 58, date: 'Jan 10, 2026' },
      ]),
      close: jest.fn().mockResolvedValue(undefined),
    };

    browserService.navigateWithThrottle
      .mockResolvedValueOnce(searchPage)
      .mockResolvedValueOnce(detailPage);

    const adapter = new SportsCardsProAdapter(browserService as any, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.marketValue).toBe(55.00);
    expect(result.sales).toHaveLength(2);
    expect(result.averagePrice).toBe(55.00);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('returns error when no search results found', async () => {
    const { browserService } = createMockBrowserService();
    const searchPage = {
      $eval: jest.fn().mockRejectedValue(new Error('No element')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    browserService.navigateWithThrottle.mockResolvedValueOnce(searchPage);

    const adapter = new SportsCardsProAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No SportsCardsPro results found');
  });

  it('handles scraping errors gracefully', async () => {
    const { browserService } = createMockBrowserService();
    browserService.navigateWithThrottle.mockRejectedValue(new Error('Connection refused'));

    const adapter = new SportsCardsProAdapter(browserService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('SportsCardsPro scraping failed');
    expect(result.error).toContain('Connection refused');
  });

  it('source is SportsCardsPro', () => {
    const adapter = new SportsCardsProAdapter();
    expect(adapter.source).toBe('SportsCardsPro');
  });
});

// ─── pickPrice ───────────────────────────────────────────────────────────────

describe('pickPrice', () => {
  it('returns loose-price for raw card', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000 };
    const result = pickPrice(product, sampleRequest);
    expect(result).toBe(55.00);
  });

  it('returns condition-18-price for PSA 10', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000, 'condition-18-price': 25000 };
    const request: CompRequest = { ...sampleRequest, isGraded: true, gradingCompany: 'PSA', grade: '10' };
    expect(pickPrice(product, request)).toBe(250.00);
  });

  it('returns condition-17-price for PSA 9', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000, 'condition-17-price': 18000 };
    const request: CompRequest = { ...sampleRequest, isGraded: true, gradingCompany: 'PSA', grade: '9' };
    expect(pickPrice(product, request)).toBe(180.00);
  });

  it('returns bgs-10-price for BGS 10', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000, 'bgs-10-price': 30000 };
    const request: CompRequest = { ...sampleRequest, isGraded: true, gradingCompany: 'BGS', grade: '10' };
    expect(pickPrice(product, request)).toBe(300.00);
  });

  it('falls back to graded-price when specific grade price is 0', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000, 'condition-18-price': 0 };
    const request: CompRequest = { ...sampleRequest, isGraded: true, gradingCompany: 'PSA', grade: '10' };
    expect(pickPrice(product, request)).toBe(120.00);
  });

  it('falls back to graded-price when specific grade price is missing', () => {
    const product = { 'loose-price': 5500, 'graded-price': 12000 };
    const request: CompRequest = { ...sampleRequest, isGraded: true, gradingCompany: 'SGC', grade: '10' };
    expect(pickPrice(product, request)).toBe(120.00);
  });

  it('returns null when no prices available', () => {
    const product = { 'loose-price': 0 };
    expect(pickPrice(product, sampleRequest)).toBeNull();
  });
});

// ─── buildSearchQuery ────────────────────────────────────────────────────────

describe('buildSearchQuery', () => {
  it('builds basic query from required fields', () => {
    const query = buildSearchQuery(sampleRequest);
    expect(query).toBe('2023 Topps Mike Trout 1');
  });

  it('includes setName when provided', () => {
    const query = buildSearchQuery({ ...sampleRequest, setName: 'Chrome' });
    expect(query).toBe('2023 Topps Chrome Mike Trout 1');
  });

  it('includes parallel when provided', () => {
    const query = buildSearchQuery({ ...sampleRequest, parallel: 'Refractor' });
    expect(query).toBe('2023 Topps Mike Trout 1 Refractor');
  });

  it('includes both setName and parallel', () => {
    const query = buildSearchQuery({
      ...sampleRequest,
      setName: 'Chrome',
      parallel: 'Gold Refractor',
    });
    expect(query).toBe('2023 Topps Chrome Mike Trout 1 Gold Refractor');
  });

  it('does not include grading info (SportsCardsPro does not support it)', () => {
    const query = buildSearchQuery({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    });
    // No PSA 10 in the query
    expect(query).toBe('2023 Topps Mike Trout 1');
  });
});
