import CardParserService from '../../services/cardParserService';

describe('CardParserService', () => {
  let parser: CardParserService;

  beforeEach(() => {
    parser = new CardParserService();
  });

  describe('year extraction', () => {
    it('extracts 4-digit year from text', () => {
      const result = parser.parseText('2023 Topps Chrome Mike Trout');
      expect(result.year).toBe('2023');
    });

    it('extracts vintage year', () => {
      const result = parser.parseText('1989 Upper Deck Ken Griffey Jr.');
      expect(result.year).toBe('1989');
    });

    it('returns undefined when no year present', () => {
      const result = parser.parseText('Topps Chrome Some Player');
      expect(result.year).toBeUndefined();
    });
  });

  describe('card number extraction', () => {
    it('extracts card number with # prefix', () => {
      const result = parser.parseText('#150 Some text');
      expect(result.cardNumber).toBe('150');
    });

    it('extracts card number with No. prefix', () => {
      const result = parser.parseText('Card No. 25 Some text');
      expect(result.cardNumber).toBe('25');
    });

    it('extracts alphanumeric card number', () => {
      const result = parser.parseText('#BCP-100 Bowman Chrome');
      expect(result.cardNumber).toBe('BCP-100');
    });
  });

  describe('brand detection', () => {
    it('detects Topps', () => {
      const result = parser.parseText('2023 TOPPS CHROME');
      expect(result.brand).toBe('Topps');
    });

    it('detects Panini via Prizm keyword', () => {
      const result = parser.parseText('2023 PRIZM Basketball');
      expect(result.brand).toBe('Panini');
    });

    it('detects Upper Deck', () => {
      const result = parser.parseText('UPPER DECK Young Guns');
      expect(result.brand).toBe('Upper Deck');
    });

    it('returns undefined for unknown brand', () => {
      const result = parser.parseText('Some random text with no brand');
      expect(result.brand).toBeUndefined();
    });
  });

  describe('player name extraction', () => {
    it('finds known player from database', () => {
      const result = parser.parseText('2023 Topps Chrome\nMike Trout\nAngels\n#1');
      expect(result.player).toBe('Mike Trout');
    });

    it('finds player by case-insensitive match', () => {
      const result = parser.parseText('2023 Topps\nMIKE TROUT\nAngels');
      expect(result.player).toBe('Mike Trout');
    });

    it('extracts title case name not in database', () => {
      const result = parser.parseText('2023 Topps\nJohn Smith\nSome Team');
      expect(result.player).toBe('John Smith');
    });

    it('converts ALL CAPS name to proper case', () => {
      const result = parser.parseText('JOHN SMITH\n2023 TOPPS\n#100');
      expect(result.player).toBe('John Smith');
    });

    it('returns undefined for unrecognizable text', () => {
      const result = parser.parseText('12345');
      expect(result.player).toBeUndefined();
    });
  });

  describe('team extraction', () => {
    it('finds a known team', () => {
      const result = parser.parseText('Mike Trout\nAngels\n2023 Topps');
      expect(result.team).toBe('Angels');
    });

    it('returns undefined when no team found', () => {
      const result = parser.parseText('Some random text');
      expect(result.team).toBeUndefined();
    });
  });

  describe('category/sport detection', () => {
    it('detects Baseball from MLB keyword', () => {
      const result = parser.parseText('MLB 2023 Topps');
      expect(result.category).toBe('Baseball');
    });

    it('detects Basketball from NBA keyword', () => {
      const result = parser.parseText('NBA BASKETBALL card');
      expect(result.category).toBe('Basketball');
    });

    it('detects Football from NFL keyword', () => {
      const result = parser.parseText('NFL FOOTBALL card');
      expect(result.category).toBe('Football');
    });

    it('infers sport from known player', () => {
      const result = parser.parseText('Mike Trout\nSome Card\n#1');
      expect(result.category).toBe('Baseball');
    });
  });

  describe('serial number extraction', () => {
    it('extracts serial number pattern', () => {
      const result = parser.parseText('150/250 Serial Numbered');
      expect(result.serialNumber).toBe('150/250');
    });

    it('returns undefined when no serial number', () => {
      const result = parser.parseText('Some card text');
      expect(result.serialNumber).toBeUndefined();
    });
  });

  describe('feature detection', () => {
    it('detects rookie card', () => {
      const result = parser.parseText('ROOKIE CARD RC 2023');
      expect(result.features?.isRookie).toBe(true);
    });

    it('detects autograph', () => {
      const result = parser.parseText('ON-CARD AUTO AUTOGRAPH');
      expect(result.features?.isAutograph).toBe(true);
    });

    it('detects relic/memorabilia', () => {
      const result = parser.parseText('GAME-USED JERSEY RELIC');
      expect(result.features?.isRelic).toBe(true);
    });

    it('detects numbered card from serial', () => {
      const result = parser.parseText('25/99 numbered card');
      expect(result.features?.isNumbered).toBe(true);
    });

    it('detects graded card', () => {
      const result = parser.parseText('PSA 10 GEM MINT');
      expect(result.features?.isGraded).toBe(true);
    });

    it('detects parallel', () => {
      const result = parser.parseText('GOLD REFRACTOR');
      expect(result.features?.isParallel).toBe(true);
    });

    it('returns all false for plain card', () => {
      const result = parser.parseText('2023 Topps Mike Trout #1');
      expect(result.features?.isRookie).toBe(false);
      expect(result.features?.isAutograph).toBe(false);
      expect(result.features?.isRelic).toBe(false);
    });
  });

  describe('confidence scoring', () => {
    it('gives high confidence for complete data', () => {
      const text = '2023 Topps Chrome\nMike Trout\nAngels\n#1\nMLB Baseball';
      const result = parser.parseText(text);
      expect(result.confidence!.score).toBeGreaterThanOrEqual(60);
      expect(result.confidence!.level).not.toBe('low');
    });

    it('gives low confidence for sparse data', () => {
      const result = parser.parseText('xyzzy garbage text');
      expect(result.confidence!.score).toBeLessThan(40);
      expect(result.confidence!.level).toBe('low');
    });

    it('reports missing fields', () => {
      const result = parser.parseText('random text');
      expect(result.confidence!.missingFields).toBeDefined();
      expect(result.confidence!.missingFields).toContain('player');
    });
  });

  describe('parallel extraction', () => {
    it('extracts refractor parallel', () => {
      const result = parser.parseText('2023 Topps Chrome REFRACTOR #1');
      expect(result.parallel).toBe('Refractor');
    });

    it('extracts prizm parallel', () => {
      const result = parser.parseText('Silver PRIZM Basketball');
      expect(result.parallel).toBeTruthy();
    });
  });

  describe('full card text parsing', () => {
    it('parses a complete modern baseball card', () => {
      const text = `2023 Topps Chrome
RONALD ACUÑA JR.
Atlanta Braves
#RA-15
REFRACTOR
Serial Numbered 150/250
ROOKIE`;

      const result = parser.parseText(text);
      expect(result.year).toBe('2023');
      expect(result.brand).toBe('Topps');
      expect(result.team).toBe('Braves');
      expect(result.serialNumber).toBe('150/250');
      expect(result.features?.isRookie).toBe(true);
      expect(result.features?.isParallel).toBe(true);
      expect(result.confidence!.score).toBeGreaterThan(40);
    });

    it('parses a graded card', () => {
      const text = `PSA 10 GEM MINT
2011 Topps Update
MIKE TROUT
Los Angeles Angels
#US175
ROOKIE CARD`;

      const result = parser.parseText(text);
      expect(result.year).toBe('2011');
      expect(result.player).toBe('Mike Trout');
      expect(result.features?.isGraded).toBe(true);
      expect(result.features?.isRookie).toBe(true);
    });
  });
});
