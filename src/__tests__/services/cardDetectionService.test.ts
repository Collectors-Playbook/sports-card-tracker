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

  // ---- extractDataFromRegions ----
  describe('extractDataFromRegions', () => {
    const extract = (
      frontRegions: any[],
      backRegions: any[] | undefined,
      fullText: string,
      patterns: Record<string, string[]>
    ) => (service as any).extractDataFromRegions(frontRegions, backRegions, fullText, patterns);

    it('extracts brand from high-confidence top regions', () => {
      const regions = [
        { text: '2023 Topps Chrome', confidence: 0.95, position: 'top', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, '2023 Topps Chrome', { years: ['2023'] });
      expect(result.brand).toBe('Topps');
      expect(result.setName).toBe('2023 Topps Chrome');
    });

    it('skips brand from low-confidence top regions', () => {
      const regions = [
        { text: '2023 Topps Chrome', confidence: 0.8, position: 'top', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, '', { years: ['2023'] });
      expect(result.brand).toBeUndefined();
    });

    it('extracts player from database match in middle region', () => {
      const regions = [
        { text: 'MIKE TROUT', confidence: 0.92, position: 'middle', fontSize: 'large', isBold: true },
      ];
      const result = extract(regions, undefined, 'MIKE TROUT', {});
      expect(result.player).toBe('Mike Trout');
      expect(result.category).toBe('Baseball');
    });

    it('normalizes player name when not in database', () => {
      mockFindPlayer.mockReturnValue(null);
      const regions = [
        { text: 'JOHN SMITH', confidence: 0.92, position: 'middle', fontSize: 'large', isBold: true },
      ];
      const result = extract(regions, undefined, 'JOHN SMITH', {});
      expect(result.player).toBe('John Smith');
    });

    it('extracts team from database match', () => {
      const regions = [
        { text: 'Angels', confidence: 0.94, position: 'middle', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.team).toBe('Angels');
    });

    it('sets category from team when no player found', () => {
      mockFindPlayer.mockReturnValue(null);
      const regions = [
        { text: 'Angels', confidence: 0.94, position: 'middle', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.team).toBe('Angels');
      expect(result.category).toBe('Baseball');
    });

    it('falls back to extractTeam when team not in database', () => {
      mockFindTeam.mockReturnValue(null);
      const regions = [
        { text: '--some team--', confidence: 0.94, position: 'middle', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.team).toBe('Some Team');
    });

    it('extracts card number from bottom region with hash pattern', () => {
      const regions = [
        { text: '#RC-15', confidence: 0.96, position: 'bottom', fontSize: 'small' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.cardNumber).toBe('RC-15');
    });

    it('extracts card number from bottom region with numeric pattern', () => {
      const regions = [
        { text: '123A', confidence: 0.96, position: 'bottom', fontSize: 'small' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.cardNumber).toBe('123A');
    });

    it('falls back to alphanumeric pattern for card number', () => {
      const result = extract([], undefined, '', { alphanumeric: ['RC-15'] });
      expect(result.cardNumber).toBe('RC-15');
    });

    it('extracts year from patterns.years', () => {
      const result = extract([], undefined, '', { years: ['2023-24'] });
      expect(result.year).toBe('2023');
    });

    it('extracts year from fullText fallback', () => {
      const result = extract([], undefined, 'Copyright 2021 Topps', {});
      expect(result.year).toBe('2021');
    });

    it('extracts serial number from fractions', () => {
      const result = extract([], undefined, '', { fractions: ['25/99'] });
      expect(result.serialNumber).toBe('25/99');
      expect(result.printRun).toBe(99);
    });

    it('extracts parallel from regions with parallel indicator', () => {
      const regions = [
        { text: 'GOLD REFRACTOR', confidence: 0.9, position: 'middle', fontSize: 'small' },
      ];
      const result = extract(regions, undefined, '', {});
      expect(result.parallel).toBe('GOLD REFRACTOR');
    });

    it('gets category from brand via getSportFromBrand', () => {
      mockFindPlayer.mockReturnValue(null);
      mockFindTeam.mockReturnValue(null);
      mockGetSportFromBrand.mockReturnValue('Baseball');
      const regions = [
        { text: 'Topps Chrome', confidence: 0.95, position: 'top', fontSize: 'medium' },
      ];
      const result = extract(regions, undefined, 'Topps Chrome', { years: ['2023'] });
      expect(result.category).toBe('Baseball');
    });

    it('falls back to detectCategory when brand lookup returns null', () => {
      mockFindPlayer.mockReturnValue(null);
      mockFindTeam.mockReturnValue(null);
      mockGetSportFromBrand.mockReturnValue(null);
      const result = extract([], undefined, 'MLB BASEBALL HOME RUN', {});
      expect(result.category).toBe('Baseball');
    });

    it('corrects brand when manufacturer validation fails', () => {
      mockValidateManufacturer.mockReturnValue(false);
      mockGetValidManufacturers.mockReturnValue(['Topps']);
      mockGetRealisticManufacturer.mockReturnValue({ manufacturer: 'Topps', set: 'Topps Chrome' });
      const regions = [
        { text: 'Topps Chrome', confidence: 0.95, position: 'top', fontSize: 'medium' },
        { text: 'MIKE TROUT', confidence: 0.92, position: 'middle', fontSize: 'large', isBold: true },
      ];
      const result = extract(regions, undefined, '', { years: ['2023'] });
      expect(result.brand).toContain('Topps Chrome');
    });

    it('detects grading info from high-confidence regions', () => {
      const regions = [
        { text: 'PSA 10', confidence: 0.98, position: 'top', fontSize: 'large' },
      ];
      const result = extract(regions, undefined, 'PSA 10 Cert: 12345678', {});
      expect(result.gradingCompany).toBe('PSA');
      expect(result.grade).toBe('10');
      expect(result.certNumber).toBe('12345678');
    });
  });

  // ---- extractGradingInfo ----
  describe('extractGradingInfo', () => {
    const extractGrade = (regions: any[], text: string) =>
      (service as any).extractGradingInfo(regions, text);

    it('extracts PSA grade', () => {
      expect(extractGrade([{ text: 'PSA 10', confidence: 0.98 }], '')).toEqual({ company: 'PSA', grade: '10' });
    });

    it('extracts BGS grade with decimal', () => {
      expect(extractGrade([{ text: 'BGS 9.5', confidence: 0.96 }], '')).toEqual({ company: 'BGS', grade: '9.5' });
    });

    it('extracts SGC grade', () => {
      expect(extractGrade([{ text: 'SGC 10', confidence: 0.97 }], '')).toEqual({ company: 'SGC', grade: '10' });
    });

    it('extracts CGC grade', () => {
      expect(extractGrade([{ text: 'CGC 9', confidence: 0.96 }], '')).toEqual({ company: 'CGC', grade: '9' });
    });

    it('includes cert number when present', () => {
      const result = extractGrade([{ text: 'PSA 10', confidence: 0.98 }], 'Cert: 12345678');
      expect(result.certNumber).toBe('12345678');
    });

    it('returns null for low-confidence regions', () => {
      expect(extractGrade([{ text: 'PSA 10', confidence: 0.9 }], '')).toBeNull();
    });

    it('returns null when no grade pattern matches', () => {
      expect(extractGrade([{ text: 'No grade', confidence: 0.98 }], '')).toBeNull();
    });
  });

  // ---- combineExtractedText ----
  describe('combineExtractedText', () => {
    const combine = (front: any, back: any) =>
      (service as any).combineExtractedText(front, back);

    it('returns front text when no back image', () => {
      expect(combine({ fullText: 'front text' }, null)).toBe('front text');
    });

    it('combines front and back with separator', () => {
      const result = combine({ fullText: 'front' }, { fullText: 'back' });
      expect(result).toContain('front');
      expect(result).toContain('--- BACK OF CARD ---');
      expect(result).toContain('back');
    });
  });

  // ---- extractTeam ----
  describe('extractTeam', () => {
    const extractTeam = (text: string) => (service as any).extractTeam(text);

    it('cleans and title-cases team text', () => {
      expect(extractTeam('  los angeles angels  ')).toBe('Los Angeles Angels');
    });

    it('removes leading/trailing non-word chars', () => {
      expect(extractTeam('--yankees--')).toBe('Yankees');
    });
  });

  // ---- extractCardNumber ----
  describe('extractCardNumber', () => {
    const extractNum = (text: string) => (service as any).extractCardNumber(text);

    it('removes Card # prefix', () => {
      expect(extractNum('Card #15')).toBe('15');
    });

    it('removes # prefix', () => {
      expect(extractNum('#RC-15')).toBe('RC-15');
    });

    it('keeps plain number', () => {
      expect(extractNum('123')).toBe('123');
    });
  });

  // ---- detectCategory (stats-based) ----
  describe('detectCategory - stats patterns', () => {
    const detectCat = (text: string, patterns: Record<string, string[]> = {}) =>
      (service as any).detectCategory(text, patterns);

    it('detects Basketball from stats', () => {
      expect(detectCat('some text', { stats: ['25.3 PPG 8.2 RPG'] })).toBe('Basketball');
    });

    it('detects Football from stats', () => {
      expect(detectCat('some text', { stats: ['35 TD 4500 YDS'] })).toBe('Football');
    });
  });

  // ---- findPlayerName ----
  describe('findPlayerName', () => {
    const findName = (lines: string[]) => (service as any).findPlayerName(lines);

    it('matches First Last pattern', () => {
      expect(findName(['Mike Trout'])).toBe('Mike Trout');
    });

    it('converts ALL CAPS two-word names', () => {
      expect(findName(['MIKE TROUT'])).toBe('Mike Trout');
    });

    it('skips short lines (< 3 chars)', () => {
      expect(findName(['Ab'])).toBeUndefined();
    });

    it('skips pure numbers', () => {
      expect(findName(['12345'])).toBeUndefined();
    });

    it('skips lines with #', () => {
      expect(findName(['#RC-15'])).toBeUndefined();
    });

    it('returns undefined when no name pattern matches', () => {
      expect(findName(['random text stuff'])).toBeUndefined();
    });
  });

  // ---- findTeamName ----
  describe('findTeamName', () => {
    const findTeam = (lines: string[]) => (service as any).findTeamName(lines);

    it('finds MLB teams', () => {
      expect(findTeam(['Los Angeles Angels'])).toBe('Los Angeles Angels');
    });

    it('finds NBA teams', () => {
      expect(findTeam(['Golden State Warriors'])).toBe('Golden State Warriors');
    });

    it('finds NFL teams', () => {
      expect(findTeam(['Kansas City Chiefs'])).toBe('Kansas City Chiefs');
    });

    it('returns undefined for unknown teams', () => {
      expect(findTeam(['Unknown Organization'])).toBeUndefined();
    });
  });

  // ---- findParallel ----
  describe('findParallel', () => {
    const findPar = (text: string) => (service as any).findParallel(text);

    it('finds refractor parallel on matching line', () => {
      expect(findPar('2023 Topps Chrome\nGOLD REFRACTOR\n#15')).toBe('GOLD REFRACTOR');
    });

    it('finds prizm parallel', () => {
      expect(findPar('SILVER PRIZM')).toBe('SILVER PRIZM');
    });

    it('returns undefined for no parallel', () => {
      expect(findPar('Just a base card')).toBeUndefined();
    });
  });

  // ---- extractDataFromText (deprecated) ----
  describe('extractDataFromText', () => {
    const extractFromText = (text: string) => (service as any).extractDataFromText(text);

    it('extracts year', () => {
      expect(extractFromText('2023 Topps Chrome').year).toBe('2023');
    });

    it('extracts year-range format', () => {
      expect(extractFromText('2019-20 Panini Prizm').year).toBe('2019');
    });

    it('extracts brand and setName', () => {
      const result = extractFromText('2023 Topps Chrome\nMIKE TROUT\nAngels\n#1');
      expect(result.brand).toBe('Topps');
      expect(result.setName).toContain('Topps');
    });

    it('extracts player from ALL CAPS line', () => {
      const result = extractFromText('2023 Topps Chrome\nMIKE TROUT\nAngels\n#1');
      expect(result.player).toBeDefined();
    });

    it('extracts team name', () => {
      const result = extractFromText('2023 Topps Chrome\nMIKE TROUT\nLos Angeles Angels\n#1');
      expect(result.team).toContain('Angels');
    });

    it('extracts serial number', () => {
      const result = extractFromText('25/99 Serial Numbered');
      expect(result.serialNumber).toBe('25/99');
      expect(result.printRun).toBe(99);
    });

    it('extracts grading info with cert number', () => {
      const result = extractFromText('PSA 10 GEM MINT Cert: 12345678');
      expect(result.gradingCompany).toBe('PSA');
      expect(result.grade).toBe('10');
      expect(result.certNumber).toBe('12345678');
    });

    it('extracts parallel', () => {
      expect(extractFromText('GOLD REFRACTOR\n#15').parallel).toBeDefined();
    });

    it('detects sport category', () => {
      const result = extractFromText('NBA BASKETBALL REBOUNDS ASSISTS\nLeBron James\nLakers');
      expect(result.category).toBe('Basketball');
    });
  });

  // ---- calculateConfidence (deprecated) ----
  describe('calculateConfidence', () => {
    const calcConf = (data: any, features: any) =>
      (service as any).calculateConfidence(data, features);

    it('gives high confidence with many fields', () => {
      const data = {
        player: 'X', year: '2023', brand: 'Topps', cardNumber: '1',
        team: 'Angels', category: 'Baseball', setName: 'Chrome',
        parallel: 'Gold', serialNumber: '25/99',
      };
      const features = { isRookie: true, isAutograph: true, isRelic: true, isNumbered: true, isGraded: true, isParallel: false };
      const result = calcConf(data, features);
      expect(result.level).toBe('high');
    });

    it('gives low confidence with no fields', () => {
      const features = { isRookie: false, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false };
      const result = calcConf({}, features);
      expect(result.level).toBe('low');
    });
  });

  // ---- generateMockOCRText (deprecated) ----
  describe('generateMockOCRText', () => {
    it('returns a non-empty string', () => {
      const result = (service as any).generateMockOCRText();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ---- detectCard - real OCR paths ----
  describe('detectCard - real OCR paths', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.REACT_APP_USE_REAL_OCR;
      jest.spyOn(service as any, 'simulateProcessing').mockResolvedValue(undefined);
    });

    afterEach(() => {
      process.env.REACT_APP_USE_REAL_OCR = originalEnv;
      localStorage.removeItem('useRealOCR');
      jest.restoreAllMocks();
    });

    it('uses real OCR when env var is set', async () => {
      process.env.REACT_APP_USE_REAL_OCR = 'true';
      const { realOCRService } = require('../../services/realOCRService');
      realOCRService.processCardImages.mockResolvedValueOnce({
        player: 'OCR Player',
        confidence: { score: 90, level: 'high', detectedFields: 5 },
        features: { isRookie: false, isAutograph: false, isRelic: false, isNumbered: false, isGraded: false, isParallel: false },
      });

      const result = await service.detectCard('front');
      expect(result.player).toBe('OCR Player');
      expect(realOCRService.processCardImages).toHaveBeenCalledWith('front', undefined);
    });

    it('falls back to simulation when real OCR fails', async () => {
      process.env.REACT_APP_USE_REAL_OCR = 'true';
      const { realOCRService } = require('../../services/realOCRService');
      realOCRService.processCardImages.mockRejectedValueOnce(new Error('OCR failed'));

      const result = await service.detectCard('front');
      expect(result.confidence).toBeDefined();
      expect(result.rawText).toBeDefined();
    });

    it('uses real OCR when localStorage flag is set', async () => {
      delete process.env.REACT_APP_USE_REAL_OCR;
      localStorage.setItem('useRealOCR', 'true');
      const { realOCRService } = require('../../services/realOCRService');
      realOCRService.processCardImages.mockResolvedValueOnce({
        player: 'LS OCR Player',
        confidence: { score: 85, level: 'high', detectedFields: 4 },
        features: {},
      });

      const result = await service.detectCard('front');
      expect(result.player).toBe('LS OCR Player');
    });
  });
});
