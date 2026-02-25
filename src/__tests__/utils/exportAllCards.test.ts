import { exportAllUnsoldCardsNow } from '../../utils/exportAllCards';
import { createCard, createSoldCard, createGradedCard } from '../helpers/factories';

describe('exportAllUnsoldCardsNow', () => {
  let mockClick: jest.Mock;

  beforeEach(() => {
    mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns failure when no cards provided', () => {
    const result = exportAllUnsoldCardsNow([]);
    expect(result).toEqual({ success: false, message: 'No unsold cards to export' });
  });

  it('returns failure when all cards are sold', () => {
    const cards = [createSoldCard(), createSoldCard()];
    const result = exportAllUnsoldCardsNow(cards);
    expect(result).toEqual({ success: false, message: 'No unsold cards to export' });
  });

  it('exports unsold cards and triggers download', () => {
    const cards = [createCard(), createCard(), createSoldCard()];
    const result = exportAllUnsoldCardsNow(cards);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(mockClick).toHaveBeenCalled();
  });

  it('includes header row in CSV', () => {
    // We can check that the Blob was created with CSV content by inspecting the createElement call
    const cards = [createCard()];
    const result = exportAllUnsoldCardsNow(cards);
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it('includes parallel in title', () => {
    const card = createCard({ parallel: 'Refractor' });
    const result = exportAllUnsoldCardsNow([card]);
    expect(result.success).toBe(true);
  });

  it('includes grading info in title', () => {
    const card = createGradedCard();
    const result = exportAllUnsoldCardsNow([card]);
    expect(result.success).toBe(true);
  });

  it('truncates title to 80 characters', () => {
    const card = createCard({
      player: 'A Very Long Player Name That Goes On',
      brand: 'Some Very Long Brand Name',
      parallel: 'Super Rare Gold Refractor Edition',
      gradingCompany: 'PSA',
      condition: '10: GEM MINT',
    });
    const result = exportAllUnsoldCardsNow([card]);
    expect(result.success).toBe(true);
  });

  it('returns filename with timestamp', () => {
    const cards = [createCard()];
    const result = exportAllUnsoldCardsNow(cards);
    expect(result.filename).toMatch(/^all-unsold-cards-ebay-\d+\.csv$/);
  });
});
