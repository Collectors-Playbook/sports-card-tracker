import { validateCard, formatCardNumber, formatPlayerName, suggestCurrentValue } from '../../utils/validation';
import { createCard, createGradedCard } from '../helpers/factories';

describe('validateCard', () => {
  it('returns valid for a complete card with RAW condition', () => {
    const card = createCard();
    const result = validateCard(card);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for a graded card with grading company', () => {
    const card = createGradedCard();
    const result = validateCard(card);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires player name', () => {
    const card = createCard({ player: '' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Player name is required');
  });

  it('requires team', () => {
    const card = createCard({ team: '' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Team is required');
  });

  it('requires year between 1850 and next year', () => {
    const cardLow = createCard({ year: 1800 });
    expect(validateCard(cardLow).errors).toContain('Year must be between 1850 and next year');

    const cardHigh = createCard({ year: new Date().getFullYear() + 5 });
    expect(validateCard(cardHigh).errors).toContain('Year must be between 1850 and next year');
  });

  it('requires brand', () => {
    const card = createCard({ brand: '' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Brand is required');
  });

  it('requires valid category', () => {
    const card = createCard({ category: 'InvalidSport' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Valid category is required');
  });

  it('requires card number', () => {
    const card = createCard({ cardNumber: '' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Card number is required');
  });

  it('requires valid condition', () => {
    const card = createCard({ condition: 'FAKE_CONDITION' });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Valid condition is required');
  });

  it('requires non-negative purchase price', () => {
    const card = createCard({ purchasePrice: -10 });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Purchase price must be a positive number');
  });

  it('requires non-negative current value', () => {
    const card = createCard({ currentValue: -5 });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Current value must be a positive number');
  });

  it('validates sell price when provided', () => {
    const card = createCard({ sellPrice: -1 });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Sell price must be a positive number');
  });

  it('allows undefined sell price', () => {
    const card = createCard({ sellPrice: undefined });
    const result = validateCard(card);
    expect(result.errors).not.toContain('Sell price must be a positive number');
  });

  it('requires purchase date', () => {
    const card = createCard({ purchaseDate: null as any });
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Purchase date is required');
  });

  it('rejects sell date before purchase date', () => {
    const card = createCard({
      purchaseDate: new Date('2024-06-01'),
      sellDate: new Date('2024-01-01'),
    });
    const result = validateCard(card);
    expect(result.errors).toContain('Sell date must be after purchase date');
  });

  it('validates grading company', () => {
    const card = createCard({ gradingCompany: 'FAKE_COMPANY', condition: '10: GEM MINT' });
    const result = validateCard(card);
    expect(result.errors).toContain('Invalid grading company');
  });

  it('requires grading company for graded conditions', () => {
    const card = createCard({ condition: '10: GEM MINT', gradingCompany: undefined });
    const result = validateCard(card);
    expect(result.errors).toContain('Graded cards must have a grading company');
  });

  it('rejects RAW condition with grading company', () => {
    const card = createCard({ condition: 'RAW', gradingCompany: 'PSA' });
    const result = validateCard(card);
    expect(result.errors).toContain('Cards with grading company cannot be RAW');
  });

  it('collects multiple errors at once', () => {
    const card = { player: '', team: '', year: 0, brand: '', category: '', cardNumber: '', condition: '' };
    const result = validateCard(card);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

describe('formatCardNumber', () => {
  it('trims whitespace', () => {
    expect(formatCardNumber('  123  ')).toBe('123');
  });

  it('converts to uppercase', () => {
    expect(formatCardNumber('abc-123')).toBe('ABC-123');
  });

  it('handles already-formatted numbers', () => {
    expect(formatCardNumber('RC-15')).toBe('RC-15');
  });
});

describe('formatPlayerName', () => {
  it('capitalizes each word', () => {
    expect(formatPlayerName('mike trout')).toBe('Mike Trout');
  });

  it('handles all caps', () => {
    expect(formatPlayerName('MIKE TROUT')).toBe('Mike Trout');
  });

  it('trims whitespace', () => {
    expect(formatPlayerName('  Mike Trout  ')).toBe('Mike Trout');
  });
});

describe('suggestCurrentValue', () => {
  it('applies GEM MINT multiplier (2.5x)', () => {
    expect(suggestCurrentValue(100, '10: GEM MINT')).toBe(250);
  });

  it('applies MINT multiplier (1.5x)', () => {
    expect(suggestCurrentValue(100, '9: MINT')).toBe(150);
  });

  it('applies RAW multiplier (0.8x)', () => {
    expect(suggestCurrentValue(100, 'RAW')).toBe(80);
  });

  it('uses 1.0x for unknown conditions', () => {
    expect(suggestCurrentValue(100, 'UNKNOWN')).toBe(100);
  });
});
