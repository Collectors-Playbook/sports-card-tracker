import { PlayerDatabaseService, PLAYER_DATABASE, TEAM_DATABASE } from '../../services/playerDatabase';

describe('PlayerDatabaseService', () => {
  let service: PlayerDatabaseService;

  beforeEach(() => {
    service = new PlayerDatabaseService();
  });

  // ---- findPlayer ----
  describe('findPlayer', () => {
    it('finds player by full name', () => {
      const result = service.findPlayer('Mike Trout');
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Mike Trout');
      expect(result!.sport).toBe('Baseball');
    });

    it('finds player by full name (case-insensitive)', () => {
      const result = service.findPlayer('mike trout');
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Mike Trout');
    });

    it('finds player by last name', () => {
      const result = service.findPlayer('Trout');
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Mike Trout');
    });

    it('finds player by nickname', () => {
      const result = service.findPlayer('The Kid');
      expect(result).toBeTruthy();
      expect(result!.name).toBe('Ken Griffey Jr.');
    });

    it('finds player by fuzzy match', () => {
      const result = service.findPlayer('Ken Griffey');
      expect(result).toBeTruthy();
    });

    it('returns null for unknown player', () => {
      expect(service.findPlayer('Unknown Person XYZ')).toBeNull();
    });

    it('finds players from different sports', () => {
      expect(service.findPlayer('LeBron James')!.sport).toBe('Basketball');
      expect(service.findPlayer('Patrick Mahomes')!.sport).toBe('Football');
      expect(service.findPlayer('Connor McDavid')!.sport).toBe('Hockey');
    });
  });

  // ---- findTeam ----
  describe('findTeam', () => {
    it('finds team by name', () => {
      const result = service.findTeam('Yankees');
      expect(result).toBeTruthy();
      expect(result!.sport).toBe('Baseball');
    });

    it('finds team by name (case-insensitive)', () => {
      const result = service.findTeam('yankees');
      expect(result).toBeTruthy();
    });

    it('returns null for unknown team', () => {
      expect(service.findTeam('Unknown Team')).toBeNull();
    });

    it('finds teams across sports', () => {
      expect(service.findTeam('Lakers')!.sport).toBe('Basketball');
      expect(service.findTeam('Chiefs')!.sport).toBe('Football');
      expect(service.findTeam('Oilers')!.sport).toBe('Hockey');
    });
  });

  // ---- getSportFromBrand ----
  describe('getSportFromBrand', () => {
    it('detects Baseball from Topps Chrome', () => {
      expect(service.getSportFromBrand('Topps', 'Topps Chrome 2023')).toBe('Baseball');
    });

    it('detects Basketball from Prizm', () => {
      expect(service.getSportFromBrand('Panini', 'Panini Prizm NBA')).toBe('Basketball');
    });

    it('detects Hockey from Young Guns', () => {
      expect(service.getSportFromBrand('Upper Deck', 'Upper Deck Young Guns')).toBe('Hockey');
    });

    it('returns null for unknown brand', () => {
      expect(service.getSportFromBrand('UnknownBrand', 'some text')).toBeNull();
    });
  });

  // ---- validatePlayerTeam ----
  describe('validatePlayerTeam', () => {
    it('validates correct player-team combo', () => {
      expect(service.validatePlayerTeam('Mike Trout', 'Angels')).toBe(true);
    });

    it('rejects incorrect player-team combo', () => {
      expect(service.validatePlayerTeam('Mike Trout', 'Yankees')).toBe(false);
    });

    it('returns false for unknown player', () => {
      expect(service.validatePlayerTeam('Unknown Player', 'Yankees')).toBe(false);
    });
  });

  // ---- getAllPlayers ----
  describe('getAllPlayers', () => {
    it('returns all players from all sports', () => {
      const allPlayers = service.getAllPlayers();
      expect(allPlayers.length).toBeGreaterThan(30);
    });

    it('includes players from each sport', () => {
      const allPlayers = service.getAllPlayers();
      const sports = new Set(allPlayers.map(p => p.sport));
      expect(sports.has('Baseball')).toBe(true);
      expect(sports.has('Basketball')).toBe(true);
      expect(sports.has('Football')).toBe(true);
      expect(sports.has('Hockey')).toBe(true);
    });
  });

  // ---- data integrity ----
  describe('data integrity', () => {
    it('all players have required fields', () => {
      const allPlayers = service.getAllPlayers();
      allPlayers.forEach(player => {
        expect(player.name).toBeTruthy();
        expect(player.sport).toBeTruthy();
        expect(player.teams.length).toBeGreaterThan(0);
        expect(player.years.length).toBeGreaterThan(0);
      });
    });

    it('all teams in TEAM_DATABASE have required fields', () => {
      TEAM_DATABASE.forEach(team => {
        expect(team.name).toBeTruthy();
        expect(team.sport).toBeTruthy();
        expect(team.city).toBeTruthy();
        expect(team.abbreviations.length).toBeGreaterThan(0);
      });
    });
  });
});
