import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('returns 200 with health status', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('includes version string', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.body.version).toBe('1.0.0');
  });

  it('includes uptime as a number', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('reports database as connected', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.body.database).toBe('connected');
  });

  it('reports directories exist', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.body.directories).toBe(true);
  });
});
