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

    it('finds card by image query param', async () => {
      const cardData = createCardData({ images: ['unique-image-lookup.jpg'] });
      await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).get('/api/cards?image=unique-image-lookup.jpg');
      expect(res.status).toBe(200);
      expect(res.body.images).toContain('unique-image-lookup.jpg');
    });

    it('returns 404 when image not found', async () => {
      const res = await request(ctx.app).get('/api/cards?image=nonexistent-img.jpg');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('No card found');
    });

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'getAllCards').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).get('/api/cards');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch cards');
    });
  });

  // ─── GET /api/cards/heatmap ─────────────────────────────────────────────

  describe('GET /api/cards/heatmap', () => {
    it('returns heatmap data for "all" period', async () => {
      const cardData = createCardData({ currentValue: 20, purchasePrice: 10 });
      await request(ctx.app).post('/api/cards').send(cardData);

      const res = await request(ctx.app).get('/api/cards/heatmap?period=all');
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('all');
      expect(res.body.periodStartDate).toBeNull();
      expect(Array.isArray(res.body.cards)).toBe(true);
    });

    it('returns heatmap data for timed period', async () => {
      const res = await request(ctx.app).get('/api/cards/heatmap?period=30d');
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('30d');
      expect(res.body.periodStartDate).toBeTruthy();
    });

    it('returns heatmap data for ytd period', async () => {
      const res = await request(ctx.app).get('/api/cards/heatmap?period=ytd');
      expect(res.status).toBe(200);
      expect(res.body.period).toBe('ytd');
    });

    it('returns 400 for invalid period', async () => {
      const res = await request(ctx.app).get('/api/cards/heatmap?period=invalid');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid period');
    });

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'getAllCards').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).get('/api/cards/heatmap?period=all');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch heatmap data');
    });
  });

  // ─── POST /api/cards/heatmap/backfill ──────────────────────────────────

  describe('POST /api/cards/heatmap/backfill', () => {
    it('returns backfill count', async () => {
      const res = await request(ctx.app).post('/api/cards/heatmap/backfill');
      expect(res.status).toBe(200);
      expect(typeof res.body.backfilled).toBe('number');
    });

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'backfillValueSnapshots').mockImplementationOnce(() => {
        throw new Error('DB error');
      });
      const res = await request(ctx.app).post('/api/cards/heatmap/backfill');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to backfill value snapshots');
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

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'getCardById').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).get('/api/cards/some-id');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to fetch card');
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

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'createCard').mockRejectedValueOnce(new Error('DB error'));
      const cardData = createCardData();
      const res = await request(ctx.app).post('/api/cards').send(cardData);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create card');
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

    it('defaults images and notes when non-array/missing', async () => {
      const cardData = createCardData();
      const created = await request(ctx.app).post('/api/cards').send(cardData);

      const updateData = createCardData({ player: 'Defaults Test' });
      delete (updateData as any).images;
      delete (updateData as any).notes;
      const res = await request(ctx.app)
        .put(`/api/cards/${created.body.id}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.images).toEqual([]);
      expect(res.body.notes).toBe('');
    });

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'updateCard').mockRejectedValueOnce(new Error('DB error'));
      const cardData = createCardData();
      const res = await request(ctx.app).put('/api/cards/some-id').send(cardData);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update card');
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

    it('returns 500 when db throws', async () => {
      jest.spyOn(ctx.db, 'deleteCard').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).delete('/api/cards/some-id');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to delete card');
    });
  });
});
