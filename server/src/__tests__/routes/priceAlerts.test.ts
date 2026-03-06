import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { createCardData } from '../helpers/factories';

describe('Price Alert Routes', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ username: 'alertuser', email: 'alert@test.com', password: 'password123' });
    token = res.body.token;
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function createCard(overrides = {}) {
    const res = await request(ctx.app)
      .post('/api/cards')
      .set(auth())
      .send(createCardData(overrides));
    return res.body;
  }

  describe('POST /api/price-alerts', () => {
    it('creates an above alert', async () => {
      const card = await createCard({ currentValue: 50 });

      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'above', thresholdHigh: 100 });

      expect(res.status).toBe(201);
      expect(res.body.cardId).toBe(card.id);
      expect(res.body.type).toBe('above');
      expect(res.body.thresholdHigh).toBe(100);
      expect(res.body.isEnabled).toBe(true);
    });

    it('creates a below alert', async () => {
      const card = await createCard({ currentValue: 50 });

      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'below', thresholdLow: 20 });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('below');
      expect(res.body.thresholdLow).toBe(20);
    });

    it('rejects missing cardId', async () => {
      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ type: 'above', thresholdHigh: 100 });
      expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
      const card = await createCard();
      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'invalid', thresholdHigh: 100 });
      expect(res.status).toBe(400);
    });

    it('rejects above alert without thresholdHigh', async () => {
      const card = await createCard();
      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'above' });
      expect(res.status).toBe(400);
    });

    it('rejects below alert without thresholdLow', async () => {
      const card = await createCard();
      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'below' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/price-alerts')
        .send({ cardId: 'some-id', type: 'above', thresholdHigh: 100 });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/price-alerts', () => {
    it('returns alerts for the authenticated user', async () => {
      const res = await request(ctx.app)
        .get('/api/price-alerts')
        .set(auth());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app).get('/api/price-alerts');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/price-alerts/card/:cardId', () => {
    it('returns alerts for a specific card', async () => {
      const card = await createCard({ currentValue: 75 });
      await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'above', thresholdHigh: 150 });

      const res = await request(ctx.app)
        .get(`/api/price-alerts/card/${card.id}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].cardId).toBe(card.id);
    });
  });

  describe('PUT /api/price-alerts/:id', () => {
    it('updates an alert threshold', async () => {
      const card = await createCard({ currentValue: 50 });
      const createRes = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'above', thresholdHigh: 100 });

      const res = await request(ctx.app)
        .put(`/api/price-alerts/${createRes.body.id}`)
        .set(auth())
        .send({ thresholdHigh: 200 });

      expect(res.status).toBe(200);
      expect(res.body.thresholdHigh).toBe(200);
    });

    it('disables an alert', async () => {
      const card = await createCard({ currentValue: 50 });
      const createRes = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'below', thresholdLow: 10 });

      const res = await request(ctx.app)
        .put(`/api/price-alerts/${createRes.body.id}`)
        .set(auth())
        .send({ isEnabled: false });

      expect(res.status).toBe(200);
      expect(res.body.isEnabled).toBe(false);
    });

    it('returns 404 for non-existent alert', async () => {
      const res = await request(ctx.app)
        .put('/api/price-alerts/nonexistent')
        .set(auth())
        .send({ thresholdHigh: 200 });
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .put('/api/price-alerts/some-id')
        .send({ thresholdHigh: 200 });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/price-alerts/:id', () => {
    it('deletes an alert', async () => {
      const card = await createCard({ currentValue: 50 });
      const createRes = await request(ctx.app)
        .post('/api/price-alerts')
        .set(auth())
        .send({ cardId: card.id, type: 'above', thresholdHigh: 100 });

      const res = await request(ctx.app)
        .delete(`/api/price-alerts/${createRes.body.id}`)
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const checkRes = await request(ctx.app)
        .get(`/api/price-alerts/card/${card.id}`);
      expect(checkRes.body.find((a: any) => a.id === createRes.body.id)).toBeUndefined();
    });

    it('returns 404 for non-existent alert', async () => {
      const res = await request(ctx.app)
        .delete('/api/price-alerts/nonexistent')
        .set(auth());
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .delete('/api/price-alerts/some-id');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/price-alerts/check', () => {
    it('triggers an alert check', async () => {
      const res = await request(ctx.app)
        .post('/api/price-alerts/check')
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('triggered');
      expect(res.body).toHaveProperty('checked');
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/price-alerts/check');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/price-alerts/history', () => {
    it('returns alert history for the user', async () => {
      const res = await request(ctx.app)
        .get('/api/price-alerts/history')
        .set(auth());

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .get('/api/price-alerts/history');
      expect(res.status).toBe(401);
    });
  });
});
