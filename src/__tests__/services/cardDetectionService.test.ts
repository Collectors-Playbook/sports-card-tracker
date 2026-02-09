import { CardDetectionService } from '../../services/cardDetectionService';

// CRA sets resetMocks: true, so jest.fn(impl) inside jest.mock factories get reset.
// Use wrapper functions that delegate to re-settable jest.fn() mocks.
const mockExtractText = jest.fn();
const mockCleanText = jest.fn();
const mockExtractPatterns = jest.fn();
const mockFindPlayer = jest.fn();
const mockFindTeam = jest.fn();
const mockGetSportFromBrand = jest.fn();
const mockValidateManufacturer = jest.fn();
const mockGetValidManufacturers = jest.fn();
const mockGetRealisticManufacturer = jest.fn();

jest.mock('../../services/textExtractionService', () => ({
  textExtractionService: {
    extractText: (...args: any[]) => mockExtractText(...args),
    cleanText: (...args: any[]) => mockCleanText(...args),
    extractPatterns: (...args: any[]) => mockExtractPatterns(...args),
  },
}));

jest.mock('../../services/playerDatabase', () => ({
  playerDatabase: {
    findPlayer: (...args: any[]) => mockFindPlayer(...args),
    findTeam: (...args: any[]) => mockFindTeam(...args),
    getSportFromBrand: (...args: any[]) => mockGetSportFromBrand(...args),
  },
}));

jest.mock('../../services/manufacturerDatabase', () => ({
  manufacturerDatabase: {
    validateManufacturer: (...args: any[]) => mockValidateManufacturer(...args),
    getValidManufacturers: (...args: any[]) => mockGetValidManufacturers(...args),
    getRealisticManufacturer: (...args: any[]) => mockGetRealisticManufacturer(...args),
  },
}));

jest.mock('../../services/realOCRService', () => ({
  realOCRService: {
    processCardImages: jest.fn(),
  },
}));

const setupMockImplementations = () => {
  mockExtractText.mockImplementation((_img: string, _type: string) => ({
    regions: [
      { text: '2023 Topps Chrome', confidence: 0.95, position: 'top', fontSize: 'medium' },
      { text: 'MIKE TROUT', confidence: 0.92, position: 'middle', fontSize: 'large', isBold: true },
      { text: 'Angels', confidence: 0.94, position: 'middle', fontSize: 'medium' },
      { text: '#1', confidence: 0.96, position: 'bottom', fontSize: 'small' },
    ],
    fullText: '2023 Topps Chrome\nMIKE TROUT\nAngels\n#1',
    language: 'en',
    orientation: 0,
  }));
  mockCleanText.mockImplementation((text: string) => text.replace(/\s+/g, ' ').trim());
  mockExtractPatterns.mockImplementation(() => ({ years: ['2023'], alphanumeric: ['1'] }));
  mockFindPlayer.mockImplementation((name: string) => {
    if (name.toUpperCase().includes('TROUT')) {
      return { name: 'Mike Trout', sport: 'Baseball', teams: ['Angels'], years: ['2011-2024'], position: 'OF', rookie: '2011' };
    }
    return null;
  });
  mockFindTeam.mockImplementation((name: string) => {
    if (name.toUpperCase().includes('ANGELS')) {
      return { name: 'Angels', sport: 'Baseball', city: 'Los Angeles', abbreviations: ['LAA'] };
    }
    return null;
  });
  mockGetSportFromBrand.mockReturnValue('Baseball');
  mockValidateManufacturer.mockReturnValue(true);
  mockGetValidManufacturers.mockReturnValue(['Topps']);
  mockGetRealisticManufacturer.mockReturnValue({ manufacturer: 'Topps', set: 'Topps Chrome' });
};

describe('CardDetectionService', () => {
  let service: CardDetectionService;

  beforeEach(() => {
    setupMockImplementations();
    service = new CardDetectionService();
  });

  // ---- detectSpecialFeatures ----
  describe('detectSpecialFeatures', () => {
    // Access private method via prototype
    const detect = (text: string) => (service as any).detectSpecialFeatures(text);

    it('detects rookie indicators', () => {
      expect(detect('ROOKIE CARD').isRookie).toBe(true);
      expect(detect('RC 2023').isRookie).toBe(true);
      expect(detect('FIRST YEAR').isRookie).toBe(true);
    });

    it('detects autograph indicators', () => {
      expect(detect('ON-CARD AUTO').isAutograph).toBe(true);
      expect(detect('CERTIFIED AUTOGRAPH').isAutograph).toBe(true);
    });

    it('detects relic indicators', () => {
      expect(detect('GAME-USED JERSEY').isRelic).toBe(true);
      expect(detect('PATCH CARD').isRelic).toBe(true);
    });

    it('detects numbered cards', () => {
      expect(detect('25/99').isNumbered).toBe(true);
      expect(detect('LIMITED TO 50').isNumbered).toBe(true);
    });

    it('detects graded cards', () => {
      expect(detect('PSA 10').isGraded).toBe(true);
      expect(detect('BGS 9.5').isGraded).toBe(true);
    });

    it('detects parallel cards', () => {
      expect(detect('REFRACTOR').isParallel).toBe(true);
      expect(detect('GOLD PRIZM').isParallel).toBe(true);
      expect(detect('SAPPHIRE').isParallel).toBe(true);
    });

    it('returns false for plain text', () => {
      const features = detect('Just a regular base card');
      expect(features.isRookie).toBe(false);
      expect(features.isAutograph).toBe(false);
      expect(features.isRelic).toBe(false);
    });

    it('detects multiple features at once', () => {
      const features = detect('PSA 10 ROOKIE AUTO REFRACTOR 25/99');
      expect(features.isRookie).toBe(true);
      expect(features.isAutograph).toBe(true);
      expect(features.isGraded).toBe(true);
      expect(features.isParallel).toBe(true);
      expect(features.isNumbered).toBe(true);
    });
  });

  // ---- matchBrand ----
  describe('matchBrand', () => {
    const match = (text: string) => (service as any).matchBrand(text);

    it('matches Topps', () => {
      expect(match('2023 Topps Chrome')).toEqual({ brand: 'Topps', setName: '2023 Topps Chrome' });
    });

    it('matches Panini', () => {
      expect(match('Panini Prizm')).toEqual({ brand: 'Panini', setName: 'Panini Prizm' });
    });

    it('matches Bowman (via Topps parent)', () => {
      // BRAND_PATTERNS lists BOWMAN under Topps first, so Bowman Chrome matches Topps
      const result = match('Bowman Chrome');
      expect(result).toBeTruthy();
      expect(result.setName).toBe('Bowman Chrome');
    });

    it('matches Upper Deck', () => {
      expect(match('Upper Deck')).toEqual({ brand: 'Upper Deck', setName: 'Upper Deck' });
    });

    it('returns null for unknown brands', () => {
      expect(match('Unknown Brand')).toBeNull();
    });
  });

  // ---- normalizePlayerName ----
  describe('normalizePlayerName', () => {
    const normalize = (text: string) => (service as any).normalizePlayerName(text);

    it('converts all caps to proper case', () => {
      expect(normalize('MIKE TROUT')).toBe('Mike Trout');
    });

    it('properly cases short suffixes (Jr. Sr.)', () => {
      // normalizePlayerName converts ALL_CAPS to proper case.
      // "JR." (3 chars with period) gets length check on "JR." which is > 2,
      // so it becomes "Jr."
      expect(normalize('KEN GRIFFEY JR.')).toBe('Ken Griffey Jr.');
    });

    it('trims extra spaces', () => {
      expect(normalize('  Mike   Trout  ')).toBe('Mike Trout');
    });

    it('preserves proper case names', () => {
      expect(normalize('Mike Trout')).toBe('Mike Trout');
    });
  });

  // ---- detectCategory ----
  describe('detectCategory', () => {
    const detectCat = (text: string, patterns: Record<string, string[]> = {}) =>
      (service as any).detectCategory(text, patterns);

    it('detects Baseball from keywords', () => {
      expect(detectCat('MLB BASEBALL HOME RUN')).toBe('Baseball');
    });

    it('detects Basketball from keywords', () => {
      expect(detectCat('NBA BASKETBALL REBOUNDS ASSISTS')).toBe('Basketball');
    });

    it('detects Football from keywords', () => {
      expect(detectCat('NFL FOOTBALL TOUCHDOWN')).toBe('Football');
    });

    it('detects from stats patterns', () => {
      expect(detectCat('some text', { stats: ['.300 AVG 30 HR 100 RBI'] })).toBe('Baseball');
    });

    it('returns Other for unrecognized text', () => {
      expect(detectCat('nothing specific')).toBe('Other');
    });
  });

  // ---- calculateExtractionConfidence ----
  describe('confidence scoring', () => {
    const calcConfidence = (data: any, features: any, regions: any[]) =>
      (service as any).calculateExtractionConfidence(data, features, regions);

    it('gives high confidence when all fields present', () => {
      const data = { player: 'X', year: '2023', brand: 'Topps', cardNumber: '1', team: 'Angels', category: 'Baseball', setName: 'Chrome' };
      const features = { isRookie: true, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false };
      const regions = [{ confidence: 0.95 }, { confidence: 0.92 }];
      const result = calcConfidence(data, features, regions);
      expect(result.level).toBe('high');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('gives low confidence when many fields missing', () => {
      const data = { player: 'Unknown' };
      const features = { isRookie: false, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false };
      const regions = [{ confidence: 0.5 }];
      const result = calcConfidence(data, features, regions);
      expect(result.level).toBe('low');
    });

    it('adds warnings for low-confidence regions', () => {
      const data = { player: 'X' };
      const features = { isRookie: false, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false };
      const regions = [{ confidence: 0.5 }];
      const result = calcConfidence(data, features, regions);
      expect(result.warnings).toContain('Some text regions have low confidence');
    });

    it('lists missing important fields', () => {
      const data = { player: 'X' };
      const features = { isRookie: false, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false };
      const regions: any[] = [];
      const result = calcConfidence(data, features, regions);
      expect(result.missingFields).toContain('year');
      expect(result.missingFields).toContain('brand');
    });
  });

  // ---- validateExtraction ----
  describe('validateExtraction', () => {
    const validate = (data: any) => (service as any).validateExtraction(data);

    it('returns undefined for valid data', () => {
      expect(validate({ year: '2023' })).toBeUndefined();
    });

    it('reports invalid year', () => {
      const errors = validate({ year: '1800' });
      expect(errors).toContain('Invalid year: 1800');
    });

    it('reports invalid serial number', () => {
      const errors = validate({ serialNumber: '100/50', printRun: 50 });
      expect(errors).toContain('Invalid serial number: 100 > 50');
    });

    it('reports future year as invalid', () => {
      const futureYear = (new Date().getFullYear() + 10).toString();
      const errors = validate({ year: futureYear });
      expect(errors).toEqual(expect.arrayContaining([expect.stringContaining('Invalid year')]));
    });
  });

  // ---- detectCard (integration with mocks) ----
  describe('detectCard', () => {
    beforeEach(() => {
      // Skip the simulated processing delay
      jest.spyOn(service as any, 'simulateProcessing').mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns extracted card data', async () => {
      const result = await service.detectCard('base64image');
      expect(result.player).toBe('Mike Trout');
      expect(result.category).toBe('Baseball');
      expect(result.confidence).toBeDefined();
      expect(result.rawText).toBeDefined();
    });

    it('combines front and back extraction', async () => {
      const result = await service.detectCard('front', 'back');
      expect(result.rawText).toContain('MIKE TROUT');
    });
  });
});
