import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { createCardData } from '../helpers/factories';
import { _resetRateLimitState as resetOneThirtyPointRateLimit } from '../../services/adapters/oneThirtyPoint';

describe('Comp Routes', () => {
  let ctx: TestContext;
  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    // Mock fetch so 130Point adapter doesn't make real HTTP calls
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network disabled in test'));
    ctx = await createTestApp();
  });

  beforeEach(() => {
    resetOneThirtyPointRateLimit();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
    fetchSpy.mockRestore();
  });

  describe('POST /api/comps/generate', () => {
    it('returns a comp report', async () => {
      const res = await request(ctx.app)
        .post('/api/comps/generate')
        .send({
          cardId: 'test-1',
          player: 'Mike Trout',
          year: 2023,
          brand: 'Topps',
          cardNumber: '1',
        });

      expect(res.status).toBe(200);
      expect(res.body.cardId).toBe('test-1');
      expect(res.body.player).toBe('Mike Trout');
      expect(res.body.sources).toBeDefined();
      expect(Array.isArray(res.body.sources)).toBe(true);
      expect(res.body.generatedAt).toBeDefined();
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/comps/generate')
        .send({ cardId: 'test-1', player: 'Mike Trout' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });
  });

  describe('POST /api/comps/generate-and-save', () => {
    it('generates and saves comp file', async () => {
      const res = await request(ctx.app)
        .post('/api/comps/generate-and-save')
        .send({
          cardId: 'save-1',
          player: 'Shohei Ohtani',
          year: 2023,
          brand: 'Topps',
          cardNumber: '100',
        });

      expect(res.status).toBe(200);
      expect(res.body.cardId).toBe('save-1');
      expect(res.body.sources).toBeDefined();
    });
  });

  describe('GET /api/comps/:cardId', () => {
    it('generates comps from card data', async () => {
      const cardData = createCardData({ player: 'Aaron Judge', year: 2023, brand: 'Topps', cardNumber: '99' });
      const created = await request(ctx.app).post('/api/cards').send(cardData);
      const cardId = created.body.id;

      const res = await request(ctx.app).get(`/api/comps/${cardId}`);

      expect(res.status).toBe(200);
      expect(res.body.cardId).toBe(cardId);
      expect(res.body.player).toBe('Aaron Judge');
      expect(res.body.sources).toBeDefined();
    });

    it('returns 404 for non-existent card', async () => {
      const res = await request(ctx.app).get('/api/comps/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
