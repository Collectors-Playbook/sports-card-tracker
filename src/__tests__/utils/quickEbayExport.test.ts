import { quickExportAllUnsoldCards, generateExportSummary } from '../../utils/quickEbayExport';
import { createCard, createSoldCard, createCardBatch, createGradedCard } from '../helpers/factories';

// Mock DOM APIs
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

beforeEach(() => {
  jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      return { href: '', download: '', click: mockClick } as any;
    }
    return document.createElement(tag);
  });
  jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  (URL.createObjectURL as jest.Mock) = jest.fn(() => 'blob:mock');
  (URL.revokeObjectURL as jest.Mock) = jest.fn();
  window.alert = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('quickExportAllUnsoldCards', () => {
  it('filters out sold cards', () => {
    const cards = [createCard(), createSoldCard(), createCard()];
    const result = quickExportAllUnsoldCards(cards);
    expect(result!.count).toBe(2);
  });

  it('alerts and returns undefined when no unsold cards', () => {
    const cards = [createSoldCard()];
    const result = quickExportAllUnsoldCards(cards);
    expect(window.alert).toHaveBeenCalledWith('No unsold cards to export!');
    expect(result).toBeUndefined();
  });

  it('creates a downloadable file', () => {
    quickExportAllUnsoldCards([createCard()]);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('returns success result with count and value', () => {
    const result = quickExportAllUnsoldCards(createCardBatch(3));
    expect(result!.success).toBe(true);
    expect(result!.count).toBe(3);
    expect(result!.totalValue).toBeGreaterThan(0);
    expect(result!.filename).toContain('ebay-all-unsold-cards');
  });

  it('uses email when provided', () => {
    quickExportAllUnsoldCards([createCard()], 'user@test.com');
    // Should not throw and should complete successfully
    expect(mockClick).toHaveBeenCalled();
  });
});

describe('generateExportSummary', () => {
  it('counts unsold cards only', () => {
    const cards = [createCard(), createSoldCard(), createCard()];
    const summary = generateExportSummary(cards);
    expect(summary.totalUnsoldCards).toBe(2);
  });

  it('breaks down by category', () => {
    const cards = [
      createCard({ category: 'Baseball' }),
      createCard({ category: 'Basketball' }),
      createCard({ category: 'Baseball' }),
    ];
    const summary = generateExportSummary(cards);
    expect(summary.byCategory['Baseball']).toBe(2);
    expect(summary.byCategory['Basketball']).toBe(1);
  });

  it('identifies highest and lowest value cards', () => {
    const cards = [
      createCard({ currentValue: 10 }),
      createCard({ currentValue: 500 }),
      createCard({ currentValue: 50 }),
    ];
    const summary = generateExportSummary(cards);
    expect(summary.highestValue!.currentValue).toBe(500);
    expect(summary.lowestValue!.currentValue).toBe(10);
  });
});
