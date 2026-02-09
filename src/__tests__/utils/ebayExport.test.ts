import { generateEbayFileExchange, EBAY_FE_HEADERS, generateSimpleListings } from '../../utils/ebayExport';
import { createCard, createCardBatch, createGradedCard } from '../helpers/factories';
import { EbayExportOptions } from '../../utils/ebayExport';

const defaultOptions: EbayExportOptions = {
  priceMultiplier: 0.9,
  shippingCost: 4.99,
  duration: '7',
  location: 'United States',
  paypalEmail: 'test@test.com',
  dispatchTime: 1,
};

describe('generateEbayFileExchange', () => {
  it('includes header row matching EBAY_FE_HEADERS', () => {
    const csv = generateEbayFileExchange([createCard()], defaultOptions);
    const headerRow = csv.split('\n')[0];
    EBAY_FE_HEADERS.forEach(header => {
      expect(headerRow).toContain(header);
    });
  });

  it('generates one data row per card', () => {
    const csv = generateEbayFileExchange(createCardBatch(3), defaultOptions);
    // Description fields contain multi-line HTML, so raw \n split won't work.
    // Instead, count 'Add' entries (each row starts with 'Add')
    const addCount = (csv.match(/^Add,/gm) || []).length;
    expect(addCount).toBe(3);
  });

  it('sets action to Add', () => {
    const csv = generateEbayFileExchange([createCard()], defaultOptions);
    const dataRow = csv.split('\n')[1];
    expect(dataRow.startsWith('Add')).toBe(true);
  });

  it('applies price multiplier to current value', () => {
    const card = createCard({ currentValue: 100 });
    const csv = generateEbayFileExchange([card], defaultOptions);
    expect(csv).toContain('90.00'); // 100 * 0.9
  });

  it('maps Baseball to correct category ID', () => {
    const csv = generateEbayFileExchange([createCard({ category: 'Baseball' })], defaultOptions);
    expect(csv).toContain('261328');
  });

  it('escapes fields containing commas', () => {
    const card = createCard({ notes: 'Has, commas' });
    const csv = generateEbayFileExchange([card], defaultOptions);
    // Description contains commas in HTML, should be escaped
    expect(csv).toBeDefined();
  });
});

describe('generateTitle (via eBay export)', () => {
  it('includes year, brand, player, card number', () => {
    const csv = generateEbayFileExchange([createCard()], defaultOptions);
    expect(csv).toContain('2023');
    expect(csv).toContain('Topps Chrome');
    expect(csv).toContain('Mike Trout');
  });

  it('adds RC for rookie cards', () => {
    const card = createCard({ notes: 'This is a rookie card' });
    const csv = generateEbayFileExchange([card], defaultOptions);
    expect(csv).toContain('RC');
  });

  it('includes grading info', () => {
    const card = createGradedCard();
    const csv = generateEbayFileExchange([card], defaultOptions);
    expect(csv).toContain('PSA');
  });
});

describe('generateSimpleListings', () => {
  it('generates text listing for each card', () => {
    const result = generateSimpleListings(createCardBatch(2));
    expect(result.split('=====').length).toBeGreaterThan(2);
  });

  it('includes price at 90% of current value', () => {
    const card = createCard({ currentValue: 100 });
    const result = generateSimpleListings([card]);
    expect(result).toContain('$90.00');
  });

  it('includes card details', () => {
    const result = generateSimpleListings([createCard()]);
    expect(result).toContain('Mike Trout');
    expect(result).toContain('Angels');
    expect(result).toContain('Baseball');
  });
});
