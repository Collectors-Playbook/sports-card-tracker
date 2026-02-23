import { Card } from '../../types';
import {
  calculateCardRoi,
  roiToColor,
  buildHeatmapData,
  computeHeatmapStats,
} from '../../utils/portfolioHeatmap';

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: '1',
  userId: 'user1',
  collectionType: 'Inventory',
  player: 'Mike Trout',
  team: 'Angels',
  year: 2023,
  brand: 'Topps',
  category: 'Baseball',
  cardNumber: '1',
  condition: 'Near Mint',
  purchasePrice: 100,
  purchaseDate: new Date(),
  currentValue: 150,
  images: [],
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('calculateCardRoi', () => {
  it('returns positive ROI when value exceeds cost', () => {
    const card = makeCard({ purchasePrice: 100, currentValue: 150 });
    expect(calculateCardRoi(card)).toBeCloseTo(0.5);
  });

  it('returns negative ROI when value is below cost', () => {
    const card = makeCard({ purchasePrice: 200, currentValue: 100 });
    expect(calculateCardRoi(card)).toBeCloseTo(-0.5);
  });

  it('returns zero ROI for break-even', () => {
    const card = makeCard({ purchasePrice: 100, currentValue: 100 });
    expect(calculateCardRoi(card)).toBe(0);
  });

  it('returns zero ROI when purchasePrice is zero', () => {
    const card = makeCard({ purchasePrice: 0, currentValue: 50 });
    expect(calculateCardRoi(card)).toBe(0);
  });

  it('returns zero ROI when purchasePrice is negative', () => {
    const card = makeCard({ purchasePrice: -10, currentValue: 50 });
    expect(calculateCardRoi(card)).toBe(0);
  });
});

describe('roiToColor', () => {
  it('returns red-ish color for negative ROI', () => {
    const color = roiToColor(-0.25);
    expect(color).toBe('rgb(239, 68, 68)');
  });

  it('returns yellow-ish color for zero ROI', () => {
    const color = roiToColor(0);
    expect(color).toBe('rgb(234, 179, 8)');
  });

  it('returns green-ish color for positive ROI', () => {
    const color = roiToColor(0.25);
    expect(color).toBe('rgb(34, 197, 94)');
  });

  it('clamps ROI at -50% (deep red)', () => {
    const color = roiToColor(-1.0);
    expect(color).toBe('rgb(220, 38, 38)');
  });

  it('clamps ROI at +50% (deep green)', () => {
    const color = roiToColor(1.0);
    expect(color).toBe('rgb(22, 163, 74)');
  });

  it('interpolates between stops', () => {
    // Midpoint between 0 (yellow 234,179,8) and +0.25 (green 34,197,94)
    const color = roiToColor(0.125);
    expect(color).toBe('rgb(134, 188, 51)');
  });
});

describe('buildHeatmapData', () => {
  it('excludes sold cards', () => {
    const cards = [
      makeCard({ id: '1', sellDate: undefined }),
      makeCard({ id: '2', sellDate: new Date('2024-01-01') }),
    ];
    const result = buildHeatmapData(cards);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('excludes cards with zero current value', () => {
    const cards = [
      makeCard({ id: '1', currentValue: 100 }),
      makeCard({ id: '2', currentValue: 0 }),
    ];
    const result = buildHeatmapData(cards);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('computes all fields correctly', () => {
    const card = makeCard({
      id: 'test',
      player: 'Mike Trout',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      team: 'Angels',
      category: 'Baseball',
      isGraded: true,
      purchasePrice: 100,
      currentValue: 150,
    });
    const result = buildHeatmapData([card]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'test',
      name: '2023 Topps Mike Trout #1',
      player: 'Mike Trout',
      team: 'Angels',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      isGraded: true,
      currentValue: 150,
      purchasePrice: 100,
      roi: 0.5,
      roiPercent: 50,
    });
    expect(result[0].color).toMatch(/^rgb\(/);
  });
});

describe('computeHeatmapStats', () => {
  it('counts winners, losers, and flat correctly', () => {
    const data = buildHeatmapData([
      makeCard({ id: '1', purchasePrice: 100, currentValue: 200 }),  // winner: roi=1.0
      makeCard({ id: '2', purchasePrice: 100, currentValue: 50 }),   // loser: roi=-0.5
      makeCard({ id: '3', purchasePrice: 100, currentValue: 100 }),  // flat: roi=0
    ]);
    const stats = computeHeatmapStats(data);
    expect(stats.totalCards).toBe(3);
    expect(stats.winners).toBe(1);
    expect(stats.losers).toBe(1);
    expect(stats.flat).toBe(1);
  });

  it('computes total value and average ROI', () => {
    const data = buildHeatmapData([
      makeCard({ id: '1', purchasePrice: 100, currentValue: 200 }),
      makeCard({ id: '2', purchasePrice: 100, currentValue: 100 }),
    ]);
    const stats = computeHeatmapStats(data);
    expect(stats.totalValue).toBe(300);
    expect(stats.avgRoi).toBeCloseTo(0.5); // (1.0 + 0) / 2
  });

  it('returns zeros for empty data', () => {
    const stats = computeHeatmapStats([]);
    expect(stats.totalCards).toBe(0);
    expect(stats.totalValue).toBe(0);
    expect(stats.winners).toBe(0);
    expect(stats.losers).toBe(0);
    expect(stats.flat).toBe(0);
    expect(stats.avgRoi).toBe(0);
  });
});
