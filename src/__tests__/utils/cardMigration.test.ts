import { migrateCardToEnhanced, migrateAllCards, hasEnhancedFields } from '../../utils/cardMigration';
import { createCard, createGradedCard, createSoldCard } from '../helpers/factories';

describe('migrateCardToEnhanced', () => {
  it('maps core card fields to identification', () => {
    const card = createCard({ player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps Chrome', cardNumber: '1' });
    const enhanced = migrateCardToEnhanced(card);

    expect(enhanced.identification).toBeDefined();
    expect(enhanced.identification!.playerName).toBe('Mike Trout');
    expect(enhanced.identification!.teamName).toBe('Angels');
    expect(enhanced.identification!.cardNumber).toBe('1');
    expect(enhanced.identification!.setName).toBe('2023 Topps Chrome');
  });

  it('extracts manufacturer from brand — Topps', () => {
    const card = createCard({ brand: 'Topps Chrome' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.manufacturer).toBe('The Topps Company');
  });

  it('extracts manufacturer from brand — Panini', () => {
    const card = createCard({ brand: 'Panini Prizm' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.manufacturer).toBe('Panini America');
  });

  it('extracts manufacturer from brand — Bowman maps to Topps', () => {
    const card = createCard({ brand: 'Bowman' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.manufacturer).toBe('The Topps Company');
  });

  it('falls back to brand name when no manufacturer mapping', () => {
    const card = createCard({ brand: 'UnknownBrand' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.manufacturer).toBe('UnknownBrand');
  });

  it('determines era — Vintage', () => {
    const card = createCard({ year: 1975 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.era).toBe('Vintage');
  });

  it('determines era — Junk Wax', () => {
    const card = createCard({ year: 1989 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.era).toBe('Junk Wax');
  });

  it('determines era — Modern', () => {
    const card = createCard({ year: 2000 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.era).toBe('Modern');
  });

  it('determines era — Ultra-Modern', () => {
    const card = createCard({ year: 2023 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.era).toBe('Ultra-Modern');
  });

  it('detects rookie from notes', () => {
    const card = createCard({ notes: 'Rookie card RC' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.playerMetadata!.isRookie).toBe(true);
    expect(enhanced.playerMetadata!.rookieYear).toBe(card.year);
  });

  it('detects no rookie when notes empty', () => {
    const card = createCard({ notes: '' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.playerMetadata!.isRookie).toBe(false);
    expect(enhanced.playerMetadata!.rookieYear).toBeUndefined();
  });

  it('detects autograph from notes', () => {
    const card = createCard({ notes: 'Auto Autograph on card' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.specialFeatures!.hasAutograph).toBe(true);
  });

  it('detects memorabilia from notes', () => {
    const card = createCard({ notes: 'Jersey patch relic' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.specialFeatures!.hasMemorabilia).toBe(true);
  });

  it('detects 1/1 from notes', () => {
    const card = createCard({ notes: '1/1 super rare' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.specialFeatures!.is1of1).toBe(true);
  });

  it('detects 1/1 from parallel', () => {
    const card = createCard({ parallel: 'Superfractor 1/1', notes: '' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.specialFeatures!.is1of1).toBe(true);
  });

  it('sets parallels array when parallel exists', () => {
    const card = createCard({ parallel: 'Refractor' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.parallels).toEqual(['Refractor']);
  });

  it('sets parallels undefined when no parallel', () => {
    const card = createCard({ parallel: undefined });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.identification!.parallels).toBeUndefined();
  });

  it('calculates analytics with positive return', () => {
    const card = createCard({ purchasePrice: 50, currentValue: 150 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.analytics.totalReturn).toBe(100);
    expect(enhanced.analytics.percentageReturn).toBe(200);
    expect(enhanced.analytics.growthPotential).toBe('High');
    expect(enhanced.analytics.sellRecommendation).toBe('Sell');
  });

  it('calculates analytics with low return', () => {
    const card = createCard({ purchasePrice: 100, currentValue: 110 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.analytics.growthPotential).toBe('Low');
    expect(enhanced.analytics.sellRecommendation).toBe('Hold');
  });

  it('calculates analytics for sold card', () => {
    const card = createSoldCard();
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.analytics.sellRecommendation).toBe('Sold');
  });

  it('extracts grade number from condition', () => {
    const card = createGradedCard({ condition: '9.5: MINT+' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.collectionMeta!.personalGrade).toBe(9.5);
  });

  it('returns 0 for RAW condition grade', () => {
    const card = createCard({ condition: 'RAW' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.collectionMeta!.personalGrade).toBe(0);
  });

  it('adds authentication for graded cards', () => {
    const card = createGradedCard({ gradingCompany: 'PSA', condition: '10: GEM MINT' });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.authentication).toBeDefined();
    expect(enhanced.authentication!.gradingCompany).toBe('PSA');
    expect(enhanced.authentication!.gradeNumeric).toBe(10);
    expect(enhanced.authentication!.gradeLabel).toBe('10: GEM MINT');
  });

  it('does not add authentication for raw cards', () => {
    const card = createCard({ gradingCompany: undefined });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.authentication).toBeUndefined();
  });

  it('sets storage method to Graded Slab for graded cards', () => {
    const card = createGradedCard();
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.storage!.storageMethod).toBe('Graded Slab');
  });

  it('sets storage method to Toploader for raw cards', () => {
    const card = createCard();
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.storage!.storageMethod).toBe('Toploader');
  });

  it('sets market data with purchase price history entry', () => {
    const card = createCard({ purchasePrice: 50 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.marketData!.priceHistory).toHaveLength(1);
    expect(enhanced.marketData!.priceHistory![0].price).toBe(50);
    expect(enhanced.marketData!.priceHistory![0].source).toBe('Purchase');
  });

  it('sets transaction tax basis to purchase price', () => {
    const card = createCard({ purchasePrice: 75 });
    const enhanced = migrateCardToEnhanced(card);
    expect(enhanced.transaction!.taxBasis).toBe(75);
  });
});

describe('migrateAllCards', () => {
  it('migrates batch of cards', () => {
    const cards = [createCard(), createGradedCard(), createSoldCard()];
    const enhanced = migrateAllCards(cards);
    expect(enhanced).toHaveLength(3);
    enhanced.forEach(e => {
      expect(e.identification).toBeDefined();
      expect(e.analytics).toBeDefined();
    });
  });

  it('handles empty array', () => {
    expect(migrateAllCards([])).toEqual([]);
  });
});

describe('hasEnhancedFields', () => {
  it('returns true when identification is present', () => {
    expect(hasEnhancedFields({ identification: { playerName: 'test' } })).toBe(true);
  });

  it('returns true when playerMetadata is present', () => {
    expect(hasEnhancedFields({ playerMetadata: { isRookie: false } })).toBe(true);
  });

  it('returns true when specialFeatures is present', () => {
    expect(hasEnhancedFields({ specialFeatures: { hasAutograph: true } })).toBe(true);
  });

  it('returns false when no enhanced fields', () => {
    expect(hasEnhancedFields({ player: 'Test' })).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasEnhancedFields({})).toBe(false);
  });
});
