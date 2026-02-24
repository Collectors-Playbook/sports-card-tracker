import PopulationReportService, {
  classifyRarityTier,
  computePercentile,
  getMultiplier,
  POP_MULTIPLIERS,
  POP_CACHE_TTL_MS,
} from '../../services/populationReportService';
import Database from '../../database';
import { PopulationData, PopRarityTier, PopScraper, PopRequest, CompRequest } from '../../types';

// ─── classifyRarityTier ─────────────────────────────────────────────────────

describe('classifyRarityTier', () => {
  it.each([
    [1, 'ultra-low'],
    [3, 'ultra-low'],
    [5, 'ultra-low'],
    [6, 'low'],
    [15, 'low'],
    [25, 'low'],
    [26, 'medium'],
    [50, 'medium'],
    [100, 'medium'],
    [101, 'high'],
    [250, 'high'],
    [500, 'high'],
    [501, 'very-high'],
    [5000, 'very-high'],
  ] as [number, PopRarityTier][])('pop=%d → %s', (pop, expected) => {
    expect(classifyRarityTier(pop)).toBe(expected);
  });
});

// ─── computePercentile ──────────────────────────────────────────────────────

describe('computePercentile', () => {
  it('returns 0 when totalGraded is 0', () => {
    expect(computePercentile(0, 0, 0)).toBe(0);
  });

  it('computes correct percentile', () => {
    // 5 at grade + 3 higher = 8 / 100 = 8%
    expect(computePercentile(5, 3, 100)).toBe(8);
  });

  it('rounds to 2 decimal places', () => {
    expect(computePercentile(1, 0, 3)).toBeCloseTo(33.33, 1);
  });

  it('returns 100% when all at target or higher', () => {
    expect(computePercentile(50, 50, 100)).toBe(100);
  });
});

// ─── getMultiplier ──────────────────────────────────────────────────────────

describe('getMultiplier', () => {
  const makePopData = (tier: PopRarityTier): PopulationData => ({
    gradingCompany: 'PSA',
    totalGraded: 100,
    gradeBreakdown: [],
    targetGrade: '10',
    targetGradePop: 3,
    higherGradePop: 0,
    percentile: 3,
    rarityTier: tier,
    fetchedAt: new Date().toISOString(),
  });

  it.each([
    ['ultra-low', 1.25],
    ['low', 1.10],
    ['medium', 1.00],
    ['high', 1.00],
    ['very-high', 0.95],
  ] as [PopRarityTier, number][])('tier=%s → %f', (tier, expected) => {
    expect(getMultiplier(makePopData(tier))).toBe(expected);
  });
});

// ─── PopulationReportService ────────────────────────────────────────────────

describe('PopulationReportService', () => {
  const samplePopData: PopulationData = {
    gradingCompany: 'PSA',
    totalGraded: 1000,
    gradeBreakdown: [
      { grade: '10', count: 3 },
      { grade: '9', count: 50 },
      { grade: '8', count: 200 },
    ],
    targetGrade: '10',
    targetGradePop: 3,
    higherGradePop: 0,
    percentile: 0.3,
    rarityTier: 'ultra-low',
    fetchedAt: new Date().toISOString(),
  };

  const gradedRequest: CompRequest = {
    cardId: 'card-1',
    player: 'Mike Trout',
    year: 2023,
    brand: 'Topps',
    cardNumber: '1',
    isGraded: true,
    gradingCompany: 'PSA',
    grade: '10',
  };

  const ungradedRequest: CompRequest = {
    cardId: 'card-2',
    player: 'Mike Trout',
    year: 2023,
    brand: 'Topps',
    cardNumber: '1',
  };

  function createMockScraper(company: string, result: PopulationData | null = null): PopScraper {
    return {
      company,
      fetchPopulation: jest.fn().mockResolvedValue(result),
    };
  }

  it('returns null for ungraded cards', async () => {
    const service = new PopulationReportService([createMockScraper('PSA', samplePopData)]);
    const result = await service.getPopulationData(ungradedRequest);
    expect(result).toBeNull();
  });

  it('returns null when no matching scraper exists', async () => {
    const service = new PopulationReportService([createMockScraper('BGS', null)]);
    const result = await service.getPopulationData(gradedRequest);
    expect(result).toBeNull();
  });

  it('returns pop data from scraper for graded card', async () => {
    const scraper = createMockScraper('PSA', samplePopData);
    const service = new PopulationReportService([scraper]);
    const result = await service.getPopulationData(gradedRequest);

    expect(result).toEqual(samplePopData);
    expect(scraper.fetchPopulation).toHaveBeenCalledWith({
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      grade: '10',
      category: undefined,
      setName: undefined,
      parallel: undefined,
    });
  });

  it('matches scraper case-insensitively', async () => {
    const scraper = createMockScraper('psa', samplePopData);
    const service = new PopulationReportService([scraper]);
    const result = await service.getPopulationData(gradedRequest);
    expect(result).toEqual(samplePopData);
  });

  it('returns cached data within TTL', async () => {
    const db = new Database(':memory:');
    // Create card record for FK constraint
    const user = await db.createUser({ username: 'test', email: 'test@test.com', password: 'pass' });
    await db.createCard({
      userId: user.id, player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps',
      category: 'Baseball', cardNumber: '1', condition: 'PSA 10', purchasePrice: 20,
      purchaseDate: '2023-01-01', currentValue: 20, images: [], notes: '',
    });
    // Get the actual card ID
    const cards = await db.getAllCards();
    const request = { ...gradedRequest, cardId: cards[0].id };

    const scraper = createMockScraper('PSA', samplePopData);
    const service = new PopulationReportService([scraper], db);

    // First call populates cache
    await service.getPopulationData(request);
    // Second call should use cache
    const result = await service.getPopulationData(request);

    expect(result).toBeTruthy();
    expect(scraper.fetchPopulation).toHaveBeenCalledTimes(1);

    await db.close();
  });

  it('stores snapshot in DB when db is provided', async () => {
    const db = new Database(':memory:');
    // Create card record for FK constraint
    const user = await db.createUser({ username: 'test', email: 'test2@test.com', password: 'pass' });
    await db.createCard({
      userId: user.id, player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps',
      category: 'Baseball', cardNumber: '1', condition: 'PSA 10', purchasePrice: 20,
      purchaseDate: '2023-01-01', currentValue: 20, images: [], notes: '',
    });
    const cards = await db.getAllCards();
    const request = { ...gradedRequest, cardId: cards[0].id };

    const scraper = createMockScraper('PSA', samplePopData);
    const service = new PopulationReportService([scraper], db);

    await service.getPopulationData(request);

    const history = await db.getPopHistory(cards[0].id);
    expect(history).toHaveLength(1);
    expect(history[0].gradingCompany).toBe('PSA');
    expect(history[0].targetGrade).toBe('10');
    expect(history[0].targetGradePop).toBe(3);

    await db.close();
  });

  it('returns null when request has no grade', async () => {
    const service = new PopulationReportService([createMockScraper('PSA', samplePopData)]);
    const result = await service.getPopulationData({
      ...gradedRequest,
      grade: undefined,
    });
    expect(result).toBeNull();
  });

  it('returns null when request has no gradingCompany', async () => {
    const service = new PopulationReportService([createMockScraper('PSA', samplePopData)]);
    const result = await service.getPopulationData({
      ...gradedRequest,
      gradingCompany: undefined,
    });
    expect(result).toBeNull();
  });
});
