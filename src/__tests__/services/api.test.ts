import { mockFetchSuccess, mockFetchError, mockFetchNetworkError } from '../helpers/mockBrowserApis';
import { createCard } from '../helpers/factories';

// Mock the logger to prevent console noise
jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), getLogs: jest.fn(() => []), clearLogs: jest.fn() },
}));

describe('ApiService', () => {
  let apiService: typeof import('../../services/api').apiService;

  beforeEach(() => {
    jest.isolateModules(() => {
      const mod = require('../../services/api');
      apiService = mod.apiService;
    });
    (fetch as jest.Mock).mockClear();
  });

  // ---- request basics ----
  describe('request basics', () => {
    it('makes GET requests by default', async () => {
      mockFetchSuccess([]);
      await apiService.getAllCards();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('includes auth token when available', async () => {
      localStorage.setItem('token', 'my-token');
      mockFetchSuccess([]);
      await apiService.getAllCards();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        })
      );
    });

    it('handles 204 No Content responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      await expect(apiService.deleteCard('test-id')).resolves.not.toThrow();
    });

    it('uses correct base URL', async () => {
      mockFetchSuccess([]);
      await apiService.getAllCards();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('localhost:8000/api'),
        expect.any(Object)
      );
    });
  });

  // ---- getAllCards ----
  describe('getAllCards', () => {
    it('returns parsed cards with Date objects', async () => {
      const rawCards = [{
        id: '1', player: 'Test', team: 'Team', year: 2023, brand: 'B', category: 'Baseball',
        cardNumber: '1', condition: 'RAW', purchasePrice: 10, purchaseDate: '2023-01-01',
        currentValue: 15, images: [], notes: '', createdAt: '2023-01-01', updatedAt: '2023-01-01',
        userId: 'u1',
      }];
      mockFetchSuccess(rawCards);
      const cards = await apiService.getAllCards();
      expect(cards[0].purchaseDate).toBeInstanceOf(Date);
      expect(cards[0].createdAt).toBeInstanceOf(Date);
    });

    it('returns empty array on success with no cards', async () => {
      mockFetchSuccess([]);
      const cards = await apiService.getAllCards();
      expect(cards).toEqual([]);
    });

    it('throws on error', async () => {
      mockFetchError(500, 'Server down');
      await expect(apiService.getAllCards()).rejects.toThrow();
    });
  });

  // ---- createCard / updateCard ----
  describe('createCard / updateCard', () => {
    it('sends POST for createCard', async () => {
      const card = createCard();
      const responseCard = { ...card, purchaseDate: card.purchaseDate.toISOString(), createdAt: card.createdAt.toISOString(), updatedAt: card.updatedAt.toISOString() };
      mockFetchSuccess(responseCard);
      await apiService.createCard(card);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('sends PUT for updateCard', async () => {
      const card = createCard();
      const responseCard = { ...card, purchaseDate: card.purchaseDate.toISOString(), createdAt: card.createdAt.toISOString(), updatedAt: card.updatedAt.toISOString() };
      mockFetchSuccess(responseCard);
      await apiService.updateCard(card);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/cards/${card.id}`),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('converts dates to ISO strings in request body', async () => {
      const card = createCard();
      const responseCard = { ...card, purchaseDate: card.purchaseDate.toISOString(), createdAt: card.createdAt.toISOString(), updatedAt: card.updatedAt.toISOString() };
      mockFetchSuccess(responseCard);
      await apiService.createCard(card);
      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(typeof body.purchaseDate).toBe('string');
    });
  });

  // ---- error handling ----
  describe('error handling', () => {
    it('throws descriptive error for HTTP errors', async () => {
      mockFetchError(404, 'Not found');
      await expect(apiService.getAllCards()).rejects.toThrow('Not found');
    });

    it('throws network error with helpful message', async () => {
      mockFetchNetworkError();
      await expect(apiService.getAllCards()).rejects.toThrow(/Network error/);
    });

    it('handles JSON parse failure in error response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('parse error')),
        headers: new Headers(),
      });
      await expect(apiService.getAllCards()).rejects.toThrow();
    });

    it('sends DELETE request for deleteCard', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      await apiService.deleteCard('card-1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cards/card-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('healthCheck makes request to /health', async () => {
      mockFetchSuccess({ status: 'ok', message: 'healthy' });
      const result = await apiService.healthCheck();
      expect(result.status).toBe('ok');
    });
  });
});
