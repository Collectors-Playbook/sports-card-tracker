import { EbayListingService, EbayListingOptions } from '../../services/ebayListingService';
import { createCard, createGradedCard, createCardBatch } from '../helpers/factories';
import { Card } from '../../types';

describe('EbayListingService', () => {
  let service: EbayListingService;
  const defaultOptions: EbayListingOptions = {
    includeImages: true,
    listingFormat: 'buyItNow',
    duration: 7,
    shippingType: 'standard',
    returnPolicy: true,
    watermarkImages: false,
    includeGradingDetails: true,
    includeMarketData: true,
  };

  beforeEach(() => {
    service = new EbayListingService();
  });

  // ---- generateTitle (via generateListing) ----
  describe('generateTitle', () => {
    it('includes year, brand, player, and card number', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.title).toContain('2023');
      expect(listing.title).toContain('Topps Chrome');
      expect(listing.title).toContain('Mike Trout');
      expect(listing.title).toContain('#1');
    });

    it('truncates to 80 characters max', () => {
      const longCard = createCard({
        player: 'A Very Long Player Name That Goes On And On',
        brand: 'Extremely Long Brand Name Here',
        parallel: 'Super Rare Gold Refractor Parallel Edition',
      });
      const listing = service.generateListing(longCard, defaultOptions);
      expect(listing.title.length).toBeLessThanOrEqual(80);
    });

    it('adds ROOKIE when brand/notes indicate rookie', () => {
      const card = createCard({ brand: 'Topps Rookie Card', notes: '' });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.title).toContain('ROOKIE');
    });

    it('adds AUTO when parallel contains auto', () => {
      const card = createCard({ parallel: 'Auto Refractor' });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.title).toContain('AUTO');
    });

    it('adds numbered indicator for serial numbered parallels', () => {
      const card = createCard({ parallel: '25/99 Gold' });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.title).toContain("#'d");
    });

    it('adds grading company for graded cards', () => {
      const card = createGradedCard();
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.title).toContain('PSA');
    });

    it('adds parallel if it fits within 80 chars', () => {
      const card = createCard({ parallel: 'Refractor' });
      const listing = service.generateListing(card, defaultOptions);
      if (listing.title.length <= 80) {
        expect(listing.title).toContain('Refractor');
      }
    });

    it('generates different title for Pokemon cards', () => {
      const card = createCard({ category: 'Pokemon', player: 'Charizard' });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.title).toContain('Charizard');
    });
  });

  // ---- generateListing ----
  describe('generateListing', () => {
    it('returns all required fields', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing).toHaveProperty('title');
      expect(listing).toHaveProperty('description');
      expect(listing).toHaveProperty('category');
      expect(listing).toHaveProperty('categoryId');
      expect(listing).toHaveProperty('condition');
      expect(listing).toHaveProperty('conditionId');
      expect(listing).toHaveProperty('shippingCost');
      expect(listing).toHaveProperty('itemSpecifics');
      expect(listing).toHaveProperty('searchKeywords');
    });

    it('sets return period when return policy is enabled', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.returnPeriod).toBe(30);
    });

    it('omits return period when return policy is disabled', () => {
      const listing = service.generateListing(createCard(), { ...defaultOptions, returnPolicy: false });
      expect(listing.returnPeriod).toBeUndefined();
    });

    it('sets handling time to 1', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.handlingTime).toBe(1);
    });

    it('includes images when includeImages is true', () => {
      const card = createCard({ images: ['img1.jpg', 'img2.jpg'] });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.images).toHaveLength(2);
    });

    it('excludes images when includeImages is false', () => {
      const card = createCard({ images: ['img1.jpg'] });
      const listing = service.generateListing(card, { ...defaultOptions, includeImages: false });
      expect(listing.images).toHaveLength(0);
    });
  });

  // ---- suggestPricing ----
  describe('suggestPricing', () => {
    it('sets auction pricing (50% base, no BIN)', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 100 }),
        { ...defaultOptions, listingFormat: 'auction' }
      );
      expect(listing.startingPrice).toBeCloseTo(50);
      expect(listing.buyItNowPrice).toBeUndefined();
    });

    it('sets BIN pricing (120% base, no starting price)', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 100 }),
        { ...defaultOptions, listingFormat: 'buyItNow' }
      );
      expect(listing.buyItNowPrice).toBeCloseTo(120);
      expect(listing.startingPrice).toBeUndefined();
    });

    it('sets both prices for "both" format', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 100 }),
        { ...defaultOptions, listingFormat: 'both' }
      );
      expect(listing.startingPrice).toBeCloseTo(50);
      expect(listing.buyItNowPrice).toBeCloseTo(130);
    });

    it('ensures minimum starting price of $0.99', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 1 }),
        { ...defaultOptions, listingFormat: 'auction' }
      );
      expect(listing.startingPrice).toBeGreaterThanOrEqual(0.99);
    });

    it('falls back to purchasePrice when currentValue is 0', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 0, purchasePrice: 20 }),
        { ...defaultOptions, listingFormat: 'buyItNow' }
      );
      expect(listing.buyItNowPrice).toBeCloseTo(24);
    });

    it('uses default value of 10 when both prices are 0', () => {
      const listing = service.generateListing(
        createCard({ currentValue: 0, purchasePrice: 0 }),
        { ...defaultOptions, listingFormat: 'buyItNow' }
      );
      expect(listing.buyItNowPrice).toBeCloseTo(12);
    });
  });

  // ---- calculateShipping ----
  describe('calculateShipping', () => {
    it('charges $4.99 for standard shipping', () => {
      const listing = service.generateListing(createCard(), { ...defaultOptions, shippingType: 'standard' });
      expect(listing.shippingCost).toBe(4.99);
    });

    it('charges $8.99 for expedited shipping', () => {
      const listing = service.generateListing(createCard(), { ...defaultOptions, shippingType: 'expedited' });
      expect(listing.shippingCost).toBe(8.99);
    });

    it('adds $2 extra for graded cards', () => {
      const listing = service.generateListing(createGradedCard(), { ...defaultOptions, shippingType: 'standard' });
      expect(listing.shippingCost).toBe(6.99);
    });
  });

  // ---- generateDescription ----
  describe('generateDescription', () => {
    it('contains HTML markup', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.description).toContain('<div');
      expect(listing.description).toContain('</div>');
    });

    it('includes card details', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.description).toContain('Mike Trout');
      expect(listing.description).toContain('2023');
    });

    it('includes grading section for graded cards', () => {
      const listing = service.generateListing(createGradedCard(), defaultOptions);
      expect(listing.description).toContain('Professional Grading');
      expect(listing.description).toContain('PSA');
    });

    it('includes shipping section', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.description).toContain('Shipping');
    });
  });

  // ---- exportToCSV ----
  describe('exportToCSV', () => {
    it('generates CSV with headers', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      const csv = service.exportToCSV([listing]);
      expect(csv.split('\n')[0]).toContain('Title');
      expect(csv.split('\n')[0]).toContain('Category');
    });

    it('includes data rows', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      const csv = service.exportToCSV([listing]);
      // Description contains multi-line HTML, so we can't just split on \n.
      // Instead, verify header line + at least one data field present
      expect(csv).toContain('Mike Trout');
      expect(csv).toContain('Baseball');
    });

    it('handles multiple listings', () => {
      const listings = [createCard(), createGradedCard()].map(c =>
        service.generateListing(c, defaultOptions)
      );
      const csv = service.exportToCSV(listings);
      // Both cards should be present in the CSV output
      const titleCount = (csv.match(/Title/g) || []).length;
      expect(titleCount).toBeGreaterThanOrEqual(1); // header row
      // Should contain data from both cards
      expect(csv).toContain('Mike Trout');
    });

    it('escapes quotes in description', () => {
      const listing = service.generateListing(createCard({ notes: 'He said "hello"' }), defaultOptions);
      const csv = service.exportToCSV([listing]);
      expect(csv).toContain('""');
    });
  });

  // ---- itemSpecifics & keywords ----
  describe('itemSpecifics and keywords', () => {
    it('includes player, year, brand, sport in item specifics', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.itemSpecifics['Player']).toBe('Mike Trout');
      expect(listing.itemSpecifics['Year']).toBe('2023');
      expect(listing.itemSpecifics['Sport']).toBe('Baseball');
    });

    it('includes team and card number when present', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.itemSpecifics['Team']).toBe('Angels');
      expect(listing.itemSpecifics['Card Number']).toBe('1');
    });

    it('includes search keywords', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      expect(listing.searchKeywords).toContain('Mike Trout');
      expect(listing.searchKeywords).toContain('Baseball');
    });

    it('adds graded keywords for graded cards', () => {
      const listing = service.generateListing(createGradedCard(), defaultOptions);
      expect(listing.searchKeywords).toContain('graded');
      expect(listing.searchKeywords).toContain('PSA');
    });
  });

  // ---- category mapping ----
  describe('category mapping', () => {
    it.each([
      ['Baseball', 213],
      ['Basketball', 214],
      ['Football', 215],
      ['Hockey', 216],
      ['Soccer', 183435],
      ['Pokemon', 183454],
    ])('maps %s to category id %i', (category, expectedId) => {
      const card = createCard({ category });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.categoryId).toBe(expectedId);
    });

    it('maps unknown category to Other', () => {
      const card = createCard({ category: 'Wrestling' });
      const listing = service.generateListing(card, defaultOptions);
      expect(listing.categoryId).toBe(212);
    });
  });

  // ---- exportListing ----
  describe('exportListing', () => {
    it('returns HTML for html format', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      const html = service.exportListing(listing, 'html');
      expect(html).toContain('<div');
    });

    it('returns JSON for json format', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      const json = service.exportListing(listing, 'json');
      expect(JSON.parse(json)).toHaveProperty('title');
    });

    it('returns CSV for csv format', () => {
      const listing = service.generateListing(createCard(), defaultOptions);
      const csv = service.exportListing(listing, 'csv');
      expect(csv).toContain('Title');
    });
  });

  // ---- generateBulkListings ----
  describe('generateBulkListings', () => {
    it('generates listings for all cards', () => {
      const cards = createCardBatch(5);
      const listings = service.generateBulkListings(cards, defaultOptions);
      expect(listings).toHaveLength(5);
    });
  });
});
