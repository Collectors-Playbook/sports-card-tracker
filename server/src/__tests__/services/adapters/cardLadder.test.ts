import CardLadderAdapter, {
  buildSearchQuery,
  scoreMatch,
  extractRecentSales,
  _resetTokenCache,
} from '../../../services/adapters/cardLadder';
import { CompRequest, CompResult } from '../../../types';

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
};

// Mock Firestore card document response
function mockFirestoreCard(overrides: Record<string, unknown> = {}) {
  const defaults = {
    player: 'Mike Trout',
    year: 2023,
    set: 'Topps Chrome',
    number: '1',
    condition: 'Raw',
    variation: 'Base',
    gradingCompany: null,
    currentValue: 55.25,
    numSales: 10,
    category: 'Baseball',
    label: '2023 Topps Chrome Mike Trout #1 Raw',
  };
  const card = { ...defaults, ...overrides };

  const toField = (val: unknown) => {
    if (val === null) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number' && Number.isInteger(val)) return { integerValue: String(val) };
    if (typeof val === 'number') return { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'object' && val !== null) {
      const fields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        fields[k] = toField(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  };

  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(card)) {
    fields[k] = toField(v);
  }

  return { document: { name: 'projects/cardladder-71d53/databases/(default)/documents/cards/abc123', fields } };
}

// ─── Firestore-backed adapter tests ──────────────────────────────────────────

describe('CardLadderAdapter — Firestore mode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    _resetTokenCache();
    process.env = {
      ...originalEnv,
      CARDLADDER_EMAIL: 'test@example.com',
      CARDLADDER_PASSWORD: 'testpass',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns market value and sales from Firestore', async () => {
    const dailySales = {
      '02/20/2026': { p: 52, n: 1 },
      '02/15/2026': { p: 58, n: 1 },
      '02/10/2026': { p: 50, n: 1 },
    };
    const firestoreCard = mockFirestoreCard({ dailySales, currentValue: 55.25 });

    // Mock Firebase signIn
    const signInResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: '3600',
      }),
    };
    // Mock Firestore query
    const queryResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([firestoreCard]),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(signInResponse as unknown as Response)
      .mockResolvedValueOnce(queryResponse as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toBeUndefined();
    expect(result.source).toBe('CardLadder');
    expect(result.marketValue).toBe(55.25);
    expect(result.sales).toHaveLength(3);
    expect(result.sales[0].venue).toBe('Card Ladder');
    expect(result.averagePrice).toBeCloseTo(53.33, 1);
    expect(result.low).toBe(50);
    expect(result.high).toBe(58);
  });

  it('returns error when no credentials configured', async () => {
    delete process.env.CARDLADDER_EMAIL;
    delete process.env.CARDLADDER_PASSWORD;

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('credentials not configured');
  });

  it('returns error when authentication fails', async () => {
    const signInResponse = {
      ok: false,
      json: jest.fn().mockResolvedValue({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(signInResponse as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('authentication failed');
  });

  it('returns error when no Firestore results found', async () => {
    const signInResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
    };
    const queryResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([{}]),  // No document field
    };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(signInResponse as unknown as Response)
      .mockResolvedValueOnce(queryResponse as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('No Card Ladder results found');
  });

  it('handles Firestore HTTP errors', async () => {
    const signInResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
    };
    const queryResponse = { ok: false, status: 403, json: jest.fn() };

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(signInResponse as unknown as Response)
      .mockResolvedValueOnce(queryResponse as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('Card Ladder query failed: HTTP 403');
  });

  it('handles network errors', async () => {
    jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network timeout'));

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.error).toContain('Card Ladder error: Network timeout');
  });

  it('caches successful result', async () => {
    const cacheService = createMockCacheService();
    const firestoreCard = mockFirestoreCard({ currentValue: 55.25 });

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([firestoreCard]),
      } as unknown as Response);

    const adapter = new CardLadderAdapter(undefined, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.marketValue).toBe(55.25);
    expect(cacheService.set).toHaveBeenCalledWith(
      'CardLadder',
      sampleRequest,
      expect.objectContaining({ marketValue: 55.25 })
    );
  });

  it('returns cached result without calling API', async () => {
    const cacheService = createMockCacheService();
    const cachedResult: CompResult = {
      source: 'CardLadder',
      marketValue: 70,
      sales: [],
      averagePrice: 70,
      low: 65,
      high: 75,
    };
    cacheService.get.mockReturnValue(cachedResult);

    const fetchSpy = jest.spyOn(global, 'fetch');

    const adapter = new CardLadderAdapter(undefined, cacheService as any);
    const result = await adapter.fetchComps(sampleRequest);

    expect(result).toBe(cachedResult);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('picks best matching card when multiple results', async () => {
    const wrongYear = mockFirestoreCard({ year: 2020, number: '1', currentValue: 100 });
    const wrongNumber = mockFirestoreCard({ year: 2023, number: '99', currentValue: 200 });
    const exactMatch = mockFirestoreCard({ year: 2023, number: '1', currentValue: 55 });

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([wrongYear, wrongNumber, exactMatch]),
      } as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.marketValue).toBe(55);
  });

  it('uses averagePrice=marketValue when no daily sales', async () => {
    const firestoreCard = mockFirestoreCard({ dailySales: {}, currentValue: 42.50 });

    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ idToken: 'tok', refreshToken: 'ref', expiresIn: '3600' }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue([firestoreCard]),
      } as unknown as Response);

    const adapter = new CardLadderAdapter();
    const result = await adapter.fetchComps(sampleRequest);

    expect(result.marketValue).toBe(42.50);
    expect(result.averagePrice).toBe(42.50);
    expect(result.sales).toEqual([]);
  });

  it('source is CardLadder', () => {
    const adapter = new CardLadderAdapter();
    expect(adapter.source).toBe('CardLadder');
  });
});

// ─── scoreMatch ──────────────────────────────────────────────────────────────

describe('scoreMatch', () => {
  const baseCard = {
    player: 'Mike Trout',
    year: 2023,
    set: 'Topps Chrome',
    number: '1',
    condition: 'Raw',
    variation: 'Base',
    gradingCompany: null,
    currentValue: 55,
    numSales: 10,
    dailySales: {},
    category: 'Baseball',
    label: '',
  };

  it('returns -1 when year does not match', () => {
    const card = { ...baseCard, year: 2020 };
    expect(scoreMatch(card, sampleRequest)).toBe(-1);
  });

  it('scores higher for card number match', () => {
    const withNumber = { ...baseCard, number: '1' };
    const withoutNumber = { ...baseCard, number: '99' };
    expect(scoreMatch(withNumber, sampleRequest)).toBeGreaterThan(scoreMatch(withoutNumber, sampleRequest));
  });

  it('scores higher for condition match on graded request', () => {
    const gradedRequest: CompRequest = {
      ...sampleRequest,
      isGraded: true,
      gradingCompany: 'PSA',
      grade: '10',
    };
    const psa10 = { ...baseCard, condition: 'PSA 10' };
    const psa9 = { ...baseCard, condition: 'PSA 9' };
    const raw = { ...baseCard, condition: 'Raw' };
    expect(scoreMatch(psa10, gradedRequest)).toBeGreaterThan(scoreMatch(psa9, gradedRequest));
    expect(scoreMatch(psa9, gradedRequest)).toBeGreaterThan(scoreMatch(raw, gradedRequest));
  });

  it('prefers raw condition for raw request', () => {
    const rawCard = { ...baseCard, condition: 'Raw' };
    const gradedCard = { ...baseCard, condition: 'PSA 10' };
    expect(scoreMatch(rawCard, sampleRequest)).toBeGreaterThan(scoreMatch(gradedCard, sampleRequest));
  });
});

// ─── extractRecentSales ──────────────────────────────────────────────────────

describe('extractRecentSales', () => {
  it('returns sales sorted by most recent first', () => {
    const dailySales = {
      '01/10/2026': { p: 50, n: 1 },
      '02/15/2026': { p: 55, n: 1 },
      '01/20/2026': { p: 52, n: 1 },
    };
    const sales = extractRecentSales(dailySales);
    expect(sales[0].date).toBe('02/15/2026');
    expect(sales[1].date).toBe('01/20/2026');
    expect(sales[2].date).toBe('01/10/2026');
  });

  it('limits to specified number', () => {
    const dailySales: Record<string, { p: number; n: number }> = {};
    for (let i = 1; i <= 20; i++) {
      dailySales[`01/${String(i).padStart(2, '0')}/2026`] = { p: i * 10, n: 1 };
    }
    const sales = extractRecentSales(dailySales, 5);
    expect(sales).toHaveLength(5);
  });

  it('sets venue to Card Ladder', () => {
    const sales = extractRecentSales({ '01/01/2026': { p: 50, n: 1 } });
    expect(sales[0].venue).toBe('Card Ladder');
  });

  it('returns empty array for empty dailySales', () => {
    expect(extractRecentSales({})).toEqual([]);
  });
});

// ─── buildSearchQuery ────────────────────────────────────────────────────────

describe('buildSearchQuery', () => {
  it('builds basic query', () => {
    expect(buildSearchQuery(sampleRequest)).toBe('2023 Topps Mike Trout 1');
  });

  it('includes setName', () => {
    expect(buildSearchQuery({ ...sampleRequest, setName: 'Chrome' })).toBe('2023 Topps Chrome Mike Trout 1');
  });
});
