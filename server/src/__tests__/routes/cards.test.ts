import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { createCardData } from '../helpers/factories';

describe('Card Routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('GET /api/cards', () => {
    it('returns empty array initially', async () => {
      const res = await request(ctx.app).get('/api/cards');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns cards after creation', async () => {
      const cardData = createCardData();
      await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).get('/api/cards');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by userId', async () => {
      const cardData = createCardData({ userId: 'user-abc' });
      await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).get('/api/cards?userId=user-abc');
      expect(res.status).toBe(200);
      expect(res.body.every((c: { userId: string }) => c.userId === 'user-abc')).toBe(true);
    });

    it('filters by collectionId', async () => {
      const cardData = createCardData({ collectionId: 'col-123' });
      await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).get('/api/cards?collectionId=col-123');
      expect(res.status).toBe(200);
      expect(res.body.every((c: { collectionId: string }) => c.collectionId === 'col-123')).toBe(true);
    });
  });

  describe('GET /api/cards/:id', () => {
    it('returns a card by id', async () => {
      const cardData = createCardData();
      const created = await request(ctx.app).post('/api/cards').send(cardData);
      const id = created.body.id;

      const res = await request(ctx.app).get(`/api/cards/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.player).toBe(cardData.player);
    });

    it('returns 404 for non-existent card', async () => {
      const res = await request(ctx.app).get('/api/cards/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/cards', () => {
    it('creates a card and returns 201', async () => {
      const cardData = createCardData();
      const res = await request(ctx.app).post('/api/cards').send(cardData);
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.player).toBe(cardData.player);
      expect(res.body.createdAt).toBeDefined();
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(ctx.app).post('/api/cards').send({ player: 'Test' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required field/);
    });

    it('defaults images to empty array', async () => {
      const cardData = createCardData();
      delete (cardData as unknown as Record<string, unknown>).images;
      const res = await request(ctx.app).post('/api/cards').send(cardData);
      expect(res.status).toBe(201);
      expect(res.body.images).toEqual([]);
    });

    it('sets userId and collectionId', async () => {
      const cardData = createCardData({ userId: 'u1', collectionId: 'c1' });
      const res = await request(ctx.app).post('/api/cards').send(cardData);
      expect(res.status).toBe(201);
      expect(res.body.userId).toBe('u1');
      expect(res.body.collectionId).toBe('c1');
    });
  });

  describe('PUT /api/cards/:id', () => {
    it('updates a card', async () => {
      const cardData = createCardData();
      const created = await request(ctx.app).post('/api/cards').send(cardData);

      const updateData = createCardData({ player: 'Updated Player' });
      const res = await request(ctx.app)
        .put(`/api/cards/${created.body.id}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.player).toBe('Updated Player');
    });

    it('returns 404 for non-existent card', async () => {
      const updateData = createCardData();
      const res = await request(ctx.app).put('/api/cards/nonexistent').send(updateData);
      expect(res.status).toBe(404);
    });

    it('returns 400 for missing required fields', async () => {
      const cardData = createCardData();
      const created = await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app)
        .put(`/api/cards/${created.body.id}`)
        .send({ player: 'Partial' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/cards/:id', () => {
    it('deletes a card and returns 204', async () => {
      const cardData = createCardData();
      const created = await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).delete(`/api/cards/${created.body.id}`);
      expect(res.status).toBe(204);

      const get = await request(ctx.app).get(`/api/cards/${created.body.id}`);
      expect(get.status).toBe(404);
    });

    it('returns 404 for non-existent card', async () => {
      const res = await request(ctx.app).delete('/api/cards/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
