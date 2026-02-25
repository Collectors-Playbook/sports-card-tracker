import { createCard, createSoldCard, createGradedCard } from '../helpers/factories';

describe('autoExportAllUnsoldCards', () => {
  let autoExportAllUnsoldCards: typeof import('../../utils/autoExportEbay').autoExportAllUnsoldCards;
  let mockGetAllCards: jest.Mock;
  let mockClick: jest.Mock;

  beforeEach(() => {
    mockGetAllCards = jest.fn();
    mockClick = jest.fn();

    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
      style: { display: '' },
    } as unknown as HTMLElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    // Use isolateModules to prevent the module-level side-effect from executing
    jest.isolateModules(() => {
      jest.doMock('../../services/api', () => ({
        apiService: {
          getAllCards: (...args: any[]) => mockGetAllCards(...args),
        },
      }));
      autoExportAllUnsoldCards = require('../../utils/autoExportEbay').autoExportAllUnsoldCards;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports unsold cards and returns summary', async () => {
    const cards = [
      createCard({ currentValue: 100, purchasePrice: 50 }),
      createSoldCard(),
    ];
    mockGetAllCards.mockResolvedValue(cards);

    const result = await autoExportAllUnsoldCards();

    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.count).toBe(1);
    expect(mockClick).toHaveBeenCalled();
  });

  it('returns null when no cards found', async () => {
    mockGetAllCards.mockResolvedValue([]);
    const result = await autoExportAllUnsoldCards();
    expect(result).toBeNull();
  });

  it('returns null when getAllCards returns null', async () => {
    mockGetAllCards.mockResolvedValue(null);
    const result = await autoExportAllUnsoldCards();
    expect(result).toBeNull();
  });

  it('returns null when all cards are sold', async () => {
    mockGetAllCards.mockResolvedValue([createSoldCard(), createSoldCard()]);
    const result = await autoExportAllUnsoldCards();
    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockGetAllCards.mockRejectedValue(new Error('Network error'));
    const result = await autoExportAllUnsoldCards();
    expect(result).toBeNull();
  });

  it('includes rookie tag in title when notes contain RC', async () => {
    const card = createCard({ notes: 'Rookie RC card' });
    mockGetAllCards.mockResolvedValue([card]);
    const result = await autoExportAllUnsoldCards();
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });

  it('includes grading info in title for graded cards', async () => {
    const card = createGradedCard({ condition: '10: GEM MINT', gradingCompany: 'PSA' });
    mockGetAllCards.mockResolvedValue([card]);
    const result = await autoExportAllUnsoldCards();
    expect(result).not.toBeNull();
  });

  it('truncates title to 80 characters', async () => {
    const card = createCard({
      player: 'Very Long Player Name Goes Here And More',
      brand: 'Some Very Long Brand Name',
      parallel: 'Super Gold Refractor',
      gradingCompany: 'PSA',
      condition: '10: GEM MINT',
    });
    mockGetAllCards.mockResolvedValue([card]);
    const result = await autoExportAllUnsoldCards();
    expect(result).not.toBeNull();
  });

  it('calculates correct summary totals', async () => {
    const cards = [
      createCard({ currentValue: 100, purchasePrice: 50 }),
      createCard({ currentValue: 200, purchasePrice: 100 }),
    ];
    mockGetAllCards.mockResolvedValue(cards);

    const result = await autoExportAllUnsoldCards();

    expect(result!.count).toBe(2);
    expect(result!.totalValue).toBe(300);
    expect(result!.totalStartPrice).toBeCloseTo(255); // 300 * 0.85
  });

  it('generates timestamped filename', async () => {
    mockGetAllCards.mockResolvedValue([createCard()]);
    const result = await autoExportAllUnsoldCards();
    expect(result!.filename).toMatch(/^eBay-Listings-ALL-CARDS-/);
  });

  it('maps category IDs correctly', async () => {
    // Different categories produce different eBay category IDs
    const cards = [
      createCard({ category: 'Baseball' }),
      createCard({ category: 'Basketball' }),
      createCard({ category: 'Pokemon' }),
    ];
    mockGetAllCards.mockResolvedValue(cards);
    const result = await autoExportAllUnsoldCards();
    expect(result!.count).toBe(3);
  });
});
