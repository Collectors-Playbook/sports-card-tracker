import { PlayerDatabaseService, PLAYER_DATABASE, TEAM_DATABASE, CARD_SET_PATTERNS } from '../../services/playerDatabase';

describe('PlayerDatabaseService', () => {
  let service: PlayerDatabaseService;

  beforeAll(() => {
    service = new PlayerDatabaseService();
  });

  // ─── getAllPlayers ──────────────────────────────────────────────────────

  describe('getAllPlayers', () => {
    it('returns all players across all sports', () => {
      const players = service.getAllPlayers();
      expect(players.length).toBeGreaterThan(0);
      const sports = new Set(players.map(p => p.sport));
      expect(sports.has('Baseball')).toBe(true);
      expect(sports.has('Basketball')).toBe(true);
      expect(sports.has('Football')).toBe(true);
      expect(sports.has('Hockey')).toBe(true);
    });
  });

  // ─── findPlayer ─────────────────────────────────────────────────────────

  describe('findPlayer', () => {
    it('finds player by exact full name', () => {
      const player = service.findPlayer('Mike Trout');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Mike Trout');
      expect(player!.sport).toBe('Baseball');
    });

    it('finds player case-insensitively', () => {
      const player = service.findPlayer('MIKE TROUT');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Mike Trout');
    });

    it('finds player by last name only', () => {
      const player = service.findPlayer('Mahomes');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Patrick Mahomes');
    });

    it('finds player by nickname', () => {
      const player = service.findPlayer('The Great One');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Wayne Gretzky');
    });

    it('finds player via fuzzy match', () => {
      // "Cal Ripken" should fuzzy match "Cal Ripken Jr."
      const player = service.findPlayer('Cal Ripken');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Cal Ripken Jr.');
    });

    it('returns null for unknown player', () => {
      const player = service.findPlayer('Unknown Player 12345');
      expect(player).toBeNull();
    });

    it('trims whitespace from input', () => {
      const player = service.findPlayer('  LeBron James  ');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('LeBron James');
    });

    it('finds player by multi-word last name search', () => {
      const player = service.findPlayer('Ken Griffey Jr.');
      expect(player).not.toBeNull();
      expect(player!.name).toBe('Ken Griffey Jr.');
    });
  });

  // ─── findTeam ───────────────────────────────────────────────────────────

  describe('findTeam', () => {
    it('finds team by full name', () => {
      const team = service.findTeam('Yankees');
      expect(team).not.toBeNull();
      expect(team!.sport).toBe('Baseball');
      expect(team!.city).toBe('New York');
    });

    it('finds team by abbreviation', () => {
      const team = service.findTeam('LAD');
      expect(team).not.toBeNull();
      expect(team!.name).toBe('Dodgers');
    });

    it('finds team case-insensitively', () => {
      const team = service.findTeam('lakers');
      expect(team).not.toBeNull();
      expect(team!.name).toBe('Lakers');
    });

    it('returns null for unknown team', () => {
      const team = service.findTeam('Unknown Team');
      expect(team).toBeNull();
    });
  });

  // ─── getSportFromTeam ──────────────────────────────────────────────────

  describe('getSportFromTeam', () => {
    it('returns sport for known team', () => {
      expect(service.getSportFromTeam('Chiefs')).toBe('Football');
      expect(service.getSportFromTeam('Warriors')).toBe('Basketball');
      expect(service.getSportFromTeam('Oilers')).toBe('Hockey');
    });

    it('returns null for unknown team', () => {
      expect(service.getSportFromTeam('Unknown')).toBeNull();
    });
  });

  // ─── validatePlayerTeam ────────────────────────────────────────────────

  describe('validatePlayerTeam', () => {
    it('returns true for valid player-team pair', () => {
      expect(service.validatePlayerTeam('Mike Trout', 'Angels')).toBe(true);
    });

    it('returns true for player with multiple teams', () => {
      expect(service.validatePlayerTeam('LeBron James', 'Lakers')).toBe(true);
      expect(service.validatePlayerTeam('LeBron James', 'Heat')).toBe(true);
      expect(service.validatePlayerTeam('LeBron James', 'Cavaliers')).toBe(true);
    });

    it('returns false for wrong team', () => {
      expect(service.validatePlayerTeam('Mike Trout', 'Yankees')).toBe(false);
    });

    it('returns false for unknown player', () => {
      expect(service.validatePlayerTeam('Unknown Player', 'Yankees')).toBe(false);
    });

    it('returns false for unknown team', () => {
      expect(service.validatePlayerTeam('Mike Trout', 'Unknown Team')).toBe(false);
    });
  });

  // ─── getSportFromBrand ─────────────────────────────────────────────────

  describe('getSportFromBrand', () => {
    it('identifies sport from Topps Chrome (Baseball)', () => {
      expect(service.getSportFromBrand('Topps', 'Chrome Refractor')).toBe('Baseball');
    });

    it('identifies sport from Panini Prizm (Basketball)', () => {
      expect(service.getSportFromBrand('Panini', 'Prizm Silver')).toBe('Basketball');
    });

    it('identifies sport from Upper Deck Young Guns (Hockey)', () => {
      expect(service.getSportFromBrand('Upper Deck', 'Young Guns Exclusive')).toBe('Hockey');
    });

    it('identifies sport from Bowman 1st (Baseball)', () => {
      expect(service.getSportFromBrand('Bowman', '1st Chrome Auto')).toBe('Baseball');
    });

    it('returns null for unknown brand', () => {
      expect(service.getSportFromBrand('UnknownBrand', 'Chrome')).toBeNull();
    });

    it('returns null when no keyword matches', () => {
      expect(service.getSportFromBrand('Topps', 'nothing relevant')).toBeNull();
    });

    it('is case-insensitive for keywords', () => {
      expect(service.getSportFromBrand('Topps', 'CHROME')).toBe('Baseball');
    });

    it('identifies Panini Football', () => {
      expect(service.getSportFromBrand('Panini', 'Contenders Draft')).toBe('Football');
    });
  });

  // ─── Static data exports ──────────────────────────────────────────────

  describe('static data exports', () => {
    it('PLAYER_DATABASE has expected sports', () => {
      expect(Object.keys(PLAYER_DATABASE)).toEqual(
        expect.arrayContaining(['Baseball', 'Basketball', 'Football', 'Hockey', 'Pokemon'])
      );
    });

    it('TEAM_DATABASE has entries', () => {
      expect(TEAM_DATABASE.length).toBeGreaterThan(0);
    });

    it('CARD_SET_PATTERNS has expected brands', () => {
      expect(Object.keys(CARD_SET_PATTERNS)).toEqual(
        expect.arrayContaining(['Topps', 'Bowman', 'Panini', 'Upper Deck', 'Leaf'])
      );
    });
  });
});
