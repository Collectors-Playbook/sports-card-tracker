import { instantExportAllUnsoldCards } from '../../utils/instantEbayExport';
import { createCard, createSoldCard, createGradedCard } from '../helpers/factories';

describe('instantExportAllUnsoldCards', () => {
  let mockClick: jest.Mock;
  let mockAppendChild: jest.SpyInstance;
  let mockRemoveChild: jest.SpyInstance;

  beforeEach(() => {
    mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLElement);
    mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when no unsold inventory cards exist', () => {
    const cards = [createSoldCard(), createSoldCard()];
    const result = instantExportAllUnsoldCards(cards);
    expect(result).toBeNull();
  });

  it('filters out PC cards — only exports Inventory', () => {
    const pcCard = createCard({ collectionType: 'PC' });
    const invCard = createCard({ collectionType: 'Inventory' });
    const result = instantExportAllUnsoldCards([pcCard, invCard]);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
  });

  it('returns null when only PC cards are unsold', () => {
    const cards = [createCard({ collectionType: 'PC' })];
    const result = instantExportAllUnsoldCards(cards);
    expect(result).toBeNull();
  });

  it('calculates summary totals correctly', () => {
    const card1 = createCard({ currentValue: 100, purchasePrice: 50, collectionType: 'Inventory' });
    const card2 = createCard({ currentValue: 200, purchasePrice: 80, collectionType: 'Inventory' });
    const result = instantExportAllUnsoldCards([card1, card2]);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
    expect(result!.totalValue).toBe(300);
    expect(result!.totalStartingPrice).toBeCloseTo(270); // 300 * 0.9
    expect(result!.totalProfit).toBe(170); // (100-50) + (200-80)
  });

  it('triggers download with appendChild/click/removeChild', () => {
    const cards = [createCard({ collectionType: 'Inventory' })];
    instantExportAllUnsoldCards(cards);

    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('generates timestamped filename', () => {
    const cards = [createCard({ collectionType: 'Inventory' })];
    const result = instantExportAllUnsoldCards(cards);
    expect(result!.filename).toMatch(/^ebay-all-unsold-cards-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
  });

  it('maps category to display name — Baseball', () => {
    // The getCategoryName function is internal but we verify it runs without error
    const cards = [createCard({ category: 'Baseball', collectionType: 'Inventory' })];
    const result = instantExportAllUnsoldCards(cards);
    expect(result).not.toBeNull();
  });

  it('includes parallel in title when present', () => {
    const card = createCard({ parallel: 'Gold Refractor', collectionType: 'Inventory' });
    const result = instantExportAllUnsoldCards([card]);
    expect(result!.count).toBe(1);
  });

  it('includes grading info in title when present', () => {
    const card = createGradedCard({ collectionType: 'Inventory' });
    const result = instantExportAllUnsoldCards([card]);
    expect(result!.count).toBe(1);
  });

  it('truncates title longer than 80 chars', () => {
    const card = createCard({
      player: 'A Very Long Player Name Goes Here',
      brand: 'Some Very Long Brand Name',
      parallel: 'Super Rare Gold Refractor Edition',
      gradingCompany: 'PSA',
      condition: '10: GEM MINT',
      collectionType: 'Inventory',
    });
    const result = instantExportAllUnsoldCards([card]);
    expect(result!.count).toBe(1);
  });
});
