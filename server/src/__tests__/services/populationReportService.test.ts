import PopulationReportService, {
  classifyRarityTier,
  computePercentile,
  popMultiplier,
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

// ─── popMultiplier ──────────────────────────────────────────────────────────

describe('popMultiplier', () => {
  it('returns 1.25 for pop=0 (floor guard)', () => {
    expect(popMultiplier(0)).toBe(1.25);
  });

  it('returns 1.25 for pop=1', () => {
    expect(popMultiplier(1)).toBe(1.25);
  });

  it('returns ~1.180 for pop=5', () => {
    expect(popMultiplier(5)).toBeCloseTo(1.180, 2);
  });

  it('returns ~1.150 for pop=10', () => {
    expect(popMultiplier(10)).toBeCloseTo(1.150, 2);
  });

  it('returns ~1.050 for pop=100', () => {
    expect(popMultiplier(100)).toBeCloseTo(1.050, 2);
  });

  it('returns ~0.980 for pop=500', () => {
    expect(popMultiplier(500)).toBeCloseTo(0.980, 2);
  });

  it('returns 0.95 for pop=1000', () => {
    expect(popMultiplier(1000)).toBe(0.95);
  });

  it('returns 0.95 for pop=5000 (clamped)', () => {
    expect(popMultiplier(5000)).toBe(0.95);
  });

  it('is monotonically decreasing across sample points', () => {
    const pops = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
    for (let i = 1; i < pops.length; i++) {
      expect(popMultiplier(pops[i])).toBeLessThanOrEqual(popMultiplier(pops[i - 1]));
    }
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
      gradingCompany: 'PSA',
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

  // ─── Fallback scraper ───────────────────────────────────────────────────

  describe('fallback scraper', () => {
    const fallbackPopData: PopulationData = {
      ...samplePopData,
      gradingCompany: 'PSA',
    };

    it('tries fallback when primary scraper returns null', async () => {
      const primary = createMockScraper('PSA', null);
      const fallback = createMockScraper('GemRate', fallbackPopData);
      const service = new PopulationReportService([primary], undefined, fallback);

      const result = await service.getPopulationData(gradedRequest);
      expect(result).toEqual(fallbackPopData);
      expect(primary.fetchPopulation).toHaveBeenCalledTimes(1);
      expect(fallback.fetchPopulation).toHaveBeenCalledTimes(1);
    });

    it('does not try fallback when primary succeeds', async () => {
      const primary = createMockScraper('PSA', samplePopData);
      const fallback = createMockScraper('GemRate', fallbackPopData);
      const service = new PopulationReportService([primary], undefined, fallback);

      const result = await service.getPopulationData(gradedRequest);
      expect(result).toEqual(samplePopData);
      expect(fallback.fetchPopulation).not.toHaveBeenCalled();
    });

    it('tries fallback when no primary scraper exists for company', async () => {
      const primary = createMockScraper('CGC', null); // No PSA scraper
      const fallback = createMockScraper('GemRate', fallbackPopData);
      const service = new PopulationReportService([primary], undefined, fallback);

      const result = await service.getPopulationData(gradedRequest);
      expect(result).toEqual(fallbackPopData);
      expect(primary.fetchPopulation).not.toHaveBeenCalled(); // CGC doesn't match PSA
      expect(fallback.fetchPopulation).toHaveBeenCalledTimes(1);
    });

    it('returns null when both primary and fallback return null', async () => {
      const primary = createMockScraper('PSA', null);
      const fallback = createMockScraper('GemRate', null);
      const service = new PopulationReportService([primary], undefined, fallback);

      const result = await service.getPopulationData(gradedRequest);
      expect(result).toBeNull();
      expect(primary.fetchPopulation).toHaveBeenCalledTimes(1);
      expect(fallback.fetchPopulation).toHaveBeenCalledTimes(1);
    });

    it('passes gradingCompany in PopRequest to fallback', async () => {
      const primary = createMockScraper('PSA', null);
      const fallback = createMockScraper('GemRate', fallbackPopData);
      const service = new PopulationReportService([primary], undefined, fallback);

      await service.getPopulationData(gradedRequest);
      expect(fallback.fetchPopulation).toHaveBeenCalledWith(
        expect.objectContaining({ gradingCompany: 'PSA' })
      );
    });

    it('caches fallback result identically to primary result', async () => {
      const db = new Database(':memory:');
      const user = await db.createUser({ username: 'test', email: 'fallback@test.com', password: 'pass' });
      await db.createCard({
        userId: user.id, player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps',
        category: 'Baseball', cardNumber: '1', condition: 'PSA 10', purchasePrice: 20,
        purchaseDate: '2023-01-01', currentValue: 20, images: [], notes: '',
      });
      const cards = await db.getAllCards();
      const request = { ...gradedRequest, cardId: cards[0].id };

      const primary = createMockScraper('PSA', null);
      const fallback = createMockScraper('GemRate', fallbackPopData);
      const service = new PopulationReportService([primary], db, fallback);

      // First call: primary fails, fallback succeeds, result is cached
      await service.getPopulationData(request);
      // Second call: should use cache
      await service.getPopulationData(request);

      expect(primary.fetchPopulation).toHaveBeenCalledTimes(1);
      expect(fallback.fetchPopulation).toHaveBeenCalledTimes(1);

      const history = await db.getPopHistory(cards[0].id);
      expect(history).toHaveLength(1);

      await db.close();
    });
  });
});
