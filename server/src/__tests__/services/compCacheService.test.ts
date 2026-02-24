import Database from '../../database';
import CompCacheService from '../../services/compCacheService';
import { CompRequest, CompResult } from '../../types';

describe('CompCacheService', () => {
  let db: Database;
  let service: CompCacheService;

  const sampleRequest: CompRequest = {
    cardId: 'card-1',
    player: 'Mike Trout',
    year: 2023,
    brand: 'Topps',
    cardNumber: '1',
    condition: 'RAW',
  };

  const sampleResult: CompResult = {
    source: 'eBay',
    marketValue: 45.50,
    sales: [
      { date: '2026-01-15', price: 42.00, venue: 'eBay' },
      { date: '2026-01-10', price: 49.00, venue: 'eBay' },
    ],
    averagePrice: 45.50,
    low: 42.00,
    high: 49.00,
  };

  beforeEach(() => {
    db = new Database(':memory:');
    service = new CompCacheService(db, 86400000); // 24h TTL
  });

  afterEach(async () => {
    await db.close();
  });

  it('returns null on cache miss', () => {
    const result = service.get('eBay', sampleRequest);
    expect(result).toBeNull();
  });

  it('returns cached result after set', () => {
    service.set('eBay', sampleRequest, sampleResult);
    const cached = service.get('eBay', sampleRequest);
    expect(cached).not.toBeNull();
    expect(cached!.source).toBe('eBay');
    expect(cached!.averagePrice).toBe(45.50);
    expect(cached!.sales).toHaveLength(2);
  });

  it('returns null for expired entries', () => {
    // Create service with 0ms TTL (immediately expired)
    const expiredService = new CompCacheService(db, 0);
    expiredService.set('eBay', sampleRequest, sampleResult);

    // The entry was just set but with TTL of 0, expiresAt = createdAt
    // Since the get checks expiresAt < now, it should be expired
    const cached = expiredService.get('eBay', sampleRequest);
    // With 0 TTL, expiresAt === createdAt, and now >= createdAt, so it's expired
    expect(cached).toBeNull();
  });

  it('builds deterministic cache keys', () => {
    const key1 = service.buildCacheKey('eBay', sampleRequest);
    const key2 = service.buildCacheKey('eBay', sampleRequest);
    expect(key1).toBe(key2);
    expect(key1).toContain('eBay');
    expect(key1).toContain('mike trout');
  });

  it('differentiates keys by source', () => {
    const key1 = service.buildCacheKey('eBay', sampleRequest);
    const key2 = service.buildCacheKey('SportsCardsPro', sampleRequest);
    expect(key1).not.toBe(key2);
  });

  it('purges expired entries', () => {
    // Create with 0ms TTL
    const expiredService = new CompCacheService(db, 0);
    expiredService.set('eBay', sampleRequest, sampleResult);

    const purged = expiredService.purgeExpired();
    expect(purged).toBe(1);

    // Verify it's gone
    const cached = service.get('eBay', sampleRequest);
    expect(cached).toBeNull();
  });

  it('upserts on repeated set', () => {
    service.set('eBay', sampleRequest, sampleResult);

    const updatedResult: CompResult = {
      ...sampleResult,
      averagePrice: 55.00,
    };
    service.set('eBay', sampleRequest, updatedResult);

    const cached = service.get('eBay', sampleRequest);
    expect(cached!.averagePrice).toBe(55.00);
  });
});
