import { exportCardsAsJSON, exportCardsAsCSV } from '../../utils/exportUtils';
import { createCard, createCardBatch, createSoldCard, createGradedCard } from '../helpers/factories';

describe('exportCardsAsJSON', () => {
  it('returns valid JSON string', () => {
    const cards = createCardBatch(2);
    const json = exportCardsAsJSON(cards);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('preserves all card data', () => {
    const cards = [createCard()];
    const parsed = JSON.parse(exportCardsAsJSON(cards));
    expect(parsed[0].player).toBe('Mike Trout');
    expect(parsed[0].team).toBe('Angels');
  });
});

describe('exportCardsAsCSV', () => {
  it('returns empty string for empty array', () => {
    expect(exportCardsAsCSV([])).toBe('');
  });

  it('includes header row', () => {
    const csv = exportCardsAsCSV([createCard()]);
    const headers = csv.split('\n')[0];
    expect(headers).toContain('Player');
    expect(headers).toContain('Team');
    expect(headers).toContain('Year');
  });

  it('includes data rows', () => {
    const csv = exportCardsAsCSV(createCardBatch(3));
    const lines = csv.split('\n');
    expect(lines.length).toBe(4); // header + 3 data rows
  });

  it('wraps fields with commas in quotes', () => {
    const card = createCard({ notes: 'Has a comma, in notes' });
    const csv = exportCardsAsCSV([card]);
    expect(csv).toContain('"Has a comma, in notes"');
  });

  it('escapes double quotes in notes', () => {
    const card = createCard({ notes: 'Said "hello"' });
    const csv = exportCardsAsCSV([card]);
    expect(csv).toContain('""hello""');
  });

  it('formats purchase date as YYYY-MM-DD', () => {
    const card = createCard({ purchaseDate: new Date('2023-06-15T00:00:00Z') });
    const csv = exportCardsAsCSV([card]);
    expect(csv).toContain('2023-06-15');
  });

  it('handles sold cards with sell price and date', () => {
    const card = createSoldCard();
    const csv = exportCardsAsCSV([card]);
    expect(csv).toContain('100'); // sellPrice
  });

  it('handles cards without optional fields', () => {
    const card = createCard({ parallel: undefined, gradingCompany: undefined, sellPrice: undefined });
    const csv = exportCardsAsCSV([card]);
    expect(csv.split('\n').length).toBe(2);
  });
});
