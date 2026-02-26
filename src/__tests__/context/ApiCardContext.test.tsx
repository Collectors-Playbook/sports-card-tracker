import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CardProvider, useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';

// Mock dependencies — wrapper pattern for CRA resetMocks
const mockHealthCheck = jest.fn();
const mockGetAllCards = jest.fn();
const mockCreateCard = jest.fn();
const mockUpdateCard = jest.fn();
const mockDeleteCard = jest.fn();

jest.mock('../../services/api', () => ({
  apiService: {
    healthCheck: (...args: any[]) => mockHealthCheck(...args),
    getAllCards: (...args: any[]) => mockGetAllCards(...args),
    createCard: (...args: any[]) => mockCreateCard(...args),
    updateCard: (...args: any[]) => mockUpdateCard(...args),
    deleteCard: (...args: any[]) => mockDeleteCard(...args),
  },
}));

const card1: Card = {
  id: 'card-1',
  userId: 'user-1',
  collectionId: 'col-1',
  player: 'Mike Trout',
  team: 'Angels',
  year: 2023,
  brand: 'Topps',
  category: 'Baseball',
  cardNumber: '1',
  condition: 'RAW',
  purchasePrice: 50,
  purchaseDate: new Date('2023-01-01'),
  currentValue: 100,
  images: [],
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
  collectionType: 'Inventory',
};

const card2: Card = {
  ...card1,
  id: 'card-2',
  player: 'Aaron Judge',
  purchasePrice: 30,
  currentValue: 60,
};

const soldCard: Card = {
  ...card1,
  id: 'card-3',
  player: 'Sold Player',
  purchasePrice: 20,
  currentValue: 40,
  sellPrice: 45,
  sellDate: new Date('2024-01-15'),
};

// Test consumer that exposes context methods
let contextRef: ReturnType<typeof useCards> | null = null;

const TestConsumer: React.FC = () => {
  const ctx = useCards();
  contextRef = ctx;
  const { state } = ctx;
  return (
    <div>
      <div data-testid="cards-count">{state.cards.length}</div>
      <div data-testid="loading">{String(state.loading)}</div>
      <div data-testid="error">{state.error || 'none'}</div>
      <div data-testid="card-names">{state.cards.map(c => c.player).join(',')}</div>
    </div>
  );
};

const renderCards = () =>
  render(
    <CardProvider>
      <TestConsumer />
    </CardProvider>
  );

describe('ApiCardContext', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    contextRef = null;
    mockHealthCheck.mockResolvedValue({ status: 'ok' });
    mockGetAllCards.mockResolvedValue([card1, card2]);
    mockCreateCard.mockImplementation(async (card: Card) => ({ ...card, id: 'new-id' }));
    mockUpdateCard.mockImplementation(async (card: Card) => card);
    mockDeleteCard.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Initial load ────────────────────────────────────────────────────

  describe('initial load', () => {
    it('loads cards from API on mount', async () => {
      renderCards();

      // Initially loading
      expect(screen.getByTestId('loading').textContent).toBe('true');

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('cards-count').textContent).toBe('2');
        expect(screen.getByTestId('error').textContent).toBe('none');
      });

      expect(mockHealthCheck).toHaveBeenCalled();
      expect(mockGetAllCards).toHaveBeenCalled();
    });

    it('sets error when API fails', async () => {
      mockHealthCheck.mockRejectedValue(new Error('Server down'));

      renderCards();

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('error').textContent).toContain('Failed to connect');
      });
    });

    it('retries after failure', async () => {
      mockHealthCheck.mockRejectedValueOnce(new Error('fail'));

      renderCards();

      await act(async () => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toContain('Failed to connect');
      });

      // Now fix the mock for retry
      mockHealthCheck.mockResolvedValue({ status: 'ok' });

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cards-count').textContent).toBe('2');
        expect(screen.getByTestId('error').textContent).toBe('none');
      });
    });
  });

  // ─── addCard ─────────────────────────────────────────────────────────

  describe('addCard', () => {
    it('creates card via API and updates state', async () => {
      renderCards();

      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      const newCard = { ...card1, id: 'temp', player: 'New Player' };
      mockCreateCard.mockResolvedValueOnce({ ...newCard, id: 'server-id' });

      await act(async () => {
        await contextRef!.addCard(newCard);
      });

      await waitFor(() => {
        expect(screen.getByTestId('cards-count').textContent).toBe('3');
      });
      expect(mockCreateCard).toHaveBeenCalledWith(newCard);
    });

    it('throws on API error', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      mockCreateCard.mockRejectedValueOnce(new Error('Create failed'));

      await expect(
        act(async () => { await contextRef!.addCard(card1); })
      ).rejects.toThrow('Create failed');
    });
  });

  // ─── updateCard ──────────────────────────────────────────────────────

  describe('updateCard', () => {
    it('updates card via API and replaces in state', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      const updated = { ...card1, player: 'Updated Trout' };
      mockUpdateCard.mockResolvedValueOnce(updated);

      await act(async () => {
        await contextRef!.updateCard(updated);
      });

      await waitFor(() => {
        expect(screen.getByTestId('card-names').textContent).toContain('Updated Trout');
      });
    });

    it('throws on API error', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      mockUpdateCard.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        act(async () => { await contextRef!.updateCard(card1); })
      ).rejects.toThrow('Update failed');
    });
  });

  // ─── deleteCard ──────────────────────────────────────────────────────

  describe('deleteCard', () => {
    it('deletes card via API and removes from state', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('cards-count').textContent).toBe('2'));

      await act(async () => {
        await contextRef!.deleteCard('card-1');
      });

      await waitFor(() => {
        expect(screen.getByTestId('cards-count').textContent).toBe('1');
        expect(screen.getByTestId('card-names').textContent).not.toContain('Mike Trout');
      });
      expect(mockDeleteCard).toHaveBeenCalledWith('card-1');
    });

    it('throws on API error', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      mockDeleteCard.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(
        act(async () => { await contextRef!.deleteCard('card-1'); })
      ).rejects.toThrow('Delete failed');
    });
  });

  // ─── setters ─────────────────────────────────────────────────────────

  describe('setters', () => {
    it('setCards replaces the cards array', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('cards-count').textContent).toBe('2'));

      act(() => {
        contextRef!.setCards([card1]);
      });

      expect(screen.getByTestId('cards-count').textContent).toBe('1');
    });

    it('setLoading updates loading state', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      act(() => {
        contextRef!.setLoading(true);
      });

      expect(screen.getByTestId('loading').textContent).toBe('true');
    });

    it('setError updates error state', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      act(() => {
        contextRef!.setError('Something went wrong');
      });

      expect(screen.getByTestId('error').textContent).toBe('Something went wrong');
    });
  });

  // ─── getPortfolioStats ──────────────────────────────────────────────

  describe('getPortfolioStats', () => {
    it('returns stats for all cards', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      const stats = contextRef!.getPortfolioStats();
      expect(stats.totalCards).toBe(2);
      expect(stats.totalCostBasis).toBe(80); // 50 + 30
      expect(stats.totalCurrentValue).toBe(160); // 100 + 60
      expect(stats.totalProfit).toBe(80); // 160 - 80
      expect(stats.totalSold).toBe(0);
      expect(stats.totalSoldValue).toBe(0);
    });

    it('filters by collectionType', async () => {
      mockGetAllCards.mockResolvedValue([
        { ...card1, collectionType: 'Inventory' },
        { ...card2, collectionType: 'PC' },
      ]);

      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      const invStats = contextRef!.getPortfolioStats('Inventory');
      expect(invStats.totalCards).toBe(1);
      expect(invStats.totalCostBasis).toBe(50);

      const pcStats = contextRef!.getPortfolioStats('PC');
      expect(pcStats.totalCards).toBe(1);
      expect(pcStats.totalCostBasis).toBe(30);
    });

    it('computes sold card stats', async () => {
      mockGetAllCards.mockResolvedValue([card1, soldCard]);

      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      const stats = contextRef!.getPortfolioStats();
      expect(stats.totalSold).toBe(1);
      expect(stats.totalSoldValue).toBe(45);
    });
  });

  // ─── clearAllCards ──────────────────────────────────────────────────

  describe('clearAllCards', () => {
    it('deletes all cards and resets state', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('cards-count').textContent).toBe('2'));

      await act(async () => {
        await contextRef!.clearAllCards();
      });

      await waitFor(() => {
        expect(screen.getByTestId('cards-count').textContent).toBe('0');
      });
      expect(mockDeleteCard).toHaveBeenCalledTimes(2);
    });

    it('throws on API error', async () => {
      renderCards();
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

      mockDeleteCard.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(
        act(async () => { await contextRef!.clearAllCards(); })
      ).rejects.toThrow('Clear failed');
    });
  });

  // ─── useCards hook ──────────────────────────────────────────────────

  describe('useCards hook', () => {
    it('throws when used outside provider', () => {
      const Orphan: React.FC = () => {
        useCards();
        return null;
      };

      expect(() => render(<Orphan />)).toThrow('useCards must be used within a CardProvider');
    });
  });
});
