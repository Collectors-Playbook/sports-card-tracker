import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CardProvider, useCards } from '../../context/DexieCardContext';
import { createCard } from '../helpers/factories';

// Mock dependencies
jest.mock('../../db/simpleDatabase', () => {
  let cards: any[] = [];
  return {
    cardDatabase: {
      getAllCards: jest.fn(() => Promise.resolve([...cards])),
      addCard: jest.fn((card: any) => {
        cards.push(card);
        return Promise.resolve();
      }),
      updateCard: jest.fn((card: any) => {
        cards = cards.map(c => c.id === card.id ? card : c);
        return Promise.resolve();
      }),
      deleteCard: jest.fn((id: string) => {
        cards = cards.filter(c => c.id !== id);
        return Promise.resolve();
      }),
      clearAllCards: jest.fn(() => {
        cards = [];
        return Promise.resolve();
      }),
      subscribeToChanges: jest.fn(() => jest.fn()),
    },
    migrateFromLocalStorage: jest.fn(),
    __resetCards: () => { cards = []; },
  };
});

jest.mock('../../db/collectionsDatabase', () => ({
  collectionsDatabase: {
    initializeUserCollections: jest.fn().mockResolvedValue(undefined),
    getDefaultCollection: jest.fn().mockResolvedValue({ id: 'default-col' }),
  },
}));

jest.mock('../../utils/backupRestore', () => ({
  createAutoBackup: jest.fn().mockResolvedValue(undefined),
}));

const TestConsumer: React.FC = () => {
  const { state, addCard, updateCard, deleteCard, getPortfolioStats, clearAllCards } = useCards();
  const stats = getPortfolioStats();

  return (
    <div>
      <div data-testid="count">{state.cards.length}</div>
      <div data-testid="loading">{String(state.loading)}</div>
      <div data-testid="error">{state.error || 'none'}</div>
      <div data-testid="total-value">{stats.totalCurrentValue}</div>
      <div data-testid="total-cost">{stats.totalCostBasis}</div>
      <button data-testid="add" onClick={() => addCard(createCard({ id: `card-${Date.now()}` }))}>Add</button>
      <button data-testid="clear" onClick={() => clearAllCards()}>Clear</button>
      {state.cards.length > 0 && (
        <>
          <button data-testid="update" onClick={() => updateCard({ ...state.cards[0], currentValue: 999 })}>Update</button>
          <button data-testid="delete" onClick={() => deleteCard(state.cards[0].id)}>Delete</button>
        </>
      )}
    </div>
  );
};

const renderCard = () =>
  render(
    <CardProvider>
      <TestConsumer />
    </CardProvider>
  );

describe('DexieCardContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const db = require('../../db/simpleDatabase');
    db.__resetCards();
  });

  // ---- Card CRUD ----
  describe('Card CRUD', () => {
    it('starts with empty cards', async () => {
      renderCard();
      await waitFor(() => {
        expect(screen.getByTestId('count').textContent).toBe('0');
      });
    });

    it('adds a card', async () => {
      renderCard();
      await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));

      await act(async () => {
        screen.getByTestId('add').click();
      });
      expect(screen.getByTestId('count').textContent).toBe('1');
    });

    it('updates a card', async () => {
      renderCard();
      await act(async () => {
        screen.getByTestId('add').click();
      });
      await act(async () => {
        screen.getByTestId('update').click();
      });
      // The card should be updated (state refreshed)
      expect(screen.getByTestId('total-value').textContent).toBe('999');
    });

    it('deletes a card', async () => {
      renderCard();
      await act(async () => {
        screen.getByTestId('add').click();
      });
      expect(screen.getByTestId('count').textContent).toBe('1');
      await act(async () => {
        screen.getByTestId('delete').click();
      });
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
  });

  // ---- Portfolio stats ----
  describe('portfolio stats', () => {
    it('calculates total current value', async () => {
      renderCard();
      await act(async () => {
        screen.getByTestId('add').click();
      });
      const value = Number(screen.getByTestId('total-value').textContent);
      expect(value).toBeGreaterThan(0);
    });

    it('calculates total cost basis', async () => {
      renderCard();
      await act(async () => {
        screen.getByTestId('add').click();
      });
      const cost = Number(screen.getByTestId('total-cost').textContent);
      expect(cost).toBeGreaterThan(0);
    });
  });

  // ---- Loading / error states ----
  describe('loading/error states', () => {
    it('shows no error initially', async () => {
      renderCard();
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('none');
      });
    });

    it('handles clearAllCards', async () => {
      renderCard();
      await act(async () => {
        screen.getByTestId('add').click();
      });
      expect(screen.getByTestId('count').textContent).toBe('1');
      await act(async () => {
        screen.getByTestId('clear').click();
      });
      expect(screen.getByTestId('count').textContent).toBe('0');
    });
  });
});
