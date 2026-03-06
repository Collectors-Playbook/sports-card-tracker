import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { createCardData } from '../helpers/factories';

describe('Storage Routes', () => {
  let ctx: TestContext;
  let token: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ username: 'storageuser', email: 'storage@test.com', password: 'password123' });
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

  describe('GET /api/storage/locations', () => {
    it('returns empty array when no cards have storage', async () => {
      const res = await request(ctx.app).get('/api/storage/locations');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('PUT /api/storage/cards/:id', () => {
    it('assigns a storage location to a card', async () => {
      const card = await createCard();
      const location = { room: 'Office', shelf: '1', box: 'A' };

      const res = await request(ctx.app)
        .put(`/api/storage/cards/${card.id}`)
        .set(auth())
        .send({ location });

      expect(res.status).toBe(200);
      expect(res.body.storageLocation).toEqual(location);
    });

    it('clears storage location when set to null', async () => {
      const card = await createCard();

      await request(ctx.app)
        .put(`/api/storage/cards/${card.id}`)
        .set(auth())
        .send({ location: { room: 'Closet', box: '1' } });

      const res = await request(ctx.app)
        .put(`/api/storage/cards/${card.id}`)
        .set(auth())
        .send({ location: null });

      expect(res.status).toBe(200);
      expect(res.body.storageLocation).toBeNull();
    });

    it('returns 404 for non-existent card', async () => {
      const res = await request(ctx.app)
        .put('/api/storage/cards/nonexistent')
        .set(auth())
        .send({ location: { room: 'Office' } });
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .put('/api/storage/cards/some-id')
        .send({ location: { room: 'Office' } });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/storage/cards', () => {
    it('returns cards filtered by room', async () => {
      const card = await createCard();
      await request(ctx.app)
        .put(`/api/storage/cards/${card.id}`)
        .set(auth())
        .send({ location: { room: 'Safe', shelf: 'Top', box: '1' } });

      const res = await request(ctx.app).get('/api/storage/cards?room=Safe');
      expect(res.status).toBe(200);
      expect(res.body.some((c: any) => c.id === card.id)).toBe(true);
    });

    it('returns cards filtered by room and box', async () => {
      const card = await createCard();
      await request(ctx.app)
        .put(`/api/storage/cards/${card.id}`)
        .set(auth())
        .send({ location: { room: 'Garage', shelf: '2', box: 'B' } });

      const res = await request(ctx.app).get('/api/storage/cards?room=Garage&box=B');
      expect(res.status).toBe(200);
      expect(res.body.some((c: any) => c.id === card.id)).toBe(true);
    });

    it('returns all stored cards when no filters', async () => {
      const res = await request(ctx.app).get('/api/storage/cards');
      expect(res.status).toBe(200);
      res.body.forEach((c: any) => {
        expect(c.storageLocation).not.toBeNull();
      });
    });
  });

  describe('POST /api/storage/bulk-assign', () => {
    it('assigns storage to multiple cards', async () => {
      const card1 = await createCard();
      const card2 = await createCard();
      const location = { room: 'Vault', shelf: '3', box: 'C', method: 'Toploader' };

      const res = await request(ctx.app)
        .post('/api/storage/bulk-assign')
        .set(auth())
        .send({ cardIds: [card1.id, card2.id], location });

      expect(res.status).toBe(200);
      expect(res.body.updated).toBe(2);

      const check = await request(ctx.app).get('/api/storage/cards?room=Vault&box=C');
      const ids = check.body.map((c: any) => c.id);
      expect(ids).toContain(card1.id);
      expect(ids).toContain(card2.id);
    });

    it('rejects empty cardIds array', async () => {
      const res = await request(ctx.app)
        .post('/api/storage/bulk-assign')
        .set(auth())
        .send({ cardIds: [], location: { room: 'Office' } });
      expect(res.status).toBe(400);
    });

    it('rejects missing room in location', async () => {
      const res = await request(ctx.app)
        .post('/api/storage/bulk-assign')
        .set(auth())
        .send({ cardIds: ['some-id'], location: { box: '1' } });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(ctx.app)
        .post('/api/storage/bulk-assign')
        .send({ cardIds: ['id'], location: { room: 'X' } });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/storage/locations (with data)', () => {
    it('returns distinct locations with card counts', async () => {
      const res = await request(ctx.app).get('/api/storage/locations');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      res.body.forEach((loc: any) => {
        expect(loc.room).toBeDefined();
        expect(loc.cardCount).toBeGreaterThan(0);
      });
    });
  });
});
