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

  // ---- getCard ----
  describe('getCard', () => {
    it('returns a card with Date objects', async () => {
      mockFetchSuccess({
        id: '1', player: 'Test', purchaseDate: '2023-01-01',
        createdAt: '2023-01-01', updatedAt: '2023-01-01',
      });
      const card = await apiService.getCard('1');
      expect(card.purchaseDate).toBeInstanceOf(Date);
    });

    it('throws on error', async () => {
      mockFetchError(404, 'Not found');
      await expect(apiService.getCard('x')).rejects.toThrow();
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

  // ---- deleteCard ----
  describe('deleteCard', () => {
    it('sends DELETE request', async () => {
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

    it('throws on error', async () => {
      mockFetchError(500, 'Delete failed');
      await expect(apiService.deleteCard('x')).rejects.toThrow();
    });
  });

  // ---- Auth ----
  describe('auth methods', () => {
    it('login sends POST with email and password', async () => {
      mockFetchSuccess({ user: { id: '1' }, token: 'tok' });
      await apiService.login('test@test.com', 'pw');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('register sends POST', async () => {
      mockFetchSuccess({ user: { id: '1' }, token: 'tok' });
      await apiService.register('user1', 'test@test.com', 'pw');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('getMe calls /auth/me', async () => {
      mockFetchSuccess({ id: '1', username: 'user' });
      const user = await apiService.getMe();
      expect(user.id).toBe('1');
    });

    it('updateProfile sends PUT', async () => {
      mockFetchSuccess({ id: '1' });
      await apiService.updateProfile({ email: 'new@test.com' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/profile'),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  // ---- eBay Export ----
  describe('eBay export methods', () => {
    it('generateEbayCsv sends POST', async () => {
      mockFetchSuccess({ filename: 'out.csv', totalCards: 5 });
      const result = await apiService.generateEbayCsv({ priceMultiplier: 1, shippingCost: 5 });
      expect(result.filename).toBe('out.csv');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ebay/generate'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('generateEbayCsvAsync sends POST', async () => {
      mockFetchSuccess({ id: 'job-1', type: 'ebay', status: 'pending' });
      const result = await apiService.generateEbayCsvAsync({ priceMultiplier: 1, shippingCost: 5 });
      expect(result.id).toBe('job-1');
    });

    it('downloadEbayCsv fetches blob', async () => {
      const mockBlob = new Blob(['csv,data']);
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers(),
      });
      const blob = await apiService.downloadEbayCsv();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('downloadEbayCsv throws on error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        headers: new Headers(),
      });
      await expect(apiService.downloadEbayCsv()).rejects.toThrow(/Failed to download/);
    });

    it('getEbayExportStatus calls /ebay/status', async () => {
      mockFetchSuccess({ templateExists: true, outputExists: false });
      const result = await apiService.getEbayExportStatus();
      expect(result.templateExists).toBe(true);
    });
  });

  // ---- eBay OAuth ----
  describe('eBay OAuth methods', () => {
    it('getEbayAuthStatus', async () => {
      mockFetchSuccess({ connected: false, ebayUsername: null, environment: 'sandbox', isConfigured: false });
      const status = await apiService.getEbayAuthStatus();
      expect(status.connected).toBe(false);
    });

    it('getEbayAuthorizationUrl', async () => {
      mockFetchSuccess({ url: 'https://ebay.com/auth' });
      const result = await apiService.getEbayAuthorizationUrl();
      expect(result.url).toBe('https://ebay.com/auth');
    });

    it('disconnectEbay sends POST', async () => {
      mockFetchSuccess({ disconnected: true });
      const result = await apiService.disconnectEbay();
      expect(result.disconnected).toBe(true);
    });

    it('refreshEbayToken sends POST', async () => {
      mockFetchSuccess({ refreshed: true });
      const result = await apiService.refreshEbayToken();
      expect(result.refreshed).toBe(true);
    });
  });

  // ---- Files ----
  describe('file methods', () => {
    it('getProcessedFiles', async () => {
      mockFetchSuccess([{ name: 'card.jpg', size: 1024 }]);
      const files = await apiService.getProcessedFiles();
      expect(files).toHaveLength(1);
    });

    it('deleteProcessedFile sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteProcessedFile('card.jpg');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/processed/card.jpg'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('getRawFiles', async () => {
      mockFetchSuccess([{ name: 'raw.jpg' }]);
      const files = await apiService.getRawFiles();
      expect(files).toHaveLength(1);
    });

    it('deleteRawFile sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteRawFile('raw.jpg');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/raw/raw.jpg'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('uploadRawFiles sends FormData', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uploaded: [{ name: 'f.jpg' }], count: 1 }),
        headers: new Headers(),
      });
      const file = new File(['data'], 'f.jpg', { type: 'image/jpeg' });
      const result = await apiService.uploadRawFiles([file]);
      expect(result.count).toBe(1);
      // Verify FormData was used (no Content-Type header)
      const callArgs = (fetch as jest.Mock).mock.calls[0][1];
      expect(callArgs.body).toBeInstanceOf(FormData);
    });

    it('uploadRawFiles throws on error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid type' }),
        headers: new Headers(),
      });
      const file = new File(['data'], 'f.pdf');
      await expect(apiService.uploadRawFiles([file])).rejects.toThrow('Invalid type');
    });

    it('replaceRawFile sends PUT with FormData', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'card.jpg' }),
        headers: new Headers(),
      });
      const blob = new Blob(['data']);
      await apiService.replaceRawFile('card.jpg', blob);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/raw/card.jpg'),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('replaceRawFile throws on error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
        headers: new Headers(),
      });
      const blob = new Blob(['data']);
      await expect(apiService.replaceRawFile('x.jpg', blob)).rejects.toThrow('Not found');
    });
  });

  // ---- Image Processing ----
  describe('image processing methods', () => {
    it('processRawImages sends POST', async () => {
      mockFetchSuccess({ id: 'job-1', type: 'image-processing', status: 'pending' });
      const result = await apiService.processRawImages(['card.jpg']);
      expect(result.id).toBe('job-1');
    });

    it('getJob fetches job by ID', async () => {
      mockFetchSuccess({ id: 'job-1', type: 'test', status: 'complete' });
      const job = await apiService.getJob('job-1');
      expect(job.status).toBe('complete');
    });

    it('identifyCard sends POST', async () => {
      mockFetchSuccess({ player: 'Trout', confidence: { score: 85 } });
      const result = await apiService.identifyCard('card.jpg');
      expect(result.player).toBe('Trout');
    });

    it('identifyCard with backFile', async () => {
      mockFetchSuccess({ player: 'Trout' });
      await apiService.identifyCard('front.jpg', 'back.jpg');
      const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.backFile).toBe('back.jpg');
    });

    it('confirmCard sends POST', async () => {
      mockFetchSuccess({ filename: 'card.jpg', status: 'processed', cardId: 'c1' });
      const result = await apiService.confirmCard('card.jpg', { player: 'Test' });
      expect(result.cardId).toBe('c1');
    });

    it('getCardByImage returns card with Date objects', async () => {
      mockFetchSuccess({
        id: '1', player: 'Test', purchaseDate: '2023-01-01',
        createdAt: '2023-01-01', updatedAt: '2023-01-01',
      });
      const card = await apiService.getCardByImage('card.jpg');
      expect(card.purchaseDate).toBeInstanceOf(Date);
    });
  });

  // ---- Heatmap ----
  describe('heatmap methods', () => {
    it('getHeatmapData', async () => {
      mockFetchSuccess({ period: '30d', periodStartDate: '2023-01-01', cards: [] });
      const result = await apiService.getHeatmapData('30d');
      expect(result.period).toBe('30d');
    });

    it('backfillValueSnapshots sends POST', async () => {
      mockFetchSuccess({ backfilled: 42 });
      const result = await apiService.backfillValueSnapshots();
      expect(result.backfilled).toBe(42);
    });
  });

  // ---- Comps ----
  describe('comp methods', () => {
    it('generateComps fetches by cardId', async () => {
      mockFetchSuccess({ cardId: 'c1', aggregateAverage: 50 });
      const result = await apiService.generateComps('c1');
      expect(result.cardId).toBe('c1');
    });

    it('getStoredComps returns null on error', async () => {
      mockFetchError(404, 'Not found');
      const result = await apiService.getStoredComps('c1');
      expect(result).toBeNull();
    });

    it('getStoredComps returns report on success', async () => {
      mockFetchSuccess({ cardId: 'c1', aggregateAverage: 50 });
      const result = await apiService.getStoredComps('c1');
      expect(result).not.toBeNull();
      expect(result!.cardId).toBe('c1');
    });

    it('getCompHistory', async () => {
      mockFetchSuccess([{ cardId: 'c1' }]);
      const result = await apiService.getCompHistory('c1', 5);
      expect(result).toHaveLength(1);
    });

    it('refreshComps adds refresh=true', async () => {
      mockFetchSuccess({ cardId: 'c1', aggregateAverage: 99 });
      await apiService.refreshComps('c1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/comps/c1?refresh=true'),
        expect.any(Object)
      );
    });

    it('getPopSummary', async () => {
      mockFetchSuccess([{ cardId: 'c1', rarityTier: 'low' }]);
      const result = await apiService.getPopSummary();
      expect(result[0].rarityTier).toBe('low');
    });

    it('getPopHistory', async () => {
      mockFetchSuccess([{ totalGraded: 100 }]);
      const result = await apiService.getPopHistory('c1', 10);
      expect(result[0].totalGraded).toBe(100);
    });

    it('generateBulkComps sends POST to /jobs', async () => {
      mockFetchSuccess({ id: 'job-1', type: 'comp-generation', status: 'pending' });
      const result = await apiService.generateBulkComps(['c1', 'c2']);
      expect(result.type).toBe('comp-generation');
    });
  });

  // ---- Health ----
  describe('healthCheck', () => {
    it('makes request to /health', async () => {
      mockFetchSuccess({ status: 'ok', message: 'healthy' });
      const result = await apiService.healthCheck();
      expect(result.status).toBe('ok');
    });

    it('throws on error', async () => {
      mockFetchNetworkError();
      await expect(apiService.healthCheck()).rejects.toThrow();
    });
  });

  // ---- Audit Logs ----
  describe('audit log methods', () => {
    it('getAuditLogs with params', async () => {
      mockFetchSuccess({ entries: [], total: 0 });
      const result = await apiService.getAuditLogs({ action: 'card.create', limit: 10 });
      expect(result.total).toBe(0);
    });

    it('getAuditLogActions', async () => {
      mockFetchSuccess(['card.create', 'card.delete']);
      const actions = await apiService.getAuditLogActions();
      expect(actions).toContain('card.create');
    });

    it('deleteAuditLog sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteAuditLog('log-1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/audit-logs/log-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('deleteAuditLogsBulk sends POST', async () => {
      mockFetchSuccess({ deletedCount: 3 });
      const result = await apiService.deleteAuditLogsBulk(['1', '2', '3']);
      expect(result.deletedCount).toBe(3);
    });

    it('purgeAuditLogs sends POST', async () => {
      mockFetchSuccess({ deletedCount: 10 });
      const result = await apiService.purgeAuditLogs('2023-01-01', { action: 'card.create' });
      expect(result.deletedCount).toBe(10);
    });

    it('exportAuditLogs triggers download', async () => {
      const mockBlob = new Blob(['data']);
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ 'Content-Disposition': 'attachment; filename="audit-logs.csv"' }),
      });
      // Mock DOM elements
      const clickSpy = jest.fn();
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValueOnce({
        href: '',
        download: '',
        click: clickSpy,
      } as any);
      jest.spyOn(document.body, 'appendChild').mockImplementationOnce(() => null as any);
      jest.spyOn(document.body, 'removeChild').mockImplementationOnce(() => null as any);

      await apiService.exportAuditLogs('csv');
      expect(clickSpy).toHaveBeenCalled();
      createElementSpy.mockRestore();
    });

    it('exportAuditLogs throws on error', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Export failed' }),
        headers: new Headers(),
      });
      await expect(apiService.exportAuditLogs('csv')).rejects.toThrow('Export failed');
    });
  });

  // ---- Collections ----
  describe('collection methods', () => {
    it('getCollections', async () => {
      mockFetchSuccess([{ id: 'c1', name: 'My Cards' }]);
      const result = await apiService.getCollections();
      expect(result).toHaveLength(1);
    });

    it('getDefaultCollection', async () => {
      mockFetchSuccess({ id: 'c1', isDefault: true });
      const result = await apiService.getDefaultCollection();
      expect(result.isDefault).toBe(true);
    });

    it('getCollection', async () => {
      mockFetchSuccess({ id: 'c1', name: 'Test' });
      const result = await apiService.getCollection('c1');
      expect(result.name).toBe('Test');
    });

    it('getCollectionStats', async () => {
      mockFetchSuccess({ cardCount: 5, totalValue: 100 });
      const stats = await apiService.getCollectionStats('c1');
      expect(stats.cardCount).toBe(5);
    });

    it('createCollection sends POST', async () => {
      mockFetchSuccess({ id: 'c1', name: 'New' });
      const result = await apiService.createCollection({ name: 'New' });
      expect(result.name).toBe('New');
    });

    it('updateCollection sends PUT', async () => {
      mockFetchSuccess({ id: 'c1', name: 'Updated' });
      const result = await apiService.updateCollection('c1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('deleteCollection sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteCollection('c1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/collections/c1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('setCollectionAsDefault sends POST', async () => {
      mockFetchSuccess({ id: 'c1', isDefault: true });
      await apiService.setCollectionAsDefault('c1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/collections/c1/set-default'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('moveCardsToCollection sends POST', async () => {
      mockFetchSuccess({ moved: 3 });
      const result = await apiService.moveCardsToCollection(['a', 'b', 'c'], 'col-1');
      expect(result.moved).toBe(3);
    });

    it('initializeCollections sends POST', async () => {
      mockFetchSuccess({ id: 'c1' });
      await apiService.initializeCollections();
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/collections/initialize'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // ---- Admin Users ----
  describe('admin user methods', () => {
    it('getAdminUsers', async () => {
      mockFetchSuccess([{ id: 'u1', username: 'admin' }]);
      const users = await apiService.getAdminUsers();
      expect(users).toHaveLength(1);
    });

    it('getAdminUser', async () => {
      mockFetchSuccess({ id: 'u1', username: 'admin' });
      const user = await apiService.getAdminUser('u1');
      expect(user.username).toBe('admin');
    });

    it('createAdminUser sends POST', async () => {
      mockFetchSuccess({ id: 'u1', username: 'newuser' });
      const user = await apiService.createAdminUser({ username: 'newuser', email: 'a@b.com', password: 'pw' });
      expect(user.username).toBe('newuser');
    });

    it('updateAdminUser sends PUT', async () => {
      mockFetchSuccess({ id: 'u1', username: 'updated' });
      const user = await apiService.updateAdminUser('u1', { username: 'updated' });
      expect(user.username).toBe('updated');
    });

    it('resetAdminUserPassword sends POST', async () => {
      mockFetchSuccess({ message: 'Password reset' });
      const result = await apiService.resetAdminUserPassword('u1', 'newpw');
      expect(result.message).toBe('Password reset');
    });

    it('toggleAdminUserStatus sends POST', async () => {
      mockFetchSuccess({ id: 'u1', isActive: false });
      const user = await apiService.toggleAdminUserStatus('u1');
      expect(user.isActive).toBe(false);
    });

    it('changeAdminUserRole sends POST', async () => {
      mockFetchSuccess({ id: 'u1', role: 'admin' });
      const user = await apiService.changeAdminUserRole('u1', 'admin');
      expect(user.role).toBe('admin');
    });

    it('deleteAdminUser sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteAdminUser('u1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/users/u1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ---- Grading Submissions ----
  describe('grading submission methods', () => {
    it('getGradingSubmissions', async () => {
      mockFetchSuccess([{ id: 's1' }]);
      const subs = await apiService.getGradingSubmissions({ status: 'Submitted' });
      expect(subs).toHaveLength(1);
    });

    it('getGradingSubmissions without filters', async () => {
      mockFetchSuccess([]);
      const subs = await apiService.getGradingSubmissions();
      expect(subs).toEqual([]);
    });

    it('getGradingSubmission', async () => {
      mockFetchSuccess({ id: 's1', status: 'Submitted' });
      const sub = await apiService.getGradingSubmission('s1');
      expect(sub.status).toBe('Submitted');
    });

    it('getGradingStats', async () => {
      mockFetchSuccess({ totalSubmissions: 5, pending: 2, complete: 3 });
      const stats = await apiService.getGradingStats();
      expect(stats.totalSubmissions).toBe(5);
    });

    it('createGradingSubmission sends POST', async () => {
      mockFetchSuccess({ id: 's1' });
      const sub = await apiService.createGradingSubmission({
        cardId: 'c1', gradingCompany: 'PSA', submissionNumber: 'SUB1',
        tier: 'Regular', cost: 30, submittedAt: '2023-01-01',
      });
      expect(sub.id).toBe('s1');
    });

    it('updateGradingSubmission sends PUT', async () => {
      mockFetchSuccess({ id: 's1', notes: 'updated' });
      const sub = await apiService.updateGradingSubmission('s1', { notes: 'updated' } as any);
      expect(sub.notes).toBe('updated');
    });

    it('updateGradingSubmissionStatus sends POST', async () => {
      mockFetchSuccess({ id: 's1', status: 'Complete', grade: '9.5' });
      const sub = await apiService.updateGradingSubmissionStatus('s1', 'Complete', '9.5');
      expect(sub.grade).toBe('9.5');
    });

    it('deleteGradingSubmission sends DELETE', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers() });
      await apiService.deleteGradingSubmission('s1');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/grading-submissions/s1'),
        expect.objectContaining({ method: 'DELETE' })
      );
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
  });
});
