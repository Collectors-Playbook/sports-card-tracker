import { useEffect, useRef } from 'react';
import { useCards } from '../context/DexieCardContext';
import { apiService } from '../services/api';
import { cardDatabase } from '../db/simpleDatabase';
import { logInfo, logError } from '../utils/logger';

export const useApi = () => {
  const { setCards, setLoading, setError } = useCards();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Only load once on mount
    if (hasLoadedRef.current) return;

    const loadCards = async () => {
      try {
        logInfo('useApi', 'Loading cards from API');
        setLoading(true);
        setError(null);

        // First, check if the API is available
        await apiService.healthCheck();

        // Load cards from API
        const apiCards = await apiService.getAllCards();
        logInfo('useApi', `Fetched ${apiCards.length} cards from API`);

        // Sync API cards into Dexie so all views (Dashboard, Collections, etc.) can see them
        if (apiCards.length > 0) {
          const existingCards = await cardDatabase.getAllCards();
          const existingIds = new Set(existingCards.map(c => c.id));

          let synced = 0;
          for (const card of apiCards) {
            if (!existingIds.has(card.id)) {
              await cardDatabase.addCard(card);
              synced++;
            }
          }
          if (synced > 0) {
            logInfo('useApi', `Synced ${synced} new cards from API into Dexie`);
          }

          // Reload from Dexie to get the canonical set (with userId/collectionId set correctly)
          const allCards = await cardDatabase.getAllCards();
          setCards(allCards);
        }

        hasLoadedRef.current = true;
      } catch (error) {
        logError('useApi', 'Failed to load cards from API', error as Error);
        setError('Failed to connect to server. Please make sure the server is running.');

        // Try again in 5 seconds if failed
        setTimeout(() => {
          hasLoadedRef.current = false;
        }, 5000);
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, [setCards, setError, setLoading]); // Include dependencies

  return {
    // Health check function for manual use
    healthCheck: async () => {
      try {
        await apiService.healthCheck();
        return true;
      } catch {
        return false;
      }
    }
  };
};