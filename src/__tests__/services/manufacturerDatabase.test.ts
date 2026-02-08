import { ManufacturerDatabaseService, MANUFACTURER_DATABASE } from '../../services/manufacturerDatabase';

describe('ManufacturerDatabaseService', () => {
  let service: ManufacturerDatabaseService;

  beforeEach(() => {
    service = new ManufacturerDatabaseService();
  });

  // ---- getValidManufacturers ----
  describe('getValidManufacturers', () => {
    it('returns Topps for modern Baseball', () => {
      const result = service.getValidManufacturers('Baseball', 2023);
      expect(result).toContain('Topps');
    });

    it('returns Panini for modern Basketball', () => {
      const result = service.getValidManufacturers('Basketball', 2023);
      expect(result).toContain('Panini');
    });

    it('returns Upper Deck for Hockey', () => {
      const result = service.getValidManufacturers('Hockey', 2023);
      expect(result).toContain('Upper Deck');
    });

    it('returns multiple manufacturers for vintage Baseball', () => {
      const result = service.getValidManufacturers('Baseball', 1995);
      expect(result.length).toBeGreaterThan(1);
    });

    it('returns empty for unknown sports', () => {
      const result = service.getValidManufacturers('Curling', 2023);
      expect(result).toHaveLength(0);
    });
  });

  // ---- validateManufacturer ----
  describe('validateManufacturer', () => {
    it('validates Topps for Baseball 2023', () => {
      expect(service.validateManufacturer('Topps', 'Baseball', 2023)).toBe(true);
    });

    it('validates Panini for Football 2023', () => {
      expect(service.validateManufacturer('Panini', 'Football', 2023)).toBe(true);
    });

    it('rejects Topps for modern Football (after 2015)', () => {
      expect(service.validateManufacturer('Topps', 'Football', 2020)).toBe(false);
    });

    it('rejects defunct manufacturers after their end year', () => {
      expect(service.validateManufacturer('Fleer', 'Baseball', 2020)).toBe(false);
    });
  });

  // ---- hasExclusiveRights ----
  describe('hasExclusiveRights', () => {
    it('Topps has exclusive MLB rights', () => {
      expect(service.hasExclusiveRights('Topps', 'Baseball', 2023)).toBe(true);
    });

    it('Panini has exclusive NBA rights', () => {
      expect(service.hasExclusiveRights('Panini', 'Basketball', 2023)).toBe(true);
    });

    it('returns false for non-exclusive manufacturer', () => {
      expect(service.hasExclusiveRights('Bowman', 'Baseball', 2023)).toBe(false);
    });
  });

  // ---- getCardSets ----
  describe('getCardSets', () => {
    it('returns Topps Baseball sets', () => {
      const sets = service.getCardSets('Topps', 'Baseball', 2023);
      expect(sets.length).toBeGreaterThan(0);
      expect(sets).toContain('Topps Chrome');
    });

    it('returns Panini Basketball sets', () => {
      const sets = service.getCardSets('Panini', 'Basketball', 2023);
      expect(sets).toContain('Prizm');
      expect(sets).toContain('Select');
    });

    it('returns empty for invalid combo', () => {
      const sets = service.getCardSets('Unknown', 'Baseball', 2023);
      expect(sets).toHaveLength(0);
    });
  });

  // ---- getRealisticManufacturer ----
  describe('getRealisticManufacturer', () => {
    it('returns a manufacturer and set for Baseball', () => {
      const result = service.getRealisticManufacturer('Baseball', 2023);
      expect(result.manufacturer).toBeTruthy();
      expect(result.set).toBeTruthy();
    });

    it('often returns Bowman for Baseball rookies', () => {
      // Run multiple times to account for randomness
      let bowmanCount = 0;
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const result = service.getRealisticManufacturer('Baseball', 2023, true);
        if (result.manufacturer === 'Bowman') bowmanCount++;
      }
      // Should be heavily weighted toward Bowman (70% probability)
      expect(bowmanCount).toBeGreaterThan(iterations * 0.3);
    });

    it('returns a valid manufacturer for Basketball', () => {
      const result = service.getRealisticManufacturer('Basketball', 2023);
      expect(result.manufacturer).toBeTruthy();
    });
  });

  // ---- data integrity ----
  describe('data integrity', () => {
    it('all manufacturers have required fields', () => {
      Object.values(MANUFACTURER_DATABASE).forEach(mfr => {
        expect(mfr.name).toBeTruthy();
        expect(mfr.founded).toBeGreaterThan(0);
        expect(mfr.sports.length).toBeGreaterThan(0);
      });
    });

    it('all sports have valid start years', () => {
      Object.values(MANUFACTURER_DATABASE).forEach(mfr => {
        mfr.sports.forEach(sport => {
          expect(sport.startYear).toBeGreaterThan(1900);
          expect(sport.majorSets.length).toBeGreaterThan(0);
        });
      });
    });

    it('end years are after start years when present', () => {
      Object.values(MANUFACTURER_DATABASE).forEach(mfr => {
        mfr.sports.forEach(sport => {
          if (sport.endYear) {
            expect(sport.endYear).toBeGreaterThan(sport.startYear);
          }
        });
      });
    });
  });
});
