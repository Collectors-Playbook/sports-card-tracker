import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { createCardData } from '../helpers/factories';

describe('eBay Routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  async function createInventoryCard(overrides: Record<string, unknown> = {}) {
    const cardData = createCardData({ collectionType: 'Inventory', ...overrides });
    const res = await request(ctx.app).post('/api/cards').send(cardData);
    return res.body;
  }

  async function createPcCard(overrides: Record<string, unknown> = {}) {
    const cardData = createCardData({ collectionType: 'PC', ...overrides });
    const res = await request(ctx.app).post('/api/cards').send(cardData);
    return res.body;
  }

  describe('POST /api/ebay/generate', () => {
    it('returns result with valid options', async () => {
      await createInventoryCard();

      const res = await request(ctx.app)
        .post('/api/ebay/generate')
        .send({
          priceMultiplier: 0.9,
          shippingCost: 4.99,
        });

      expect(res.status).toBe(200);
      expect(res.body.filename).toBe('ebay-draft-upload-batch.csv');
      expect(res.body.totalCards).toBeGreaterThanOrEqual(1);
      expect(res.body.generatedAt).toBeDefined();
      expect(typeof res.body.totalListingValue).toBe('number');
    });

    it('excludes PC cards', async () => {
      const invCard = await createInventoryCard({ player: 'Inventory Only' });
      const pcCard = await createPcCard({ player: 'PC Only' });

      const res = await request(ctx.app)
        .post('/api/ebay/generate')
        .send({
          priceMultiplier: 0.9,
          shippingCost: 4.99,
          cardIds: [invCard.id, pcCard.id],
        });

      expect(res.status).toBe(200);
      expect(res.body.totalCards).toBe(1);
      expect(res.body.skippedPcCards).toBe(1);
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/ebay/generate')
        .send({ priceMultiplier: 0.9 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('filters by cardIds correctly', async () => {
      const card1 = await createInventoryCard({ player: 'Filter Target' });
      await createInventoryCard({ player: 'Filter Other' });

      const res = await request(ctx.app)
        .post('/api/ebay/generate')
        .send({
          priceMultiplier: 0.9,
          shippingCost: 4.99,
          cardIds: [card1.id],
        });

      expect(res.status).toBe(200);
      expect(res.body.totalCards).toBe(1);
    });
  });

  describe('POST /api/ebay/generate-async', () => {
    it('creates pending job', async () => {
      const res = await request(ctx.app)
        .post('/api/ebay/generate-async')
        .send({
          priceMultiplier: 0.9,
          shippingCost: 4.99,
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('ebay-csv');
      expect(res.body.status).toBe('pending');
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/ebay/generate-async')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });
  });

  describe('GET /api/ebay/download', () => {
    it('returns 404 when no CSV exists', async () => {
      // Remove any existing output
      const outputPath = ctx.ebayExportService.getOutputPath();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      const res = await request(ctx.app).get('/api/ebay/download');
      expect(res.status).toBe(404);
    });

    it('serves file after generation', async () => {
      await createInventoryCard({ player: 'Download Test' });

      // Generate CSV first
      await request(ctx.app)
        .post('/api/ebay/generate')
        .send({ priceMultiplier: 0.9, shippingCost: 4.99 });

      const res = await request(ctx.app).get('/api/ebay/download');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv|application\/octet-stream/);
    });
  });

  describe('GET /api/ebay/template', () => {
    it('returns 404 when template is missing', async () => {
      const res = await request(ctx.app).get('/api/ebay/template');
      // Template is at tempDir/eBay-draft-listing-template.csv, won't exist unless we create it
      expect(res.status).toBe(404);
    });

    it('returns 200 when template exists', async () => {
      // Create template file in tempDir
      const templatePath = ctx.ebayExportService.getTemplatePath();
      fs.writeFileSync(templatePath, 'header1,header2\nval1,val2\n', 'utf-8');

      const res = await request(ctx.app).get('/api/ebay/template');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/ebay/status', () => {
    it('returns existence flags', async () => {
      const res = await request(ctx.app).get('/api/ebay/status');
      expect(res.status).toBe(200);
      expect(typeof res.body.templateExists).toBe('boolean');
      expect(typeof res.body.outputExists).toBe('boolean');
    });
  });

  // ─── Error paths (500s) ─────────────────────────────────────────────────

  describe('error paths', () => {
    it('returns 500 when POST /generate throws', async () => {
      jest.spyOn(ctx.ebayExportService, 'generateCsv').mockRejectedValueOnce(new Error('Service error'));
      const res = await request(ctx.app)
        .post('/api/ebay/generate')
        .send({ priceMultiplier: 0.9, shippingCost: 4.99 });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to generate eBay CSV');
    });

    it('returns 500 when POST /generate-async throws', async () => {
      jest.spyOn(ctx.db, 'createJob').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .post('/api/ebay/generate-async')
        .send({ priceMultiplier: 0.9, shippingCost: 4.99 });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create eBay CSV job');
    });

    it('returns 500 when GET /download throws', async () => {
      jest.spyOn(ctx.ebayExportService, 'outputExists').mockImplementationOnce(() => {
        throw new Error('FS error');
      });
      const res = await request(ctx.app).get('/api/ebay/download');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to download eBay CSV');
    });

    it('returns 500 when GET /template throws', async () => {
      jest.spyOn(ctx.ebayExportService, 'templateExists').mockImplementationOnce(() => {
        throw new Error('FS error');
      });
      const res = await request(ctx.app).get('/api/ebay/template');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to download template');
    });

    it('returns 500 when GET /status throws', async () => {
      jest.spyOn(ctx.ebayExportService, 'templateExists').mockImplementationOnce(() => {
        throw new Error('FS error');
      });
      const res = await request(ctx.app).get('/api/ebay/status');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to check eBay export status');
    });
  });
});
