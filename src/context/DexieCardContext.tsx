import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback, useMemo } from 'react';
import { Card, PortfolioStats, CollectionType } from '../types';
import { cardDatabase } from '../db/simpleDatabase';
import { createAutoBackup } from '../utils/backupRestore';

interface CardState {
  cards: Card[];
  loading: boolean;
  error: string | null;
}

interface CardContextType {
  state: CardState;
  addCard: (card: Card) => Promise<void>;
  updateCard: (card: Card) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  setCards: (cards: Card[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getPortfolioStats: (collectionType?: CollectionType) => PortfolioStats;
  clearAllCards: () => void;
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export const CardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CardState>({
    cards: [],
    loading: false, // Start with false to prevent initial flicker
    error: null
  });

  // Load cards on mount
  useEffect(() => {
    let isMounted = true;

    const loadCards = async () => {
      try {
        console.log('Loading cards from Dexie...');
        
        // Clean up old localStorage backups if they exist
        try {
          const oldBackup = localStorage.getItem('sports-cards-auto-backup');
          if (oldBackup) {
            console.log('Found old localStorage backup, cleaning up...');
            localStorage.removeItem('sports-cards-auto-backup');
            localStorage.removeItem('sports-cards-auto-backup-meta');
            console.log('Old localStorage backup removed');
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        
        // First initialize collections for the current user
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            if (user.id) {
              const { collectionsDatabase } = await import('../db/collectionsDatabase');
              await collectionsDatabase.initializeUserCollections(user.id);
              console.log('User collections initialized');
            }
          } catch (e) {
            console.error('Error initializing collections:', e);
          }
        }
        
        const cards = await cardDatabase.getAllCards();
        console.log('[DexieCardContext] getAllCards returned:', cards.length, 'cards');
        
        if (isMounted) {
          setState({
            cards,
            loading: false,
            error: null
          });
          console.log('[DexieCardContext] State updated with', cards.length, 'cards');
          
          // Create auto-backup on startup if we have cards
          if (cards.length > 0) {
            createAutoBackup().catch(error => {
              console.error('Auto-backup failed:', error);
              // Silently fail - auto-backup is not critical
            });
          }
        }
      } catch (error) {
        console.error('Failed to load cards:', error);
        if (isMounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Failed to load cards'
          }));
        }
      }
    };

    loadCards();

    return () => {
      isMounted = false;
    };
  }, []);

  const addCard = useCallback(async (card: Card) => {
    console.log('[DexieCardContext.addCard] Called with card:', card);
    try {
      // If no collectionId, get the default collection
      if (!card.collectionId) {
        console.log('[DexieCardContext.addCard] No collectionId, getting default');
        const { collectionsDatabase } = await import('../db/collectionsDatabase');
        const defaultCollection = await collectionsDatabase.getDefaultCollection();
        if (defaultCollection) {
          card.collectionId = defaultCollection.id;
          console.log('[DexieCardContext.addCard] Set collectionId to:', card.collectionId);
        }
      }
      
      console.log('[DexieCardContext.addCard] Calling cardDatabase.addCard');
      await cardDatabase.addCard(card);
      console.log('[DexieCardContext.addCard] Card added to database successfully');
      
      // Optimistically update state
      setState(prev => ({ 
        ...prev, 
        cards: [...prev.cards, card] 
      }));
      console.log('[DexieCardContext.addCard] State updated');
    } catch (error) {
      console.error('[DexieCardContext.addCard] Error adding card:', error);
      // Reload cards on error to ensure consistency
      const cards = await cardDatabase.getAllCards();
      setState(prev => ({ ...prev, cards }));
      throw error;
    }
  }, []);

  const updateCard = useCallback(async (card: Card) => {
    try {
      console.log('DexieCardContext.updateCard called with:', {
        id: card.id,
        player: card.player,
        currentValue: card.currentValue
      });
      
      await cardDatabase.updateCard(card);
      
      // Optimistically update state
      setState(prev => ({ 
        ...prev, 
        cards: prev.cards.map(c => c.id === card.id ? card : c) 
      }));
      
      console.log('Card updated successfully');
    } catch (error) {
      console.error('Error updating card:', error);
      // Reload cards on error to ensure consistency
      const cards = await cardDatabase.getAllCards();
      setState(prev => ({ ...prev, cards }));
      throw error;
    }
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    try {
      await cardDatabase.deleteCard(id);
      // Optimistically update state
      setState(prev => ({ 
        ...prev, 
        cards: prev.cards.filter(c => c.id !== id) 
      }));
    } catch (error) {
      console.error('Error deleting card:', error);
      // Reload cards on error to ensure consistency
      const cards = await cardDatabase.getAllCards();
      setState(prev => ({ ...prev, cards }));
      throw error;
    }
  }, []);

  const setCards = useCallback((cards: Card[]) => {
    setState(prev => ({ ...prev, cards }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const getPortfolioStats = useCallback((collectionType?: CollectionType): PortfolioStats => {
    const cards = collectionType
      ? state.cards.filter(card => card.collectionType === collectionType)
      : state.cards;
    const totalCards = cards.length;
    const totalCostBasis = cards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const totalCurrentValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
    const totalProfit = totalCurrentValue - totalCostBasis;

    const soldCards = cards.filter(card => card.sellDate && card.sellPrice);
    const totalSold = soldCards.length;
    const totalSoldValue = soldCards.reduce((sum, card) => sum + (card.sellPrice || 0), 0);

    return {
      totalCards,
      totalCostBasis,
      totalCurrentValue,
      totalProfit,
      totalSold,
      totalSoldValue
    };
  }, [state.cards]);

  const clearAllCards = useCallback(async () => {
    try {
      await cardDatabase.clearAllCards();
      setState(prev => ({ ...prev, cards: [] }));
    } catch (error) {
      console.error('Error clearing all cards:', error);
      throw error;
    }
  }, []);

  const value: CardContextType = useMemo(() => ({
    state,
    addCard,
    updateCard,
    deleteCard,
    setCards,
    setLoading,
    setError,
    getPortfolioStats,
    clearAllCards
  }), [state, addCard, updateCard, deleteCard, setCards, setLoading, setError, getPortfolioStats, clearAllCards]);

  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
};

export const useCards = (): CardContextType => {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error('useCards must be used within a CardProvider');
  }
  return context;
};