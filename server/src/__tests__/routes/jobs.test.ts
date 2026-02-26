import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

describe('Job Routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('POST /api/jobs', () => {
    it('creates a job and returns 201', async () => {
      const res = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'image-processing', payload: { files: ['test.jpg'] } });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('image-processing');
      expect(res.body.status).toBe('pending');
      expect(res.body.progress).toBe(0);
    });

    it('returns 400 if type is missing', async () => {
      const res = await request(ctx.app)
        .post('/api/jobs')
        .send({ payload: {} });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/type/);
    });
  });

  describe('GET /api/jobs', () => {
    it('returns all jobs', async () => {
      const res = await request(ctx.app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by status', async () => {
      await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'test-filter' });

      const res = await request(ctx.app).get('/api/jobs?status=pending');
      expect(res.status).toBe(200);
      expect(res.body.every((j: { status: string }) => j.status === 'pending')).toBe(true);
    });

    it('filters by type', async () => {
      await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'unique-type-filter' });

      const res = await request(ctx.app).get('/api/jobs?type=unique-type-filter');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.every((j: { type: string }) => j.type === 'unique-type-filter')).toBe(true);
    });

    it('respects limit param', async () => {
      const res = await request(ctx.app).get('/api/jobs?limit=1');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('returns a job by id', async () => {
      const created = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'get-test' });

      const res = await request(ctx.app).get(`/api/jobs/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for non-existent job', async () => {
      const res = await request(ctx.app).get('/api/jobs/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    it('cancels a pending job', async () => {
      const created = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'cancel-test' });

      const res = await request(ctx.app).delete(`/api/jobs/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('returns 404 for non-existent job', async () => {
      const res = await request(ctx.app).delete('/api/jobs/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 400 when cancelling a completed job', async () => {
      const created = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'cancel-completed-test' });
      await ctx.db.updateJob(created.body.id, { status: 'completed' });

      const res = await request(ctx.app).delete(`/api/jobs/${created.body.id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot cancel a completed job/);
    });

    it('returns 400 when cancelling a failed job', async () => {
      const created = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'cancel-failed-test' });
      await ctx.db.updateJob(created.body.id, { status: 'failed' });

      const res = await request(ctx.app).delete(`/api/jobs/${created.body.id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot cancel a failed job/);
    });
  });

  // ─── Error paths (500s) ─────────────────────────────────────────────────

  describe('error paths', () => {
    it('returns 500 when POST / throws', async () => {
      jest.spyOn(ctx.db, 'createJob').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .post('/api/jobs')
        .send({ type: 'error-test' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create job');
    });

    it('returns 500 when GET / throws', async () => {
      jest.spyOn(ctx.db, 'getAllJobs').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).get('/api/jobs');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to list jobs');
    });

    it('returns 500 when GET /:id throws', async () => {
      jest.spyOn(ctx.db, 'getJobById').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).get('/api/jobs/some-id');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get job');
    });

    it('returns 500 when DELETE /:id throws', async () => {
      jest.spyOn(ctx.db, 'getJobById').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app).delete('/api/jobs/some-id');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to cancel job');
    });
  });
});
