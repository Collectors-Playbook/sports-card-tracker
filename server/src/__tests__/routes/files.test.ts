import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

describe('File Routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('GET /api/files/raw', () => {
    it('returns empty array for empty directory', async () => {
      const res = await request(ctx.app).get('/api/files/raw');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('lists files after adding one', async () => {
      const rawDir = path.join(ctx.tempDir, 'raw');
      fs.writeFileSync(path.join(rawDir, 'test.jpg'), 'fake-image-data');

      const res = await request(ctx.app).get('/api/files/raw');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('test.jpg');
      expect(res.body[0].type).toBe('jpg');
      expect(res.body[0].size).toBeGreaterThan(0);
    });
  });

  describe('GET /api/files/processed', () => {
    it('returns empty array for empty directory', async () => {
      const res = await request(ctx.app).get('/api/files/processed');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/files/raw/:filename', () => {
    it('serves an existing file', async () => {
      const rawDir = path.join(ctx.tempDir, 'raw');
      fs.writeFileSync(path.join(rawDir, 'serve-test.jpg'), 'image-content');

      const res = await request(ctx.app).get('/api/files/raw/serve-test.jpg');
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent file', async () => {
      const res = await request(ctx.app).get('/api/files/raw/nope.jpg');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/files/raw/upload', () => {
    it('uploads a file successfully', async () => {
      const testImagePath = path.join(ctx.tempDir, 'upload-source.jpg');
      fs.writeFileSync(testImagePath, 'fake-jpg-data');

      const res = await request(ctx.app)
        .post('/api/files/raw/upload')
        .attach('files', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(1);
      expect(res.body.uploaded[0].originalName).toBe('upload-source.jpg');
    });

    it('returns 400 when no files uploaded', async () => {
      const res = await request(ctx.app).post('/api/files/raw/upload');
      expect(res.status).toBe(400);
    });

    it('rejects non-image files', async () => {
      const textFile = path.join(ctx.tempDir, 'test.txt');
      fs.writeFileSync(textFile, 'not an image');

      const res = await request(ctx.app)
        .post('/api/files/raw/upload')
        .attach('files', textFile);

      expect(res.status).toBe(400); // multer file filter rejection
    });
  });

  describe('DELETE /api/files/raw/:filename', () => {
    it('deletes an existing file', async () => {
      const rawDir = path.join(ctx.tempDir, 'raw');
      fs.writeFileSync(path.join(rawDir, 'delete-me.jpg'), 'data');

      const res = await request(ctx.app).delete('/api/files/raw/delete-me.jpg');
      expect(res.status).toBe(204);
      expect(fs.existsSync(path.join(rawDir, 'delete-me.jpg'))).toBe(false);
    });

    it('returns 404 for non-existent file', async () => {
      const res = await request(ctx.app).delete('/api/files/raw/nope.jpg');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/files/logs/:logname', () => {
    it('returns empty array for non-existent log', async () => {
      const res = await request(ctx.app).get('/api/files/logs/comp-error.log');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('parses log entries correctly', async () => {
      fs.writeFileSync(
        path.join(ctx.tempDir, 'comp-error.log'),
        '[2024-01-15 10:30:00] card.jpg: Could not fetch comps\n'
      );

      const res = await request(ctx.app).get('/api/files/logs/comp-error.log');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].timestamp).toBe('2024-01-15 10:30:00');
      expect(res.body[0].filename).toBe('card.jpg');
      expect(res.body[0].reason).toBe('Could not fetch comps');
    });

    it('returns 400 for invalid log name', async () => {
      const res = await request(ctx.app).get('/api/files/logs/invalid.log');
      expect(res.status).toBe(400);
    });

    it('returns 400 for image-error.log (now in audit DB)', async () => {
      const res = await request(ctx.app).get('/api/files/logs/image-error.log');
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/files/logs/:logname', () => {
    it('clears an existing log', async () => {
      fs.writeFileSync(path.join(ctx.tempDir, 'comp-error.log'), 'some log data\n');

      const res = await request(ctx.app).delete('/api/files/logs/comp-error.log');
      expect(res.status).toBe(204);

      const content = fs.readFileSync(path.join(ctx.tempDir, 'comp-error.log'), 'utf-8');
      expect(content).toBe('');
    });

    it('returns 400 for invalid log name', async () => {
      const res = await request(ctx.app).delete('/api/files/logs/invalid.log');
      expect(res.status).toBe(400);
    });
  });
});
