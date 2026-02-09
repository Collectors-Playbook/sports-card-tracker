import 'fake-indexeddb/auto';
import { seedLocalStorageUser } from '../helpers/mockBrowserApis';
import { Card } from '../../types';

// We need to mock collectionsDatabase to avoid circular dependencies
jest.mock('../../db/collectionsDatabase', () => ({
  collectionsDatabase: {
    initializeUserCollections: jest.fn().mockResolvedValue(undefined),
    getDefaultCollection: jest.fn().mockResolvedValue({ id: 'default-collection', name: 'My Collection' }),
    getUserCollections: jest.fn().mockResolvedValue([]),
  },
}));

describe('simpleDatabase', () => {
  let cardDatabase: typeof import('../../db/simpleDatabase').cardDatabase;

  const testCard: Card = {
    id: 'card-test-1',
    userId: 'user-test',
    collectionId: 'default-collection',
    player: 'Mike Trout',
    team: 'Angels',
    year: 2023,
    brand: 'Topps Chrome',
    category: 'Baseball',
    cardNumber: '1',
    condition: 'RAW',
    purchasePrice: 50,
    purchaseDate: new Date('2023-06-15'),
    currentValue: 75,
    images: [],
    notes: 'Test card',
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2023-06-15'),
    collectionType: 'Inventory',
  };

  beforeEach(async () => {
    // Clear indexedDB
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }

    // Seed user in localStorage
    seedLocalStorageUser('user-test');

    // Re-import to get fresh module
    jest.isolateModules(() => {
      const mod = require('../../db/simpleDatabase');
      cardDatabase = mod.cardDatabase;
    });
  });

  // ---- addCard ----
  describe('addCard', () => {
    it('adds a card to the database', async () => {
      await cardDatabase.addCard(testCard);
      const cards = await cardDatabase.getAllCards();
      expect(cards.some(c => c.id === testCard.id)).toBe(true);
    });

    it('generates id if not provided', async () => {
      const cardWithoutId = { ...testCard, id: '' };
      await cardDatabase.addCard(cardWithoutId);
      const cards = await cardDatabase.getAllCards();
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    it('sets userId from current user', async () => {
      const card = { ...testCard, userId: '' };
      await cardDatabase.addCard(card);
      const cards = await cardDatabase.getAllCards();
      expect(cards[0].userId).toBe('user-test');
    });
  });

  // ---- getAllCards ----
  describe('getAllCards', () => {
    it('returns empty array when no cards exist', async () => {
      const cards = await cardDatabase.getAllCards();
      expect(cards).toEqual([]);
    });

    it('returns only current user cards', async () => {
      await cardDatabase.addCard(testCard);
      await cardDatabase.addCard({ ...testCard, id: 'card-other', userId: 'other-user' });
      const cards = await cardDatabase.getAllCards();
      expect(cards.every(c => c.userId === 'user-test')).toBe(true);
    });

    it('converts date strings to Date objects', async () => {
      await cardDatabase.addCard(testCard);
      const cards = await cardDatabase.getAllCards();
      expect(cards[0].purchaseDate).toBeInstanceOf(Date);
      expect(cards[0].createdAt).toBeInstanceOf(Date);
    });
  });

  // ---- updateCard ----
  describe('updateCard', () => {
    it('updates card fields', async () => {
      await cardDatabase.addCard(testCard);
      await cardDatabase.updateCard({ ...testCard, currentValue: 100 });
      const cards = await cardDatabase.getAllCards();
      const updated = cards.find(c => c.id === testCard.id);
      expect(updated!.currentValue).toBe(100);
    });

    it('updates the updatedAt timestamp', async () => {
      await cardDatabase.addCard(testCard);
      const before = new Date();
      await cardDatabase.updateCard({ ...testCard, notes: 'updated' });
      const cards = await cardDatabase.getAllCards();
      const updated = cards.find(c => c.id === testCard.id);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    });
  });

  // ---- deleteCard ----
  describe('deleteCard', () => {
    it('removes card from database', async () => {
      await cardDatabase.addCard(testCard);
      await cardDatabase.deleteCard(testCard.id);
      const cards = await cardDatabase.getAllCards();
      expect(cards.find(c => c.id === testCard.id)).toBeUndefined();
    });

    it('does not throw for non-existent card', async () => {
      await expect(cardDatabase.deleteCard('nonexistent')).resolves.not.toThrow();
    });
  });

  // ---- clearAllCards ----
  describe('clearAllCards', () => {
    it('removes all cards for current user', async () => {
      await cardDatabase.addCard(testCard);
      await cardDatabase.addCard({ ...testCard, id: 'card-2' });
      await cardDatabase.clearAllCards();
      const cards = await cardDatabase.getAllCards();
      expect(cards).toHaveLength(0);
    });

    it('does not remove other users cards', async () => {
      await cardDatabase.addCard(testCard);
      // Add card for different user directly
      const { db } = require('../../db/simpleDatabase');
      await db.cards.add({ ...testCard, id: 'other-card', userId: 'other-user' });

      await cardDatabase.clearAllCards();
      const allCards = await db.cards.toArray();
      expect(allCards.some((c: any) => c.userId === 'other-user')).toBe(true);
    });
  });

  // ---- getCardCountsByUser ----
  describe('getCardCountsByUser', () => {
    it('counts cards grouped by user', async () => {
      await cardDatabase.addCard(testCard);
      const { db } = require('../../db/simpleDatabase');
      await db.cards.add({ ...testCard, id: 'other-card', userId: 'user-2' });

      const counts = await cardDatabase.getCardCountsByUser();
      expect(counts['user-test']).toBe(1);
      expect(counts['user-2']).toBe(1);
    });
  });

  // ---- migrateFromLocalStorage ----
  describe('migrateFromLocalStorage', () => {
    it('migrates cards from localStorage', async () => {
      const storedCards = [{ ...testCard, id: 'migrated-1' }];
      localStorage.setItem('sports-card-tracker-cards', JSON.stringify(storedCards));
      localStorage.removeItem('dexie_migration_completed');

      jest.isolateModules(() => {
        require('../../db/simpleDatabase');
      });

      // Migration happens asynchronously on module load
      // Just verify it doesn't throw
    });

    it('skips migration if already completed', async () => {
      localStorage.setItem('dexie_migration_completed', 'true');
      jest.isolateModules(() => {
        require('../../db/simpleDatabase');
      });
      // Should not throw
    });
  });
});
