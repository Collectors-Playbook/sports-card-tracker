// Player Database Service
// Contains known players, teams, and sport-specific information for accurate detection

interface PlayerInfo {
  name: string;
  sport: string;
  teams: string[];
  years: string[];
  nicknames?: string[];
  position?: string;
  rookie?: string;
}

interface TeamInfo {
  name: string;
  sport: string;
  city: string;
  abbreviations: string[];
}

// Major player database organized by sport
export const PLAYER_DATABASE: Record<string, PlayerInfo[]> = {
  Baseball: [
    // Current Stars
    { name: "Shohei Ohtani", sport: "Baseball", teams: ["Angels", "Dodgers"], years: ["2018-2024"], position: "P/DH" },
    { name: "Mike Trout", sport: "Baseball", teams: ["Angels"], years: ["2011-2024"], position: "OF", rookie: "2011" },
    { name: "Ronald Acuña Jr.", sport: "Baseball", teams: ["Braves"], years: ["2018-2024"], position: "OF", rookie: "2018" },
    { name: "Juan Soto", sport: "Baseball", teams: ["Nationals", "Padres", "Yankees"], years: ["2018-2024"], position: "OF", rookie: "2018" },
    { name: "Fernando Tatis Jr.", sport: "Baseball", teams: ["Padres"], years: ["2019-2024"], position: "SS", rookie: "2019" },
    { name: "Vladimir Guerrero Jr.", sport: "Baseball", teams: ["Blue Jays"], years: ["2019-2024"], position: "1B", rookie: "2019" },
    { name: "Aaron Judge", sport: "Baseball", teams: ["Yankees"], years: ["2016-2024"], position: "OF", rookie: "2017" },
    { name: "Mookie Betts", sport: "Baseball", teams: ["Red Sox", "Dodgers"], years: ["2014-2024"], position: "OF/2B" },
    { name: "Freddie Freeman", sport: "Baseball", teams: ["Braves", "Dodgers"], years: ["2010-2024"], position: "1B" },
    { name: "José Ramírez", sport: "Baseball", teams: ["Guardians", "Indians"], years: ["2013-2024"], position: "3B" },
    
    // Recent Rookies
    { name: "Gunnar Henderson", sport: "Baseball", teams: ["Orioles"], years: ["2022-2024"], position: "SS", rookie: "2023" },
    { name: "Corbin Carroll", sport: "Baseball", teams: ["Diamondbacks"], years: ["2022-2024"], position: "OF", rookie: "2023" },
    { name: "Bobby Witt Jr.", sport: "Baseball", teams: ["Royals"], years: ["2022-2024"], position: "SS", rookie: "2022" },
    { name: "Julio Rodríguez", sport: "Baseball", teams: ["Mariners"], years: ["2022-2024"], position: "OF", rookie: "2022" },
    
    // Legends
    { name: "Ken Griffey Jr.", sport: "Baseball", teams: ["Mariners", "Reds", "White Sox"], years: ["1989-2010"], position: "OF", rookie: "1989", nicknames: ["The Kid", "Junior"] },
    { name: "Barry Bonds", sport: "Baseball", teams: ["Pirates", "Giants"], years: ["1986-2007"], position: "OF" },
    { name: "Derek Jeter", sport: "Baseball", teams: ["Yankees"], years: ["1995-2014"], position: "SS", nicknames: ["The Captain"] },
    { name: "Mike Piazza", sport: "Baseball", teams: ["Dodgers", "Marlins", "Mets", "Padres", "Athletics"], years: ["1992-2007"], position: "C" },
    { name: "Tony Gwynn", sport: "Baseball", teams: ["Padres"], years: ["1982-2001"], position: "OF", nicknames: ["Mr. Padre"] },
    { name: "Cal Ripken Jr.", sport: "Baseball", teams: ["Orioles"], years: ["1981-2001"], position: "SS", nicknames: ["The Iron Man"] },
    { name: "Nolan Ryan", sport: "Baseball", teams: ["Mets", "Angels", "Astros", "Rangers"], years: ["1966-1993"], position: "P" },
    { name: "Frank Thomas", sport: "Baseball", teams: ["White Sox", "Athletics", "Blue Jays"], years: ["1990-2008"], position: "1B", nicknames: ["The Big Hurt"] }
  ],
  
  Basketball: [
    // Current Stars
    { name: "LeBron James", sport: "Basketball", teams: ["Cavaliers", "Heat", "Lakers"], years: ["2003-2024"], position: "F", nicknames: ["King James", "The King"] },
    { name: "Stephen Curry", sport: "Basketball", teams: ["Warriors"], years: ["2009-2024"], position: "G", nicknames: ["Chef Curry", "Steph"] },
    { name: "Giannis Antetokounmpo", sport: "Basketball", teams: ["Bucks"], years: ["2013-2024"], position: "F", nicknames: ["Greek Freak"] },
    { name: "Kevin Durant", sport: "Basketball", teams: ["SuperSonics", "Thunder", "Warriors", "Nets", "Suns"], years: ["2007-2024"], position: "F", nicknames: ["KD", "Slim Reaper"] },
    { name: "Luka Dončić", sport: "Basketball", teams: ["Mavericks"], years: ["2018-2024"], position: "G", rookie: "2019" },
    { name: "Jayson Tatum", sport: "Basketball", teams: ["Celtics"], years: ["2017-2024"], position: "F", rookie: "2018" },
    { name: "Joel Embiid", sport: "Basketball", teams: ["76ers"], years: ["2016-2024"], position: "C", nicknames: ["The Process"] },
    { name: "Nikola Jokić", sport: "Basketball", teams: ["Nuggets"], years: ["2015-2024"], position: "C", nicknames: ["The Joker"] },
    { name: "Ja Morant", sport: "Basketball", teams: ["Grizzlies"], years: ["2019-2024"], position: "G", rookie: "2020" },
    { name: "Zion Williamson", sport: "Basketball", teams: ["Pelicans"], years: ["2019-2024"], position: "F", rookie: "2020" },
    
    // Recent Rookies
    { name: "Victor Wembanyama", sport: "Basketball", teams: ["Spurs"], years: ["2023-2024"], position: "C", rookie: "2024", nicknames: ["Wemby"] },
    { name: "Paolo Banchero", sport: "Basketball", teams: ["Magic"], years: ["2022-2024"], position: "F", rookie: "2023" },
    { name: "Chet Holmgren", sport: "Basketball", teams: ["Thunder"], years: ["2023-2024"], position: "C/F", rookie: "2024" },
    
    // Legends
    { name: "Michael Jordan", sport: "Basketball", teams: ["Bulls", "Wizards"], years: ["1984-2003"], position: "G", nicknames: ["MJ", "Air Jordan", "His Airness"] },
    { name: "Kobe Bryant", sport: "Basketball", teams: ["Lakers"], years: ["1996-2016"], position: "G", nicknames: ["Black Mamba", "Bean"] },
    { name: "Magic Johnson", sport: "Basketball", teams: ["Lakers"], years: ["1979-1996"], position: "G", nicknames: ["Magic"] },
    { name: "Larry Bird", sport: "Basketball", teams: ["Celtics"], years: ["1979-1992"], position: "F", nicknames: ["Larry Legend", "The Hick from French Lick"] },
    { name: "Shaquille O'Neal", sport: "Basketball", teams: ["Magic", "Lakers", "Heat", "Suns", "Cavaliers", "Celtics"], years: ["1992-2011"], position: "C", nicknames: ["Shaq", "The Big Aristotle", "Diesel"] },
    { name: "Tim Duncan", sport: "Basketball", teams: ["Spurs"], years: ["1997-2016"], position: "F/C", nicknames: ["The Big Fundamental"] }
  ],
  
  Football: [
    // Current Stars
    { name: "Patrick Mahomes", sport: "Football", teams: ["Chiefs"], years: ["2017-2024"], position: "QB", rookie: "2018" },
    { name: "Josh Allen", sport: "Football", teams: ["Bills"], years: ["2018-2024"], position: "QB", rookie: "2018" },
    { name: "Justin Jefferson", sport: "Football", teams: ["Vikings"], years: ["2020-2024"], position: "WR", rookie: "2020" },
    { name: "Ja'Marr Chase", sport: "Football", teams: ["Bengals"], years: ["2021-2024"], position: "WR", rookie: "2021" },
    { name: "Joe Burrow", sport: "Football", teams: ["Bengals"], years: ["2020-2024"], position: "QB", rookie: "2020" },
    { name: "Justin Herbert", sport: "Football", teams: ["Chargers"], years: ["2020-2024"], position: "QB", rookie: "2020" },
    { name: "Micah Parsons", sport: "Football", teams: ["Cowboys"], years: ["2021-2024"], position: "LB", rookie: "2021" },
    { name: "T.J. Watt", sport: "Football", teams: ["Steelers"], years: ["2017-2024"], position: "LB" },
    
    // Recent Rookies
    { name: "C.J. Stroud", sport: "Football", teams: ["Texans"], years: ["2023-2024"], position: "QB", rookie: "2023" },
    { name: "Will Anderson Jr.", sport: "Football", teams: ["Texans"], years: ["2023-2024"], position: "LB", rookie: "2023" },
    { name: "Bijan Robinson", sport: "Football", teams: ["Falcons"], years: ["2023-2024"], position: "RB", rookie: "2023" },
    
    // Legends
    { name: "Tom Brady", sport: "Football", teams: ["Patriots", "Buccaneers"], years: ["2000-2022"], position: "QB", nicknames: ["TB12", "The GOAT"] },
    { name: "Peyton Manning", sport: "Football", teams: ["Colts", "Broncos"], years: ["1998-2015"], position: "QB", nicknames: ["The Sheriff"] },
    { name: "Jerry Rice", sport: "Football", teams: ["49ers", "Raiders", "Seahawks"], years: ["1985-2004"], position: "WR" },
    { name: "Barry Sanders", sport: "Football", teams: ["Lions"], years: ["1989-1998"], position: "RB" },
    { name: "Brett Favre", sport: "Football", teams: ["Falcons", "Packers", "Jets", "Vikings"], years: ["1991-2010"], position: "QB" }
  ],
  
  Hockey: [
    // Current Stars
    { name: "Connor McDavid", sport: "Hockey", teams: ["Oilers"], years: ["2015-2024"], position: "C", rookie: "2016" },
    { name: "Auston Matthews", sport: "Hockey", teams: ["Maple Leafs"], years: ["2016-2024"], position: "C", rookie: "2017" },
    { name: "Nathan MacKinnon", sport: "Hockey", teams: ["Avalanche"], years: ["2013-2024"], position: "C" },
    { name: "Sidney Crosby", sport: "Hockey", teams: ["Penguins"], years: ["2005-2024"], position: "C", nicknames: ["Sid the Kid"] },
    { name: "Alexander Ovechkin", sport: "Hockey", teams: ["Capitals"], years: ["2005-2024"], position: "LW", nicknames: ["Ovi", "The Great 8"] },
    
    // Legends
    { name: "Wayne Gretzky", sport: "Hockey", teams: ["Oilers", "Kings", "Blues", "Rangers"], years: ["1979-1999"], position: "C", nicknames: ["The Great One"] },
    { name: "Mario Lemieux", sport: "Hockey", teams: ["Penguins"], years: ["1984-2006"], position: "C", nicknames: ["Super Mario"] }
  ],
  
  Pokemon: [
    { name: "Charizard", sport: "Pokemon", teams: ["Fire"], years: ["1996-2024"], position: "Stage 2" },
    { name: "Pikachu", sport: "Pokemon", teams: ["Electric"], years: ["1996-2024"], position: "Basic" },
    { name: "Mewtwo", sport: "Pokemon", teams: ["Psychic"], years: ["1996-2024"], position: "Basic" },
    { name: "Blastoise", sport: "Pokemon", teams: ["Water"], years: ["1996-2024"], position: "Stage 2" },
    { name: "Venusaur", sport: "Pokemon", teams: ["Grass"], years: ["1996-2024"], position: "Stage 2" }
  ]
};

// Team database for validation
export const TEAM_DATABASE: TeamInfo[] = [
  // MLB
  { name: "Yankees", sport: "Baseball", city: "New York", abbreviations: ["NYY"] },
  { name: "Red Sox", sport: "Baseball", city: "Boston", abbreviations: ["BOS"] },
  { name: "Dodgers", sport: "Baseball", city: "Los Angeles", abbreviations: ["LAD"] },
  { name: "Giants", sport: "Baseball", city: "San Francisco", abbreviations: ["SF"] },
  { name: "Cardinals", sport: "Baseball", city: "St. Louis", abbreviations: ["STL"] },
  { name: "Braves", sport: "Baseball", city: "Atlanta", abbreviations: ["ATL"] },
  { name: "Angels", sport: "Baseball", city: "Los Angeles", abbreviations: ["LAA"] },
  { name: "Padres", sport: "Baseball", city: "San Diego", abbreviations: ["SD"] },
  { name: "Astros", sport: "Baseball", city: "Houston", abbreviations: ["HOU"] },
  { name: "Cubs", sport: "Baseball", city: "Chicago", abbreviations: ["CHC"] },
  { name: "White Sox", sport: "Baseball", city: "Chicago", abbreviations: ["CWS"] },
  { name: "Mariners", sport: "Baseball", city: "Seattle", abbreviations: ["SEA"] },
  { name: "Blue Jays", sport: "Baseball", city: "Toronto", abbreviations: ["TOR"] },
  { name: "Orioles", sport: "Baseball", city: "Baltimore", abbreviations: ["BAL"] },
  { name: "Rays", sport: "Baseball", city: "Tampa Bay", abbreviations: ["TB"] },
  { name: "Guardians", sport: "Baseball", city: "Cleveland", abbreviations: ["CLE"] },
  { name: "Indians", sport: "Baseball", city: "Cleveland", abbreviations: ["CLE"] }, // Historical
  
  // NBA
  { name: "Lakers", sport: "Basketball", city: "Los Angeles", abbreviations: ["LAL"] },
  { name: "Warriors", sport: "Basketball", city: "Golden State", abbreviations: ["GSW"] },
  { name: "Celtics", sport: "Basketball", city: "Boston", abbreviations: ["BOS"] },
  { name: "Heat", sport: "Basketball", city: "Miami", abbreviations: ["MIA"] },
  { name: "Bucks", sport: "Basketball", city: "Milwaukee", abbreviations: ["MIL"] },
  { name: "Mavericks", sport: "Basketball", city: "Dallas", abbreviations: ["DAL"] },
  { name: "Nuggets", sport: "Basketball", city: "Denver", abbreviations: ["DEN"] },
  { name: "76ers", sport: "Basketball", city: "Philadelphia", abbreviations: ["PHI"] },
  { name: "Suns", sport: "Basketball", city: "Phoenix", abbreviations: ["PHX"] },
  { name: "Spurs", sport: "Basketball", city: "San Antonio", abbreviations: ["SAS"] },
  { name: "Bulls", sport: "Basketball", city: "Chicago", abbreviations: ["CHI"] },
  { name: "Cavaliers", sport: "Basketball", city: "Cleveland", abbreviations: ["CLE"] },
  
  // NFL
  { name: "Chiefs", sport: "Football", city: "Kansas City", abbreviations: ["KC"] },
  { name: "Bills", sport: "Football", city: "Buffalo", abbreviations: ["BUF"] },
  { name: "Cowboys", sport: "Football", city: "Dallas", abbreviations: ["DAL"] },
  { name: "Patriots", sport: "Football", city: "New England", abbreviations: ["NE"] },
  { name: "Packers", sport: "Football", city: "Green Bay", abbreviations: ["GB"] },
  { name: "49ers", sport: "Football", city: "San Francisco", abbreviations: ["SF"] },
  { name: "Bengals", sport: "Football", city: "Cincinnati", abbreviations: ["CIN"] },
  { name: "Chargers", sport: "Football", city: "Los Angeles", abbreviations: ["LAC"] },
  { name: "Steelers", sport: "Football", city: "Pittsburgh", abbreviations: ["PIT"] },
  { name: "Ravens", sport: "Football", city: "Baltimore", abbreviations: ["BAL"] },
  
  // NHL
  { name: "Oilers", sport: "Hockey", city: "Edmonton", abbreviations: ["EDM"] },
  { name: "Maple Leafs", sport: "Hockey", city: "Toronto", abbreviations: ["TOR"] },
  { name: "Penguins", sport: "Hockey", city: "Pittsburgh", abbreviations: ["PIT"] },
  { name: "Rangers", sport: "Hockey", city: "New York", abbreviations: ["NYR"] },
  { name: "Capitals", sport: "Hockey", city: "Washington", abbreviations: ["WSH"] }
];

// Card set patterns by brand and sport
export const CARD_SET_PATTERNS: Record<string, { sport: string; keywords: string[] }[]> = {
  "Topps": [
    { sport: "Baseball", keywords: ["Chrome", "Update", "Series 1", "Series 2", "Heritage", "Stadium Club", "Finest", "Archives"] },
    { sport: "Football", keywords: ["Chrome", "Finest"] }
  ],
  "Bowman": [
    { sport: "Baseball", keywords: ["Chrome", "Draft", "Best", "Sterling", "Inception", "1st"] }
  ],
  "Panini": [
    { sport: "Basketball", keywords: ["Prizm", "Select", "Mosaic", "Optic", "Chronicles", "National Treasures", "Immaculate", "Flawless"] },
    { sport: "Football", keywords: ["Prizm", "Select", "Mosaic", "Optic", "Chronicles", "National Treasures", "Immaculate", "Contenders"] }
  ],
  "Upper Deck": [
    { sport: "Hockey", keywords: ["Young Guns", "The Cup", "SP Authentic", "Ultimate", "Ice", "Series 1", "Series 2"] },
    { sport: "Basketball", keywords: ["Exquisite", "SP Authentic"] }
  ],
  "Leaf": [
    { sport: "Multi-Sport", keywords: ["Metal", "Trinity", "Ultimate", "Valiant"] }
  ]
};

/**
 * Service for player and team lookups
 */
export class PlayerDatabaseService {
  private playerSearchIndex: Map<string, PlayerInfo>;
  private teamSearchIndex: Map<string, TeamInfo>;

  constructor() {
    this.playerSearchIndex = this.buildPlayerIndex();
    this.teamSearchIndex = this.buildTeamIndex();
  }

  /**
   * Get all players from the database
   */
  getAllPlayers(): PlayerInfo[] {
    return Object.values(PLAYER_DATABASE).flat();
  }

  /**
   * Builds search index for fast player lookups
   */
  private buildPlayerIndex(): Map<string, PlayerInfo> {
    const index = new Map<string, PlayerInfo>();
    
    Object.values(PLAYER_DATABASE).flat().forEach(player => {
      // Index by full name
      index.set(player.name.toUpperCase(), player);
      
      // Index by last name
      const lastName = player.name.split(' ').pop()!;
      if (!index.has(lastName.toUpperCase())) {
        index.set(lastName.toUpperCase(), player);
      }
      
      // Index by nicknames
      player.nicknames?.forEach(nickname => {
        index.set(nickname.toUpperCase(), player);
      });
    });
    
    return index;
  }

  /**
   * Builds search index for teams
   */
  private buildTeamIndex(): Map<string, TeamInfo> {
    const index = new Map<string, TeamInfo>();
    
    TEAM_DATABASE.forEach(team => {
      index.set(team.name.toUpperCase(), team);
      team.abbreviations.forEach(abbr => {
        index.set(abbr.toUpperCase(), team);
      });
    });
    
    return index;
  }

  /**
   * Finds player information by name
   */
  findPlayer(name: string): PlayerInfo | null {
    const upperName = name.toUpperCase().trim();
    
    // Direct match
    if (this.playerSearchIndex.has(upperName)) {
      return this.playerSearchIndex.get(upperName)!;
    }
    
    // Try last name only
    const words = upperName.split(' ');
    if (words.length > 1) {
      const lastName = words[words.length - 1];
      if (this.playerSearchIndex.has(lastName)) {
        return this.playerSearchIndex.get(lastName)!;
      }
    }
    
    // Fuzzy match
    for (const [key, player] of this.playerSearchIndex) {
      if (this.fuzzyMatch(upperName, key)) {
        return player;
      }
    }
    
    return null;
  }

  /**
   * Finds team information
   */
  findTeam(name: string): TeamInfo | null {
    const upperName = name.toUpperCase().trim();
    return this.teamSearchIndex.get(upperName) || null;
  }

  /**
   * Gets sport from team name
   */
  getSportFromTeam(teamName: string): string | null {
    const team = this.findTeam(teamName);
    return team?.sport || null;
  }

  /**
   * Validates player-team combination
   */
  validatePlayerTeam(playerName: string, teamName: string): boolean {
    const player = this.findPlayer(playerName);
    const team = this.findTeam(teamName);
    
    if (!player || !team) return false;
    
    return player.teams.some(t => 
      t.toUpperCase() === team.name.toUpperCase()
    );
  }

  /**
   * Gets sport from brand and keywords
   */
  getSportFromBrand(brand: string, text: string): string | null {
    const patterns = CARD_SET_PATTERNS[brand];
    if (!patterns) return null;
    
    const upperText = text.toUpperCase();
    
    for (const pattern of patterns) {
      const hasKeyword = pattern.keywords.some(keyword => 
        upperText.includes(keyword.toUpperCase())
      );
      if (hasKeyword) {
        return pattern.sport;
      }
    }
    
    return null;
  }

  /**
   * Simple fuzzy matching
   */
  private fuzzyMatch(str1: string, str2: string): boolean {
    // Remove common suffixes
    const clean1 = str1.replace(/\s+(JR\.?|SR\.?|III|II|IV)$/i, '').trim();
    const clean2 = str2.replace(/\s+(JR\.?|SR\.?|III|II|IV)$/i, '').trim();
    
    // Check if one contains the other
    return clean1.includes(clean2) || clean2.includes(clean1);
  }
}

// Export singleton instance
export const playerDatabase = new PlayerDatabaseService();