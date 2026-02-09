import { ExtractedCardData, CardFeatures, DetectionConfidence } from '../types';
import { PlayerDatabaseService } from './playerDatabase';

const BRAND_PATTERNS: Record<string, string[]> = {
  'Topps': ['TOPPS', 'TOPPS CHROME', 'TOPPS UPDATE', 'TOPPS SERIES', 'BOWMAN', 'BOWMAN CHROME'],
  'Panini': ['PANINI', 'PRIZM', 'MOSAIC', 'SELECT', 'OPTIC', 'DONRUSS', 'NATIONAL TREASURES', 'IMMACULATE'],
  'Upper Deck': ['UPPER DECK', 'UD', 'SP AUTHENTIC', 'THE CUP', 'ULTIMATE COLLECTION'],
  'Leaf': ['LEAF', 'LEAF METAL', 'LEAF TRINITY'],
  'Fleer': ['FLEER', 'FLEER ULTRA', 'SKYBOX'],
  'Score': ['SCORE', 'SCORE SELECT'],
  'Bowman': ['BOWMAN', 'BOWMAN CHROME', 'BOWMAN DRAFT', "BOWMAN'S BEST"],
};

const SPORT_PATTERNS: Record<string, string[]> = {
  'Baseball': ['MLB', 'BASEBALL', 'PITCHER', 'BATTING', 'HOME RUN', 'STOLEN BASE', 'ERA', 'AVG', 'HR', 'RBI'],
  'Basketball': ['NBA', 'BASKETBALL', 'REBOUNDS', 'ASSISTS', 'POINTS', 'DUNK', 'THREE-POINTER', 'PPG', 'RPG', 'APG'],
  'Football': ['NFL', 'FOOTBALL', 'TOUCHDOWN', 'PASSING', 'RUSHING', 'QUARTERBACK', 'YARDS', 'TD', 'YDS'],
  'Hockey': ['NHL', 'HOCKEY', 'GOALS', 'GOALIE', 'STANLEY CUP', 'HAT TRICK'],
  'Soccer': ['SOCCER', 'FIFA', 'WORLD CUP', 'PREMIER LEAGUE', 'LA LIGA'],
  'Pokemon': ['POKEMON', 'POKÉMON', 'HP', 'ENERGY', 'TRAINER', 'EVOLUTION'],
};

const ROOKIE_INDICATORS = [
  'ROOKIE', 'RC', 'FIRST YEAR', 'DRAFT PICK', 'PROSPECT', 'DEBUT',
  'RATED ROOKIE', 'FUTURE STARS', 'STAR ROOKIE', '1ST BOWMAN',
];

const AUTOGRAPH_INDICATORS = [
  'AUTO', 'AUTOGRAPH', 'SIGNED', 'SIGNATURE', 'ON-CARD AUTO',
  'CERTIFIED AUTOGRAPH', 'DUAL AUTO',
];

const RELIC_INDICATORS = [
  'RELIC', 'PATCH', 'JERSEY', 'MEMORABILIA', 'GAME-USED',
  'GAME-WORN', 'BAT', 'MATERIAL', 'SWATCH', 'PRIME',
];

const PARALLEL_INDICATORS = [
  'REFRACTOR', 'PRIZM', 'CHROME', 'GOLD', 'SILVER', 'BLACK',
  'RAINBOW', 'SAPPHIRE', 'ORANGE', 'RED', 'BLUE', 'GREEN',
  'ATOMIC', 'SHIMMER', 'MOSAIC', 'OPTIC', 'SELECT',
];

const GRADE_PATTERNS: Record<string, RegExp> = {
  'PSA': /PSA\s*(\d+(?:\.\d+)?)/i,
  'BGS': /BGS\s*(\d+(?:\.\d+)?)/i,
  'SGC': /SGC\s*(\d+(?:\.\d+)?)/i,
  'CGC': /CGC\s*(\d+(?:\.\d+)?)/i,
};

class CardParserService {
  private playerDb: PlayerDatabaseService;

  constructor(playerDb?: PlayerDatabaseService) {
    this.playerDb = playerDb || new PlayerDatabaseService();
  }

  parseText(text: string): ExtractedCardData {
    const data: ExtractedCardData = {};
    const upperText = text.toUpperCase();

    data.year = this.extractYear(text);
    data.cardNumber = this.extractCardNumber(text);
    data.serialNumber = this.extractSerialNumber(text);
    data.brand = this.extractBrand(upperText);
    data.category = this.extractCategory(upperText);
    data.player = this.extractPlayerName(text);
    data.team = this.extractTeam(text);
    data.parallel = this.extractParallel(upperText);

    const features = this.detectFeatures(text, upperText);
    data.features = features;

    // Extract grade info
    for (const [company, pattern] of Object.entries(GRADE_PATTERNS)) {
      const match = text.match(pattern);
      if (match) {
        data.features = { ...features, isGraded: true };
        break;
      }
    }

    // If no category found yet, try from player's sport
    if (!data.category && data.player) {
      const playerInfo = this.playerDb.findPlayer(data.player);
      if (playerInfo) {
        data.category = playerInfo.sport;
      }
    }

    // If no category found yet, try from team
    if (!data.category && data.team) {
      const sport = this.playerDb.getSportFromTeam(data.team);
      if (sport) {
        data.category = sport;
      }
    }

    data.confidence = this.calculateConfidence(data, features);
    data.rawText = text;

    return data;
  }

  private extractYear(text: string): string | undefined {
    const match = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    return match ? match[1] : undefined;
  }

  private extractCardNumber(text: string): string | undefined {
    const match = text.match(/(?:#|No\.?|Card)\s*(\d+[A-Za-z]?)/i);
    if (match) return match[1];

    // Try standalone patterns like BCP-100 or RA-15
    const alphaMatch = text.match(/#?([A-Z]+-\d+[A-Za-z]?)/);
    if (alphaMatch) return alphaMatch[1];

    return undefined;
  }

  private extractSerialNumber(text: string): string | undefined {
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? match[0] : undefined;
  }

  private extractBrand(upperText: string): string | undefined {
    for (const [brand, keywords] of Object.entries(BRAND_PATTERNS)) {
      for (const keyword of keywords) {
        if (upperText.includes(keyword)) {
          return brand;
        }
      }
    }
    return undefined;
  }

  private extractCategory(upperText: string): string | undefined {
    for (const [sport, keywords] of Object.entries(SPORT_PATTERNS)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (upperText.includes(keyword)) {
          matchCount++;
        }
      }
      if (matchCount >= 1) {
        return sport;
      }
    }
    return undefined;
  }

  private extractPlayerName(text: string): string | undefined {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Strategy 1: Check known players
    const allPlayers = this.playerDb.getAllPlayers();
    for (const player of allPlayers) {
      if (text.includes(player.name)) {
        return player.name;
      }
    }

    // Strategy 2: Case-insensitive check
    const upperText = text.toUpperCase();
    for (const player of allPlayers) {
      if (upperText.includes(player.name.toUpperCase())) {
        return player.name;
      }
    }

    // Strategy 3: Title case names (common on cards)
    const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|III|II|IV))?)\b/g;
    const matches = text.match(namePattern);

    if (matches) {
      const nonPlayerWords = ['Topps', 'Panini', 'Upper Deck', 'Baseball', 'Football', 'Basketball', 'Hockey', 'Rookie Card', 'Draft Pick'];
      const potentialNames = matches.filter(match =>
        !nonPlayerWords.some(word => match.includes(word))
      );
      if (potentialNames.length > 0) {
        return potentialNames[0];
      }
    }

    // Strategy 4: ALL CAPS names (common for player names on cards)
    for (const line of lines) {
      if (line.length < 3 || line.length > 40) continue;
      if (/^\d+$/.test(line)) continue;
      if (line.includes('#')) continue;

      if (line === line.toUpperCase() && line.split(' ').length >= 2) {
        const words = line.split(' ');
        const hasNumber = words.some(w => /^\d+$/.test(w));
        if (!hasNumber) {
          return words
            .map(word => word.charAt(0) + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }

    return undefined;
  }

  private extractTeam(text: string): string | undefined {
    const teams = [
      'Yankees', 'Red Sox', 'Dodgers', 'Giants', 'Cardinals', 'Braves',
      'Angels', 'Padres', 'Astros', 'Cubs', 'White Sox', 'Mariners',
      'Blue Jays', 'Orioles', 'Rays', 'Guardians', 'Mets', 'Phillies',
      'Nationals', 'Reds', 'Pirates', 'Brewers', 'Diamondbacks', 'Rockies',
      'Royals', 'Tigers', 'Twins', 'Rangers', 'Athletics', 'Marlins',
      'Lakers', 'Warriors', 'Celtics', 'Heat', 'Bucks', 'Mavericks',
      'Nuggets', '76ers', 'Suns', 'Spurs', 'Bulls', 'Cavaliers',
      'Chiefs', 'Bills', 'Cowboys', 'Patriots', 'Packers', '49ers',
      'Bengals', 'Chargers', 'Steelers', 'Ravens', 'Eagles',
      'Oilers', 'Maple Leafs', 'Penguins', 'Rangers', 'Capitals',
    ];

    for (const team of teams) {
      if (text.includes(team)) {
        return team;
      }
    }

    return undefined;
  }

  private extractParallel(upperText: string): string | undefined {
    for (const parallel of PARALLEL_INDICATORS) {
      if (upperText.includes(parallel)) {
        return parallel.charAt(0) + parallel.slice(1).toLowerCase();
      }
    }
    return undefined;
  }

  private detectFeatures(text: string, upperText: string): CardFeatures {
    return {
      isRookie: ROOKIE_INDICATORS.some(ind => upperText.includes(ind)),
      isAutograph: AUTOGRAPH_INDICATORS.some(ind => upperText.includes(ind)),
      isRelic: RELIC_INDICATORS.some(ind => upperText.includes(ind)),
      isNumbered: /\d+\s*\/\s*\d+/.test(text),
      isGraded: Object.values(GRADE_PATTERNS).some(p => p.test(text)),
      isParallel: PARALLEL_INDICATORS.some(ind => upperText.includes(ind)),
    };
  }

  private calculateConfidence(data: ExtractedCardData, features: CardFeatures): DetectionConfidence {
    let score = 0;
    let detectedFields = 0;
    const missingFields: string[] = [];

    const fieldScores: Record<string, number> = {
      player: 20,
      year: 15,
      brand: 15,
      cardNumber: 10,
      team: 8,
      category: 5,
      parallel: 3,
      serialNumber: 4,
    };

    for (const [field, points] of Object.entries(fieldScores)) {
      if (data[field as keyof ExtractedCardData]) {
        score += points;
        detectedFields++;
      } else if (points >= 10) {
        missingFields.push(field);
      }
    }

    // Feature bonuses
    if (features.isRookie) score += 3;
    if (features.isAutograph) score += 3;
    if (features.isRelic) score += 3;
    if (features.isNumbered) score += 2;
    if (features.isGraded) score += 5;

    const percentage = Math.min(score, 100);

    let level: 'high' | 'medium' | 'low';
    if (percentage >= 80) level = 'high';
    else if (percentage >= 60) level = 'medium';
    else level = 'low';

    return {
      score: percentage,
      level,
      detectedFields,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
    };
  }
}

export default CardParserService;
