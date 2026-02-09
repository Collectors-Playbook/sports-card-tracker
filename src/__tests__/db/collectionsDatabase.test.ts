import 'fake-indexeddb/auto';
import { seedLocalStorageUser } from '../helpers/mockBrowserApis';

// Mock simpleDatabase to avoid circular dependency
jest.mock('../../db/simpleDatabase', () => ({
  cardDatabase: {
    getAllCards: jest.fn().mockResolvedValue([]),
    addCard: jest.fn().mockResolvedValue(undefined),
    updateCard: jest.fn().mockResolvedValue(undefined),
  },
  migrateFromLocalStorage: jest.fn(),
}));

describe('collectionsDatabase', () => {
  let collectionsDatabase: typeof import('../../db/collectionsDatabase').collectionsDatabase;

  beforeEach(async () => {
    // Clear all IndexedDB databases
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }

    seedLocalStorageUser('user-test');

    jest.isolateModules(() => {
      const mod = require('../../db/collectionsDatabase');
      collectionsDatabase = mod.collectionsDatabase;
    });
  });

  // ---- initializeUserCollections ----
  describe('initializeUserCollections', () => {
    it('creates a default collection for new user', async () => {
      await collectionsDatabase.initializeUserCollections('user-test');
      const collections = await collectionsDatabase.getUserCollections();
      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections.some(c => c.isDefault)).toBe(true);
    });

    it('does not create duplicate defaults', async () => {
      await collectionsDatabase.initializeUserCollections('user-test');
      await collectionsDatabase.initializeUserCollections('user-test');
      const collections = await collectionsDatabase.getUserCollections();
      const defaults = collections.filter(c => c.isDefault);
      expect(defaults.length).toBe(1);
    });
  });

  // ---- getUserCollections ----
  describe('getUserCollections', () => {
    it('returns empty array when no collections', async () => {
      const collections = await collectionsDatabase.getUserCollections();
      expect(Array.isArray(collections)).toBe(true);
    });

    it('returns collections sorted with default first', async () => {
      await collectionsDatabase.initializeUserCollections('user-test');
      await collectionsDatabase.createCollection({ name: 'Alpha', visibility: 'private' });
      const collections = await collectionsDatabase.getUserCollections();
      if (collections.length > 1) {
        expect(collections[0].isDefault).toBe(true);
      }
    });
  });

  // ---- createCollection ----
  describe('createCollection', () => {
    it('creates a new collection with generated id', async () => {
      const collection = await collectionsDatabase.createCollection({
        name: 'Test Collection',
        visibility: 'private',
      });
      expect(collection.id).toBeTruthy();
      expect(collection.name).toBe('Test Collection');
      expect(collection.isDefault).toBe(false);
    });

    it('rejects duplicate names for same user', async () => {
      await collectionsDatabase.createCollection({ name: 'Dupes', visibility: 'private' });
      await expect(
        collectionsDatabase.createCollection({ name: 'Dupes', visibility: 'private' })
      ).rejects.toThrow('already exists');
    });

    it('sets createdAt and updatedAt', async () => {
      const collection = await collectionsDatabase.createCollection({
        name: 'Dated',
        visibility: 'private',
      });
      expect(collection.createdAt).toBeInstanceOf(Date);
      expect(collection.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ---- updateCollection ----
  describe('updateCollection', () => {
    it('updates collection name', async () => {
      const created = await collectionsDatabase.createCollection({ name: 'Before', visibility: 'private' });
      const updated = await collectionsDatabase.updateCollection(created.id, { name: 'After' });
      expect(updated!.name).toBe('After');
    });

    it('throws for non-existent collection', async () => {
      await expect(
        collectionsDatabase.updateCollection('fake-id', { name: 'X' })
      ).rejects.toThrow('not found');
    });
  });

  // ---- deleteCollection ----
  describe('deleteCollection', () => {
    it('deletes a non-default collection', async () => {
      const col = await collectionsDatabase.createCollection({ name: 'Delete Me', visibility: 'private' });
      const result = await collectionsDatabase.deleteCollection(col.id);
      expect(result).toBe(true);
    });

    it('throws when deleting default collection', async () => {
      await collectionsDatabase.initializeUserCollections('user-test');
      const collections = await collectionsDatabase.getUserCollections();
      const defaultCol = collections.find(c => c.isDefault);
      if (defaultCol) {
        await expect(collectionsDatabase.deleteCollection(defaultCol.id)).rejects.toThrow('Cannot delete default');
      }
    });

    it('throws for non-existent collection', async () => {
      await expect(collectionsDatabase.deleteCollection('fake-id')).rejects.toThrow('not found');
    });
  });

  // ---- getDefaultCollection ----
  describe('getDefaultCollection', () => {
    it('returns null when no default exists then creates one', async () => {
      const result = await collectionsDatabase.getDefaultCollection();
      // getDefaultCollection auto-initializes if missing
      expect(result).toBeTruthy();
    });

    it('returns existing default collection', async () => {
      await collectionsDatabase.initializeUserCollections('user-test');
      const result = await collectionsDatabase.getDefaultCollection();
      expect(result).toBeTruthy();
      expect(result!.isDefault).toBe(true);
    });
  });

  // ---- moveCardsToCollection ----
  describe('moveCardsToCollection', () => {
    it('throws for non-existent target collection', async () => {
      await expect(
        collectionsDatabase.moveCardsToCollection(['card-1'], 'fake-collection')
      ).rejects.toThrow('not found');
    });

    it('resolves for valid target collection with empty card list', async () => {
      const col = await collectionsDatabase.createCollection({ name: 'Target', visibility: 'private' });
      await expect(
        collectionsDatabase.moveCardsToCollection([], col.id)
      ).resolves.not.toThrow();
    });
  });
});
