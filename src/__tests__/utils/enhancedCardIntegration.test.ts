import { createCard, createGradedCard } from '../helpers/factories';

// Delegation mocks for CRA resetMocks compatibility
const mockMigrateCardToEnhanced = jest.fn();
const mockHasEnhancedFields = jest.fn();

jest.mock('../../utils/cardMigration', () => ({
  migrateCardToEnhanced: (...args: any[]) => mockMigrateCardToEnhanced(...args),
  hasEnhancedFields: (...args: any[]) => mockHasEnhancedFields(...args),
}));

import {
  enhancedToBasicCard,
  saveEnhancedData,
  loadEnhancedData,
  mergeCardWithEnhanced,
  saveEnhancedCard,
} from '../../utils/enhancedCardIntegration';
import { EnhancedCard } from '../../types/card-enhanced';

beforeEach(() => {
  mockMigrateCardToEnhanced.mockImplementation((card: any) => ({
    ...card,
    identification: { playerName: card.player },
  }));
  mockHasEnhancedFields.mockReturnValue(false);
});

describe('enhancedToBasicCard', () => {
  it('preserves core card fields', () => {
    const enhanced: Partial<EnhancedCard> = {
      id: 'card-1',
      userId: 'user-1',
      player: 'Mike Trout',
      team: 'Angels',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      cardNumber: '1',
      condition: '10: GEM MINT',
      gradingCompany: 'PSA',
      purchasePrice: 50,
      purchaseDate: new Date('2023-01-01'),
      currentValue: 100,
      images: ['img1.jpg'],
      notes: 'Original note',
      collectionType: 'Inventory',
      createdAt: new Date('2023-01-01'),
    };

    const basic = enhancedToBasicCard(enhanced);
    expect(basic.player).toBe('Mike Trout');
    expect(basic.team).toBe('Angels');
    expect(basic.year).toBe(2023);
    expect(basic.gradingCompany).toBe('PSA');
    expect(basic.purchasePrice).toBe(50);
    expect(basic.images).toEqual(['img1.jpg']);
  });

  it('generates enhanced notes from special features', () => {
    const enhanced: Partial<EnhancedCard> = {
      player: 'Test',
      notes: 'My note',
      specialFeatures: {
        hasAutograph: true,
        autographType: 'Sticker',
        hasMemorabilia: false,
        is1of1: true,
      },
    };

    const basic = enhancedToBasicCard(enhanced);
    expect(basic.notes).toContain('My note');
    expect(basic.notes).toContain('Autograph: Sticker');
    expect(basic.notes).toContain('1/1 ONE OF ONE');
  });

  it('generates notes from identification fields', () => {
    const enhanced: Partial<EnhancedCard> = {
      player: 'Test',
      identification: {
        playerName: 'Test',
        teamName: 'Team',
        manufacturer: 'Mfg',
        brand: 'Brand',
        setName: 'Set',
        cardNumber: '1',
        serialNumber: '25/50',
        printRun: 50,
        subset: 'Prospects',
        insert: 'Chrome',
      },
    };

    const basic = enhancedToBasicCard(enhanced);
    expect(basic.notes).toContain('Serial: 25/50');
    expect(basic.notes).toContain('Print Run: 50');
    expect(basic.notes).toContain('Subset: Prospects');
    expect(basic.notes).toContain('Insert: Chrome');
  });

  it('generates notes from playerMetadata', () => {
    const enhanced: Partial<EnhancedCard> = {
      player: 'Test',
      playerMetadata: {
        isRookie: true,
        isHallOfFame: true,
        inductionYear: 2020,
        jerseyNumber: 27,
        position: 'CF',
        isActionShot: false,
        isPortrait: true,
      },
    };

    const basic = enhancedToBasicCard(enhanced);
    expect(basic.notes).toContain('ROOKIE CARD');
    expect(basic.notes).toContain('HOF (2020)');
    expect(basic.notes).toContain('Jersey #27');
    expect(basic.notes).toContain('Position: CF');
  });

  it('defaults missing fields', () => {
    const basic = enhancedToBasicCard({});
    expect(basic.player).toBe('');
    expect(basic.year).toBe(new Date().getFullYear());
    expect(basic.condition).toBe('RAW');
    expect(basic.collectionType).toBe('Inventory');
    expect(basic.purchasePrice).toBe(0);
    expect(basic.id).toMatch(/^card-/);
  });
});

describe('saveEnhancedData / loadEnhancedData', () => {
  it('round-trips enhanced data through localStorage', () => {
    const data: Partial<EnhancedCard> = {
      identification: {
        playerName: 'Trout',
        teamName: 'Angels',
        manufacturer: 'Topps',
        brand: 'Topps',
        setName: '2023 Topps',
        cardNumber: '1',
      },
      specialFeatures: {
        hasAutograph: true,
        hasMemorabilia: false,
        is1of1: false,
      },
    };

    saveEnhancedData('card-1', data);
    const loaded = loadEnhancedData('card-1');

    expect(loaded).not.toBeNull();
    expect(loaded!.identification!.playerName).toBe('Trout');
    expect(loaded!.specialFeatures!.hasAutograph).toBe(true);
  });

  it('returns null for non-existent card', () => {
    const loaded = loadEnhancedData('nonexistent');
    expect(loaded).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('enhanced_card_bad', 'not-json{{{');
    const loaded = loadEnhancedData('bad');
    expect(loaded).toBeNull();
  });
});

describe('mergeCardWithEnhanced', () => {
  it('merges stored enhanced data with basic card', () => {
    const card = createCard({ id: 'merge-1' });
    const enhancedData: Partial<EnhancedCard> = {
      specialFeatures: {
        hasAutograph: true,
        hasMemorabilia: false,
        is1of1: false,
      },
    };
    saveEnhancedData('merge-1', enhancedData);

    const merged = mergeCardWithEnhanced(card);
    expect(merged.specialFeatures!.hasAutograph).toBe(true);
    expect(merged.player).toBe('Mike Trout');
  });

  it('falls back to migration when no stored data', () => {
    const card = createCard({ id: 'no-stored' });
    const merged = mergeCardWithEnhanced(card);

    expect(mockMigrateCardToEnhanced).toHaveBeenCalledWith(card);
    expect(merged.identification).toBeDefined();
  });
});

describe('saveEnhancedCard', () => {
  it('calls addCard for new cards (no createdAt)', async () => {
    const addCard = jest.fn().mockResolvedValue(undefined);
    const updateCard = jest.fn().mockResolvedValue(undefined);

    const enhanced: Partial<EnhancedCard> = {
      player: 'New Player',
      team: 'Test Team',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      cardNumber: '99',
      purchasePrice: 10,
      currentValue: 20,
    };

    await saveEnhancedCard(enhanced, addCard, updateCard);
    expect(addCard).toHaveBeenCalled();
    expect(updateCard).not.toHaveBeenCalled();
  });

  it('calls updateCard for existing cards (has id + createdAt)', async () => {
    const addCard = jest.fn().mockResolvedValue(undefined);
    const updateCard = jest.fn().mockResolvedValue(undefined);

    const enhanced: Partial<EnhancedCard> = {
      id: 'existing-1',
      createdAt: new Date('2023-01-01'),
      player: 'Updated Player',
      team: 'Team',
      year: 2023,
      brand: 'Topps',
      category: 'Baseball',
      cardNumber: '1',
      purchasePrice: 10,
      currentValue: 20,
    };

    await saveEnhancedCard(enhanced, addCard, updateCard);
    expect(updateCard).toHaveBeenCalled();
    expect(addCard).not.toHaveBeenCalled();
  });

  it('saves enhanced data to localStorage', async () => {
    const addCard = jest.fn().mockResolvedValue(undefined);
    const updateCard = jest.fn().mockResolvedValue(undefined);

    const enhanced: Partial<EnhancedCard> = {
      player: 'Stored Player',
      specialFeatures: { hasAutograph: true, hasMemorabilia: false, is1of1: false },
    };

    await saveEnhancedCard(enhanced, addCard, updateCard);

    // Verify localStorage has the enhanced data
    const basicCard = addCard.mock.calls[0][0];
    const stored = loadEnhancedData(basicCard.id);
    expect(stored).not.toBeNull();
    expect(stored!.specialFeatures!.hasAutograph).toBe(true);
  });

  it('propagates errors from addCard', async () => {
    const addCard = jest.fn().mockRejectedValue(new Error('DB error'));
    const updateCard = jest.fn().mockResolvedValue(undefined);

    await expect(
      saveEnhancedCard({ player: 'Test' }, addCard, updateCard)
    ).rejects.toThrow('DB error');
  });
});
