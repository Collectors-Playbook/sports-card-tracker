import { Card } from '../types';
import Dexie, { Table } from 'dexie';

// Define the database schema using Dexie directly
class SportsCardDatabase extends Dexie {
  cards!: Table<Card>;

  constructor() {
    super('SportsCardDatabase');
    
    // Version 2 - Add userId
    this.version(2).stores({
      cards: 'id, userId, player, year, category, createdAt, currentValue, [year+player], [userId+year], [userId+category]'
    }).upgrade(trans => {
      // Migrate existing cards to have userId from the current logged-in user
      return trans.table('cards').toCollection().modify(card => {
        if (!card.userId) {
          // Get the current user from localStorage
          const authDataStr = localStorage.getItem('auth-state');
          if (authDataStr) {
            try {
              const authData = JSON.parse(authDataStr);
              card.userId = authData.user?.id || 'legacy-user';
            } catch {
              card.userId = 'legacy-user';
            }
          } else {
            card.userId = 'legacy-user';
          }
        }
      });
    });

    // Version 3 - Add collectionId
    this.version(3).stores({
      cards: 'id, userId, collectionId, player, year, category, createdAt, currentValue, [year+player], [userId+year], [userId+category], [userId+collectionId]'
    }).upgrade(async trans => {
      // Note: We'll assign default collections when cards are accessed
      // This avoids circular dependency issues during migration
      return trans.table('cards').toCollection().modify(card => {
        if (!card.collectionId) {
          card.collectionId = null; // Will be assigned on first access
        }
      });
    });

    // Version 4 - Add collectionType (PC vs Inventory)
    this.version(4).stores({
      cards: 'id, userId, collectionId, collectionType, player, year, category, createdAt, currentValue, [year+player], [userId+year], [userId+category], [userId+collectionId], [userId+collectionType]'
    }).upgrade(trans => {
      return trans.table('cards').toCollection().modify(card => {
        if (!card.collectionType) {
          card.collectionType = 'Inventory';
        }
      });
    });
  }
}

// Create database instance
const db = new SportsCardDatabase();

// Get current user ID from auth state
function getCurrentUserId(): string {
  // First check the 'user' localStorage item (used by collections)
  const userStr = localStorage.getItem('user');
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const userId = user.id || 'anonymous';
      return userId;
    } catch (e) {
      console.error('[getCurrentUserId] Error parsing user:', e);
    }
  }
  
  // Fall back to auth-state
  const authDataStr = localStorage.getItem('auth-state');
  
  if (authDataStr) {
    try {
      const authData = JSON.parse(authDataStr);
      const userId = authData.user?.id || 'anonymous';
      return userId;
    } catch (e) {
      console.error('[getCurrentUserId] Error parsing auth-state:', e);
      return 'anonymous';
    }
  }
  
  return 'anonymous';
}

// Export the database instance for debugging
export { db };

// Simple database service
export const cardDatabase = {
  // Get all cards for current user
  async getAllCards(collectionId?: string): Promise<Card[]> {
    try {
      const userId = getCurrentUserId();
      console.log('[getAllCards] Getting cards for userId:', userId);
      
      const cards = await db.cards.where('userId').equals(userId).toArray();
      console.log('[getAllCards] Found cards in database:', cards.length);
      
      // Filter by collection if specified
      const filteredCards = collectionId 
        ? cards.filter(card => card.collectionId === collectionId)
        : cards;
      console.log('[getAllCards] After collection filter:', filteredCards.length, 'collectionId:', collectionId);
      
      // Ensure cards have collectionId (assign default if missing)
      const { collectionsDatabase } = await import('./collectionsDatabase');
      let defaultCollectionId: string | null = null;
      
      const processedCards = await Promise.all(filteredCards.map(async (card) => {
        if (!card.collectionId) {
          // Get default collection ID (cache it)
          if (!defaultCollectionId) {
            const defaultCollection = await collectionsDatabase.getDefaultCollection();
            defaultCollectionId = defaultCollection?.id || null;
            console.log('[getAllCards] Default collection ID:', defaultCollectionId);
          }
          
          if (defaultCollectionId) {
            // Update card with default collection
            await db.cards.update(card.id, { collectionId: defaultCollectionId });
            card.collectionId = defaultCollectionId;
          }
        }
        
        return card;
      }));
      
      return processedCards.map(card => ({
        ...card,
        purchaseDate: typeof card.purchaseDate === 'string' 
          ? new Date(card.purchaseDate)
          : card.purchaseDate,
        sellDate: card.sellDate 
          ? (typeof card.sellDate === 'string' ? new Date(card.sellDate) : card.sellDate)
          : undefined,
        createdAt: typeof card.createdAt === 'string'
          ? new Date(card.createdAt)
          : card.createdAt,
        updatedAt: typeof card.updatedAt === 'string'
          ? new Date(card.updatedAt)
          : card.updatedAt
      }));
    } catch (error) {
      console.error('Error getting cards:', error);
      return [];
    }
  },

  // Get all cards for any user (admin only)
  async getAllCardsAdmin(): Promise<Card[]> {
    try {
      const cards = await db.cards.toArray();
      return cards.map(card => ({
        ...card,
        purchaseDate: typeof card.purchaseDate === 'string' 
          ? new Date(card.purchaseDate)
          : card.purchaseDate,
        sellDate: card.sellDate 
          ? (typeof card.sellDate === 'string' ? new Date(card.sellDate) : card.sellDate)
          : undefined,
        createdAt: typeof card.createdAt === 'string'
          ? new Date(card.createdAt)
          : card.createdAt,
        updatedAt: typeof card.updatedAt === 'string'
          ? new Date(card.updatedAt)
          : card.updatedAt
      }));
    } catch (error) {
      console.error('Error getting all cards:', error);
      return [];
    }
  },

  // Add a card
  async addCard(card: Card): Promise<void> {
    try {
      console.log('[addCard] Starting to add card:', card);
      const now = new Date();
      const userId = getCurrentUserId();
      console.log('[addCard] Current userId:', userId);
      
      // Get default collection if no collectionId provided
      let collectionId = card.collectionId;
      if (!collectionId) {
        console.log('[addCard] No collectionId provided, getting default collection');
        const { collectionsDatabase } = await import('./collectionsDatabase');
        const defaultCollection = await collectionsDatabase.getDefaultCollection();
        collectionId = defaultCollection?.id;
        console.log('[addCard] Default collection ID:', collectionId);
      }
      
      const cardToAdd: Card = {
        ...card,
        id: card.id || `card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        userId: card.userId || userId, // Ensure userId is set
        collectionId: collectionId, // Ensure collectionId is set
        collectionType: card.collectionType || 'Inventory', // Default to Inventory
        createdAt: card.createdAt || now,
        updatedAt: now
      };
      
      console.log('[addCard] Card to add:', cardToAdd);
      await db.cards.add(cardToAdd);
      console.log('[addCard] Card added successfully!');
      
      // Verify the card was added
      const verifyCard = await db.cards.get(cardToAdd.id);
      console.log('[addCard] Verification - card in DB:', verifyCard);
    } catch (error) {
      console.error('[addCard] Error adding card:', error);
      throw error;
    }
  },

  // Update a card
  async updateCard(card: Card): Promise<void> {
    try {
      console.log('simpleDatabase.updateCard called with:', {
        id: card.id,
        player: card.player,
        currentValue: card.currentValue,
        userId: card.userId,
        collectionId: card.collectionId
      });
      
      const updatedCard: Card = {
        ...card,
        updatedAt: new Date()
      };
      
      console.log('About to put card in database with collectionId:', updatedCard.collectionId);
      await db.cards.put(updatedCard);
      console.log('Card updated in database successfully');
      
      // Verify the update was saved
      const verifiedCard = await db.cards.get(card.id);
      console.log('Verified card from database - collectionId:', verifiedCard?.collectionId);
    } catch (error) {
      console.error('Error updating card:', error);
      throw error;
    }
  },

  // Delete a card
  async deleteCard(id: string): Promise<void> {
    try {
      await db.cards.delete(id);
    } catch (error) {
      console.error('Error deleting card:', error);
      throw error;
    }
  },

  // Clear all cards for current user
  async clearAllCards(): Promise<void> {
    try {
      const userId = getCurrentUserId();
      await db.cards.where('userId').equals(userId).delete();
    } catch (error) {
      console.error('Error clearing cards:', error);
      throw error;
    }
  },

  // Get cards count by user (admin only)
  async getCardCountsByUser(): Promise<{ [userId: string]: number }> {
    try {
      const cards = await db.cards.toArray();
      const counts: { [userId: string]: number } = {};
      cards.forEach(card => {
        counts[card.userId] = (counts[card.userId] || 0) + 1;
      });
      return counts;
    } catch (error) {
      console.error('Error getting card counts by user:', error);
      return {};
    }
  },

  // Force reassign cards without collectionId to default collection
  async reassignCardsToDefaultCollection(): Promise<number> {
    try {
      const userId = getCurrentUserId();
      const { collectionsDatabase } = await import('./collectionsDatabase');
      const defaultCollection = await collectionsDatabase.getDefaultCollection();
      
      if (!defaultCollection) {
        throw new Error('No default collection found');
      }
      
      const cards = await db.cards
        .where('userId')
        .equals(userId)
        .filter(card => !card.collectionId)
        .toArray();
      
      for (const card of cards) {
        await db.cards.update(card.id, { collectionId: defaultCollection.id });
      }
      
      return cards.length;
    } catch (error) {
      console.error('Error reassigning cards:', error);
      throw error;
    }
  },

  // Get user statistics (admin only)
  async getUserStatistics(): Promise<Array<{
    userId: string;
    username: string;
    cardCount: number;
    totalValue: number;
    avgValue: number;
  }>> {
    try {
      const cards = await db.cards.toArray();
      const userStats: { [userId: string]: { count: number; value: number } } = {};
      
      // Get user info from localStorage
      const usersStr = localStorage.getItem('sports-card-tracker-users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      const userMap = new Map<string, string>(users.map((u: any) => [u.id, u.username || u.email]));
      
      cards.forEach(card => {
        if (!userStats[card.userId]) {
          userStats[card.userId] = { count: 0, value: 0 };
        }
        userStats[card.userId].count++;
        userStats[card.userId].value += card.currentValue;
      });
      
      return Object.entries(userStats).map(([userId, stats]) => ({
        userId,
        username: userMap.get(userId) || userId,
        cardCount: stats.count,
        totalValue: stats.value,
        avgValue: stats.value / stats.count
      }));
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return [];
    }
  },

  // Subscribe to changes
  subscribeToChanges(_callback: (cards: Card[]) => void): () => void {
    // For now, we'll remove the subscription mechanism to prevent flickering
    // The context will handle state updates through optimistic updates
    return () => {
      // No-op unsubscribe
    };
  }
};

// Migration from localStorage
export async function migrateFromLocalStorage() {
  const MIGRATION_KEY = 'dexie_migration_completed';
  
  if (localStorage.getItem(MIGRATION_KEY) === 'true') {
    console.log('Migration already completed');
    return;
  }

  try {
    const STORAGE_KEY = 'sports-card-tracker-cards';
    const storedData = localStorage.getItem(STORAGE_KEY);
    
    if (!storedData) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      return;
    }

    const cards = JSON.parse(storedData);
    
    if (Array.isArray(cards) && cards.length > 0) {
      console.log(`Migrating ${cards.length} cards from localStorage...`);
      
      for (const card of cards) {
        // Add userId to legacy cards during migration
        const cardWithUser = {
          ...card,
          userId: getCurrentUserId()
        };
        await cardDatabase.addCard(cardWithUser);
      }
      
      console.log('Migration completed successfully');
    }
    
    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// Initialize database and migrate data
migrateFromLocalStorage();