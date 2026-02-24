import fs from 'fs';
import path from 'path';
import os from 'os';
import FileService from '../../services/fileService';
import CompService, {
  normalizeDate,
  recencyWeight,
  deduplicateSales,
  computeWeightedTrimmedMean,
  computeFallbackFromMarketValues,
  NormalizedSale,
} from '../../services/compService';
import Database from '../../database';
import { CompAdapter, CompRequest, CompResult, CompSource } from '../../types';
import { _resetRateLimitState as resetOneThirtyPointRateLimit } from '../../services/adapters/oneThirtyPoint';

function createMockAdapter(source: string, result: Partial<CompResult> = {}): CompAdapter {
  return {
    source: source as CompResult['source'],
    fetchComps: async () => ({
      source: source as CompResult['source'],
      marketValue: null,
      sales: [],
      averagePrice: null,
      low: null,
      high: null,
      ...result,
    }),
  };
}

function createThrowingAdapter(source: string, errorMessage: string): CompAdapter {
  return {
    source: source as CompResult['source'],
    fetchComps: async () => { throw new Error(errorMessage); },
  };
}

describe('CompService', () => {
  let tempDir: string;
  let fileService: FileService;

  const sampleRequest: CompRequest = {
    cardId: 'card-1',
    player: 'Mike Trout',
    year: 2023,
    brand: 'Topps',
    cardNumber: '1',
    condition: 'RAW',
  };

  beforeEach(() => {
    resetOneThirtyPointRateLimit();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comp-test-'));
    const rawDir = path.join(tempDir, 'raw');
    const processedDir = path.join(tempDir, 'processed');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fileService = new FileService(rawDir, processedDir, tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns report with all sources', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60, marketValue: 50 }),
      createMockAdapter('eBay', { averagePrice: 45, low: 35, high: 55, marketValue: 45 }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.sources).toHaveLength(2);
    expect(report.sources[0].source).toBe('SportsCardsPro');
    expect(report.sources[1].source).toBe('eBay');
    expect(report.cardId).toBe('card-1');
    expect(report.player).toBe('Mike Trout');
    expect(report.generatedAt).toBeDefined();
  });

  it('handles adapter errors gracefully', async () => {
    const adapters = [
      createThrowingAdapter('SportsCardsPro', 'Network error'),
      createMockAdapter('eBay', { averagePrice: 45, low: 35, high: 55 }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.sources).toHaveLength(2);
    expect(report.sources[0].error).toBe('Network error');
    expect(report.sources[1].averagePrice).toBe(45);
  });

  it('calculates aggregates from successful sources with sales', async () => {
    const today = new Date().toISOString().split('T')[0];
    const adapters = [
      createMockAdapter('SportsCardsPro', {
        averagePrice: 50, low: 40, high: 60, marketValue: 50,
        sales: [
          { date: today, price: 40, venue: 'SportsCardsPro' },
          { date: today, price: 50, venue: 'SportsCardsPro' },
          { date: today, price: 60, venue: 'SportsCardsPro' },
        ],
      }),
      createMockAdapter('eBay', {
        averagePrice: 40, low: 30, high: 50, marketValue: 40,
        sales: [
          { date: today, price: 30, venue: 'eBay' },
          { date: today, price: 40, venue: 'eBay' },
          { date: today, price: 50, venue: 'eBay' },
        ],
      }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // With sales, uses weighted trimmed mean (all same-day, so equal weights)
    expect(report.aggregateAverage).toBeCloseTo(45, 0);
    expect(report.aggregateLow).toBeDefined();
    expect(report.aggregateHigh).toBeDefined();
    expect(report.aggregateLow!).toBeLessThanOrEqual(report.aggregateAverage!);
    expect(report.aggregateHigh!).toBeGreaterThanOrEqual(report.aggregateAverage!);
  });

  it('calculates aggregates via fallback when no sales', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60, marketValue: 50 }),
      createMockAdapter('eBay', { averagePrice: 40, low: 30, high: 50, marketValue: 40 }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // Fallback: weighted by source reliability (eBay=1.0, SCP=0.6)
    // (50*0.6 + 40*1.0) / 1.6 = 43.75
    expect(report.aggregateAverage).toBeCloseTo(43.75, 1);
    expect(report.aggregateLow).toBe(40);
    expect(report.aggregateHigh).toBe(50);
  });

  it('returns null aggregates when all sources fail', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { error: 'Not implemented' }),
      createMockAdapter('eBay', { error: 'Not implemented' }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.aggregateAverage).toBeNull();
    expect(report.aggregateLow).toBeNull();
    expect(report.aggregateHigh).toBeNull();
  });

  it('writes comp file to processed directory', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60 }),
    ];
    const service = new CompService(fileService, adapters);
    await service.generateAndWriteComps(sampleRequest);

    const processedDir = fileService.getProcessedDir();
    const files = fs.readdirSync(processedDir);
    expect(files.some(f => f.includes('Trout') && f.endsWith('-comps.txt'))).toBe(true);

    const compFile = files.find(f => f.endsWith('-comps.txt'))!;
    const content = fs.readFileSync(path.join(processedDir, compFile), 'utf-8');
    expect(content).toContain('Mike Trout');
    expect(content).toContain('2023');
    expect(content).toContain('Topps');
  });

  it('logs failures to comp-error.log', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { error: 'API not implemented' }),
    ];
    const service = new CompService(fileService, adapters);
    await service.generateAndWriteComps(sampleRequest);

    const logEntries = fileService.readLog('comp-error.log');
    expect(logEntries.length).toBeGreaterThan(0);
    expect(logEntries[0].reason).toContain('SportsCardsPro');
    expect(logEntries[0].reason).toContain('API not implemented');
  });

  it('uses default adapters when none provided', async () => {
    // Mock fetch so 130Point adapter (which uses fetch, not Puppeteer) doesn't make real HTTP calls
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network disabled in test'));
    try {
      const service = new CompService(fileService);
      const report = await service.generateComps(sampleRequest);

      expect(report.sources).toHaveLength(6);
      const sourceNames = report.sources.map(s => s.source);
      expect(sourceNames).toContain('SportsCardsPro');
      expect(sourceNames).toContain('eBay');
      expect(sourceNames).toContain('CardLadder');
      expect(sourceNames).toContain('MarketMovers');
      expect(sourceNames).toContain('130Point');
      expect(sourceNames).toContain('PSA');
      // All default adapters return stub errors (no browser service / no network)
      expect(report.sources.every(s => s.error)).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('skips PSA adapter for BGS-graded card', async () => {
    const psaAdapter = createMockAdapter('PSA', { averagePrice: 200, marketValue: 200 });
    const fetchSpy = jest.spyOn(psaAdapter, 'fetchComps');
    const ebayAdapter = createMockAdapter('eBay', { averagePrice: 50, marketValue: 50 });

    const service = new CompService(fileService, [ebayAdapter, psaAdapter]);
    const report = await service.generateComps({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'BGS',
      grade: '9.5',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(report.sources).toHaveLength(1);
    expect(report.sources[0].source).toBe('eBay');
  });

  it('skips PSA adapter for CGC-graded card', async () => {
    const psaAdapter = createMockAdapter('PSA', { averagePrice: 200, marketValue: 200 });
    const fetchSpy = jest.spyOn(psaAdapter, 'fetchComps');
    const ebayAdapter = createMockAdapter('eBay', { averagePrice: 50, marketValue: 50 });

    const service = new CompService(fileService, [ebayAdapter, psaAdapter]);
    const report = await service.generateComps({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'CGC',
      grade: '9',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(report.sources).toHaveLength(1);
  });

  it('keeps PSA adapter for PSA-graded card', async () => {
    const psaAdapter = createMockAdapter('PSA', { averagePrice: 100, marketValue: 100 });
    const fetchSpy = jest.spyOn(psaAdapter, 'fetchComps');
    const ebayAdapter = createMockAdapter('eBay', { averagePrice: 50, marketValue: 50 });

    const service = new CompService(fileService, [ebayAdapter, psaAdapter]);
    const report = await service.generateComps({
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(report.sources).toHaveLength(2);
  });

  it('keeps PSA adapter for raw/ungraded card', async () => {
    const psaAdapter = createMockAdapter('PSA', { averagePrice: 100, marketValue: 100 });
    const fetchSpy = jest.spyOn(psaAdapter, 'fetchComps');
    const ebayAdapter = createMockAdapter('eBay', { averagePrice: 50, marketValue: 50 });

    const service = new CompService(fileService, [ebayAdapter, psaAdapter]);
    const report = await service.generateComps(sampleRequest); // ungraded

    expect(fetchSpy).toHaveBeenCalled();
    expect(report.sources).toHaveLength(2);
  });

  it('accepts optional browserService and cacheService in constructor', async () => {
    // Mock fetch so 130Point adapter doesn't make real HTTP calls
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network disabled in test'));
    try {
      const mockBrowserService = {
        isRunning: jest.fn().mockReturnValue(false),
        launch: jest.fn(),
        shutdown: jest.fn(),
        newPage: jest.fn(),
        throttle: jest.fn(),
        navigateWithThrottle: jest.fn(),
      };
      const mockCacheService = {
        get: jest.fn().mockReturnValue(null),
        set: jest.fn(),
        buildCacheKey: jest.fn(),
        purgeExpired: jest.fn(),
      };

      // Should not throw — adapters are created with browser/cache services
      const service = new CompService(
        fileService,
        undefined,
        mockBrowserService as any,
        mockCacheService as any
      );
      const report = await service.generateComps(sampleRequest);

      expect(report.sources).toHaveLength(6);
      // Browser not running / no network so all should return stub errors
      expect(report.sources.every(s => s.error)).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  describe('with Database', () => {
    let db: Database;
    let cardId: string;

    beforeEach(async () => {
      db = new Database(':memory:');
      await db.waitReady();

      const card = await db.createCard({
        player: 'Mike Trout',
        team: 'Angels',
        year: 2023,
        brand: 'Topps',
        category: 'Baseball',
        cardNumber: '1',
        condition: 'RAW',
        purchasePrice: 10,
        purchaseDate: '2023-01-01',
        currentValue: 0,
        images: [],
        notes: '',
      });
      cardId = card.id;
    });

    afterEach(async () => {
      await db.close();
    });

    it('generateAndWriteComps persists to DB', async () => {
      const adapters = [
        createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60, marketValue: 50 }),
      ];
      const service = new CompService(fileService, adapters, undefined, undefined, db);

      const request = { ...sampleRequest, cardId };
      await service.generateAndWriteComps(request);

      const stored = await service.getStoredComps(cardId);
      expect(stored).toBeDefined();
      expect(stored!.sources).toHaveLength(1);
      expect(stored!.sources[0].averagePrice).toBe(50);
    });

    it('card currentValue updated after storing comps', async () => {
      const adapters = [
        createMockAdapter('SportsCardsPro', { averagePrice: 75, low: 60, high: 90, marketValue: 75 }),
      ];
      const service = new CompService(fileService, adapters, undefined, undefined, db);

      const request = { ...sampleRequest, cardId };
      await service.generateAndWriteComps(request);

      const card = await db.getCardById(cardId);
      expect(card!.currentValue).toBe(75);
    });

    it('currentValue unchanged when all sources fail', async () => {
      // First, set a value
      const goodAdapters = [
        createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60, marketValue: 50 }),
      ];
      const service1 = new CompService(fileService, goodAdapters, undefined, undefined, db);
      await service1.generateAndWriteComps({ ...sampleRequest, cardId });

      const cardBefore = await db.getCardById(cardId);
      expect(cardBefore!.currentValue).toBe(50);

      // Now generate with failing sources
      const failAdapters = [
        createMockAdapter('SportsCardsPro', { error: 'API not implemented' }),
      ];
      const service2 = new CompService(fileService, failAdapters, undefined, undefined, db);
      await service2.generateAndWriteComps({ ...sampleRequest, cardId });

      const cardAfter = await db.getCardById(cardId);
      expect(cardAfter!.currentValue).toBe(50);
    });

    it('getStoredComps returns undefined without db', async () => {
      const service = new CompService(fileService);
      const stored = await service.getStoredComps(cardId);
      expect(stored).toBeUndefined();
    });
  });
});

// ─── Helper Function Tests ──────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    const ms = normalizeDate('2026-02-23');
    expect(ms).toBe(new Date('2026-02-23T00:00:00Z').getTime());
  });

  it('parses MM/DD/YYYY slash format', () => {
    const ms = normalizeDate('02/23/2026');
    expect(ms).toBe(new Date('2026-02-23T00:00:00Z').getTime());
  });

  it('parses MM/DD/YY slash format', () => {
    const ms = normalizeDate('02/23/26');
    expect(ms).toBe(new Date('2026-02-23T00:00:00Z').getTime());
  });

  it('parses natural text format', () => {
    const ms = normalizeDate('Feb 23, 2026');
    expect(ms).not.toBeNull();
    const d = new Date(ms!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1); // Feb = 1
    expect(d.getDate()).toBe(23);
  });

  it('returns null for empty string', () => {
    expect(normalizeDate('')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(normalizeDate('not-a-date-xyz')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(normalizeDate('   ')).toBeNull();
  });
});

describe('recencyWeight', () => {
  const NOW = Date.UTC(2026, 1, 24); // Feb 24, 2026

  it('returns 1.0 for sale today', () => {
    expect(recencyWeight(NOW, NOW)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.5 for sale 30 days ago', () => {
    const thirtyDaysAgo = NOW - 30 * 86400000;
    expect(recencyWeight(thirtyDaysAgo, NOW)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.25 for sale 60 days ago', () => {
    const sixtyDaysAgo = NOW - 60 * 86400000;
    expect(recencyWeight(sixtyDaysAgo, NOW)).toBeCloseTo(0.25, 5);
  });

  it('returns 0.25 for null date (unknown)', () => {
    expect(recencyWeight(null, NOW)).toBe(0.25);
  });

  it('returns 1.0 for future date (clamped to 0 age)', () => {
    const future = NOW + 10 * 86400000;
    expect(recencyWeight(future, NOW)).toBeCloseTo(1.0, 5);
  });
});

describe('deduplicateSales', () => {
  const mkSale = (
    price: number,
    dateMs: number | null,
    venue: string,
    source: CompSource = 'eBay'
  ): NormalizedSale => ({ price, dateMs, venue, sourceAdapter: source });

  const BASE_DATE = Date.UTC(2026, 1, 20);

  it('removes exact duplicate (same price, date, venue)', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'eBay', 'eBay'),
      mkSale(100, BASE_DATE, 'eBay', '130Point'),
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(1);
    expect(result[0].sourceAdapter).toBe('eBay');
  });

  it('removes near-duplicate within tolerances ($0.50, 2 days)', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'eBay', 'eBay'),
      mkSale(100.49, BASE_DATE + 86400000, 'eBay', '130Point'), // $0.49 diff, 1 day diff
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(1);
  });

  it('keeps sales with price difference > $0.50', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'eBay', 'eBay'),
      mkSale(100.60, BASE_DATE, 'eBay', '130Point'), // $0.60 diff
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(2);
  });

  it('keeps sales with date difference > 2 days', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'eBay', 'eBay'),
      mkSale(100, BASE_DATE + 3 * 86400000, 'eBay', '130Point'), // 3 days apart
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(2);
  });

  it('keeps sales from different venues', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'Goldin', 'CardLadder'),
      mkSale(100, BASE_DATE, 'Heritage', 'CardLadder'),
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(2);
  });

  it('never dedupes null-date sales', () => {
    const sales = [
      mkSale(100, null, 'eBay', 'eBay'),
      mkSale(100, null, 'eBay', '130Point'),
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(2);
  });

  it('preserves priority ordering (first-seen wins)', () => {
    const sales = [
      mkSale(100, BASE_DATE, 'eBay', 'eBay'),       // higher priority
      mkSale(100, BASE_DATE, 'eBay', '130Point'),    // duplicate, lower priority
      mkSale(200, BASE_DATE, 'eBay', '130Point'),    // unique
    ];
    const result = deduplicateSales(sales);
    expect(result).toHaveLength(2);
    expect(result[0].sourceAdapter).toBe('eBay');
    expect(result[1].price).toBe(200);
  });
});

describe('computeWeightedTrimmedMean', () => {
  const NOW = Date.UTC(2026, 1, 24);

  const mkSale = (price: number, dateMs: number | null = NOW): NormalizedSale => ({
    price,
    dateMs,
    venue: 'eBay',
    sourceAdapter: 'eBay',
  });

  it('returns simple weighted average for < 5 sales (no trimming)', () => {
    const sales = [mkSale(100), mkSale(200), mkSale(300)];
    const result = computeWeightedTrimmedMean(sales, NOW);
    expect(result).not.toBeNull();
    // All same date (today), equal weights of 1.0
    expect(result!.average).toBeCloseTo(200, 1);
    expect(result!.low).toBe(100);
    expect(result!.high).toBe(300);
  });

  it('trims outliers with 5+ sales', () => {
    // 5 sales all today: 10, 100, 100, 100, 1000
    // Outliers (10, 1000) get partially/fully trimmed
    const sales = [mkSale(10), mkSale(100), mkSale(100), mkSale(100), mkSale(1000)];
    const result = computeWeightedTrimmedMean(sales, NOW);
    expect(result).not.toBeNull();
    // Trimming removes 10% weight from each tail, pulling average toward center
    expect(result!.average).toBeGreaterThan(50);
    expect(result!.average).toBeLessThan(500);
  });

  it('weights recent sales more heavily', () => {
    const thirtyDaysAgo = NOW - 30 * 86400000;
    // 2 cheap sales today, 2 expensive sales 30 days ago
    const sales = [
      mkSale(50, NOW), mkSale(50, NOW),
      mkSale(200, thirtyDaysAgo), mkSale(200, thirtyDaysAgo),
    ];
    const result = computeWeightedTrimmedMean(sales, NOW);
    expect(result).not.toBeNull();
    // Recent $50 sales (weight 1.0 each) should pull average below simple mean of $125
    expect(result!.average).toBeLessThan(125);
  });

  it('returns null for empty sales', () => {
    expect(computeWeightedTrimmedMean([], NOW)).toBeNull();
  });

  it('handles single sale', () => {
    const result = computeWeightedTrimmedMean([mkSale(150)], NOW);
    expect(result).not.toBeNull();
    expect(result!.average).toBeCloseTo(150, 1);
    expect(result!.low).toBe(150);
    expect(result!.high).toBe(150);
  });

  it('handles all identical prices', () => {
    const sales = [mkSale(100), mkSale(100), mkSale(100), mkSale(100), mkSale(100)];
    const result = computeWeightedTrimmedMean(sales, NOW);
    expect(result).not.toBeNull();
    expect(result!.average).toBeCloseTo(100, 1);
  });
});

describe('computeFallbackFromMarketValues', () => {
  it('weights by source reliability', () => {
    const results: CompResult[] = [
      { source: 'eBay', marketValue: 100, sales: [], averagePrice: 100, low: null, high: null },
      { source: 'SportsCardsPro', marketValue: 50, sales: [], averagePrice: 50, low: null, high: null },
    ];
    const result = computeFallbackFromMarketValues(results);
    expect(result).not.toBeNull();
    // eBay weight=1.0, SCP weight=0.6: (100*1.0 + 50*0.6) / 1.6 = 81.25
    expect(result!.average).toBeCloseTo(81.25, 1);
    expect(result!.low).toBe(50);
    expect(result!.high).toBe(100);
  });

  it('uses averagePrice as fallback when marketValue is null', () => {
    const results: CompResult[] = [
      { source: 'eBay', marketValue: null, sales: [], averagePrice: 80, low: null, high: null },
    ];
    const result = computeFallbackFromMarketValues(results);
    expect(result).not.toBeNull();
    expect(result!.average).toBeCloseTo(80, 1);
  });

  it('returns null when no successful sources', () => {
    const results: CompResult[] = [
      { source: 'eBay', marketValue: null, sales: [], averagePrice: null, low: null, high: null, error: 'fail' },
    ];
    expect(computeFallbackFromMarketValues(results)).toBeNull();
  });

  it('handles single source', () => {
    const results: CompResult[] = [
      { source: 'CardLadder', marketValue: 120, sales: [], averagePrice: null, low: null, high: null },
    ];
    const result = computeFallbackFromMarketValues(results);
    expect(result).not.toBeNull();
    expect(result!.average).toBeCloseTo(120, 1);
    expect(result!.low).toBe(120);
    expect(result!.high).toBe(120);
  });
});

describe('CompService weighted aggregation integration', () => {
  let tempDir: string;
  let fileService: FileService;

  const sampleRequest: CompRequest = {
    cardId: 'card-1',
    player: 'Tom Brady',
    year: 2020,
    brand: 'Panini',
    cardNumber: '1',
    condition: 'RAW',
  };

  beforeEach(() => {
    resetOneThirtyPointRateLimit();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comp-int-'));
    const rawDir = path.join(tempDir, 'raw');
    const processedDir = path.join(tempDir, 'processed');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fileService = new FileService(rawDir, processedDir, tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('eBay 20 sales vs SCP static $13 → aggregate reflects sales, not simple average', async () => {
    const today = new Date().toISOString().split('T')[0];
    const ebaySales = Array.from({ length: 20 }, (_, i) => ({
      date: today,
      price: 160 + (i - 10) * 2, // 140-178 range
      venue: 'eBay',
    }));

    const adapters = [
      createMockAdapter('SportsCardsPro', { marketValue: 13.53, averagePrice: 13.53, low: 13.53, high: 13.53, sales: [] }),
      createMockAdapter('eBay', {
        averagePrice: 176.05, low: 140, high: 178, marketValue: null,
        sales: ebaySales,
      }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // Old algorithm: (13.53 + 176.05) / 2 = 94.79
    // New: pools eBay sales, SCP has no sales. Result should be close to eBay's range
    expect(report.aggregateAverage).toBeGreaterThan(140);
    expect(report.aggregateAverage).toBeLessThan(180);
  });

  it('deduplicates eBay + 130Point overlap', async () => {
    const today = new Date().toISOString().split('T')[0];
    // Same sales reported by both sources
    const sharedSales = [
      { date: today, price: 100, venue: 'eBay' },
      { date: today, price: 150, venue: 'eBay' },
      { date: today, price: 200, venue: 'eBay' },
    ];

    const adapters = [
      createMockAdapter('eBay', { averagePrice: 150, sales: sharedSales }),
      createMockAdapter('130Point', { averagePrice: 150, sales: sharedSales }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // After dedup, only 3 unique sales remain (not 6)
    // Average of 100, 150, 200 = 150
    expect(report.aggregateAverage).toBeCloseTo(150, 0);
  });

  it('returns null aggregates when all sources fail', async () => {
    const adapters = [
      createMockAdapter('eBay', { error: 'Network error' }),
      createMockAdapter('SportsCardsPro', { error: 'Timeout' }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.aggregateAverage).toBeNull();
    expect(report.aggregateLow).toBeNull();
    expect(report.aggregateHigh).toBeNull();
  });

  it('falls back to market values when no individual sales exist', async () => {
    const adapters = [
      createMockAdapter('eBay', { marketValue: 100, averagePrice: 100, sales: [] }),
      createMockAdapter('SportsCardsPro', { marketValue: 60, averagePrice: 60, sales: [] }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // Fallback: eBay(100, w=1.0), SCP(60, w=0.6) → (100 + 36) / 1.6 = 85
    expect(report.aggregateAverage).toBeCloseTo(85, 0);
  });

  it('recent expensive sales dominate over old cheap sales', async () => {
    const today = new Date().toISOString().split('T')[0];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const adapters = [
      createMockAdapter('eBay', {
        averagePrice: 150,
        sales: [
          { date: today, price: 200, venue: 'eBay' },
          { date: today, price: 190, venue: 'eBay' },
          { date: today, price: 210, venue: 'eBay' },
          { date: ninetyDaysAgo, price: 50, venue: 'eBay' },
          { date: ninetyDaysAgo, price: 40, venue: 'eBay' },
          { date: ninetyDaysAgo, price: 60, venue: 'eBay' },
        ],
      }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    // Recent $200 sales (weight ~1.0) should dominate old $50 sales (weight ~0.125)
    expect(report.aggregateAverage).toBeGreaterThan(150);
  });

  it('single source with sales uses sales directly', async () => {
    const today = new Date().toISOString().split('T')[0];
    const adapters = [
      createMockAdapter('eBay', {
        averagePrice: 100,
        sales: [
          { date: today, price: 90, venue: 'eBay' },
          { date: today, price: 100, venue: 'eBay' },
          { date: today, price: 110, venue: 'eBay' },
        ],
      }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.aggregateAverage).toBeCloseTo(100, 0);
    expect(report.aggregateLow).toBe(90);
    expect(report.aggregateHigh).toBe(110);
  });
});
