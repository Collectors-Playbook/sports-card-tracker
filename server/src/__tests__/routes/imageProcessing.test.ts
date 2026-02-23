import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

describe('Image Processing Routes', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  describe('POST /api/image-processing/process', () => {
    it('creates an image-processing job', async () => {
      const res = await request(ctx.app)
        .post('/api/image-processing/process')
        .send({ filenames: ['card1.jpg', 'card2.jpg'] })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('image-processing');
      expect(res.body.status).toBe('pending');
      expect(res.body.payload.filenames).toEqual(['card1.jpg', 'card2.jpg']);
    });

    it('returns 400 when filenames missing', async () => {
      const res = await request(ctx.app)
        .post('/api/image-processing/process')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('filenames');
    });

    it('returns 400 when filenames is empty array', async () => {
      const res = await request(ctx.app)
        .post('/api/image-processing/process')
        .send({ filenames: [] })
        .expect(400);

      expect(res.body.error).toContain('filenames');
    });

    it('passes optional parameters to payload', async () => {
      const res = await request(ctx.app)
        .post('/api/image-processing/process')
        .send({ filenames: ['card.jpg'], skipExisting: false, confidenceThreshold: 60 })
        .expect(201);

      expect(res.body.payload.skipExisting).toBe(false);
      expect(res.body.payload.confidenceThreshold).toBe(60);
    });
  });

  describe('POST /api/image-processing/process-sync', () => {
    it('returns result for single file', async () => {
      // Create a test file in raw dir
      const rawDir = ctx.fileService.getRawDir();
      fs.writeFileSync(path.join(rawDir, 'test.jpg'), 'fake image');

      // Mock vision service to return identified card data
      ctx.visionService.identifyCard.mockResolvedValue({
        player: 'Mike Trout',
        year: '2023',
        brand: 'Topps Chrome',
        team: 'Angels',
        cardNumber: '1',
        category: 'Baseball',
        confidence: { score: 85, level: 'high', detectedFields: 6 },
      });

      const res = await request(ctx.app)
        .post('/api/image-processing/process-sync')
        .send({ filename: 'test.jpg' })
        .expect(200);

      expect(res.body.filename).toBe('test.jpg');
      expect(res.body.status).toBe('processed');
      expect(res.body.cardId).toBeDefined();
    });

    it('returns 400 when filename missing', async () => {
      const res = await request(ctx.app)
        .post('/api/image-processing/process-sync')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('filename');
    });
  });

  describe('GET /api/image-processing/status', () => {
    it('returns file counts', async () => {
      // Create some test files
      const rawDir = ctx.fileService.getRawDir();
      const processedDir = ctx.fileService.getProcessedDir();
      fs.writeFileSync(path.join(rawDir, 'card1.jpg'), 'data');
      fs.writeFileSync(path.join(rawDir, 'card2.jpg'), 'data');
      fs.writeFileSync(path.join(processedDir, 'processed1.jpg'), 'data');

      const res = await request(ctx.app)
        .get('/api/image-processing/status')
        .expect(200);

      expect(res.body.rawCount).toBe(2);
      expect(res.body.processedCount).toBe(1);
      expect(res.body.recentErrors).toEqual([]);
    });

    it('includes recent errors', async () => {
      await ctx.db.insertAuditLog({
        action: 'image.process_failed',
        entity: 'file',
        entityId: 'bad.jpg',
        details: { reason: 'OCR failed' },
      });

      const res = await request(ctx.app)
        .get('/api/image-processing/status')
        .expect(200);

      expect(res.body.recentErrors).toHaveLength(1);
      expect(res.body.recentErrors[0].filename).toBe('bad.jpg');
      expect(res.body.recentErrors[0].reason).toBe('OCR failed');
    });
  });
});
