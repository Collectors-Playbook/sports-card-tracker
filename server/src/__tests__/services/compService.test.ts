import fs from 'fs';
import path from 'path';
import os from 'os';
import FileService from '../../services/fileService';
import CompService from '../../services/compService';
import Database from '../../database';
import { CompAdapter, CompRequest, CompResult } from '../../types';

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

  it('calculates aggregates from successful sources', async () => {
    const adapters = [
      createMockAdapter('SportsCardsPro', { averagePrice: 50, low: 40, high: 60 }),
      createMockAdapter('eBay', { averagePrice: 40, low: 30, high: 50 }),
    ];
    const service = new CompService(fileService, adapters);
    const report = await service.generateComps(sampleRequest);

    expect(report.aggregateAverage).toBe(45);
    expect(report.aggregateLow).toBe(30);
    expect(report.aggregateHigh).toBe(60);
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
    const service = new CompService(fileService);
    const report = await service.generateComps(sampleRequest);

    expect(report.sources).toHaveLength(4);
    const sourceNames = report.sources.map(s => s.source);
    expect(sourceNames).toContain('SportsCardsPro');
    expect(sourceNames).toContain('eBay');
    expect(sourceNames).toContain('CardLadder');
    expect(sourceNames).toContain('MarketMovers');
    // All default adapters return stub errors (no browser service)
    expect(report.sources.every(s => s.error)).toBe(true);
  });

  it('accepts optional browserService and cacheService in constructor', async () => {
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

    expect(report.sources).toHaveLength(4);
    // Browser not running so all should return stub errors
    expect(report.sources.every(s => s.error)).toBe(true);
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
