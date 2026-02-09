import request from 'supertest';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import http from 'http';

describe('Event Routes', () => {
  let ctx: TestContext;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await new Promise<void>((resolve) => {
      server = ctx.app.listen(0, () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupTestContext(ctx);
  });

  it('returns SSE headers', (done) => {
    http.get(`http://localhost:${port}/api/events`, (res) => {
      expect(res.headers['content-type']).toBe('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['connection']).toBe('keep-alive');
      res.destroy();
      done();
    });
  });

  it('sends a connected event on connection', (done) => {
    http.get(`http://localhost:${port}/api/events`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('event: connected')) {
          expect(data).toContain('clientId');
          res.destroy();
          done();
        }
      });
    });
  });

  it('tracks client connections', (done) => {
    expect(ctx.eventService.getClientCount()).toBeGreaterThanOrEqual(0);

    http.get(`http://localhost:${port}/api/events`, (res) => {
      // Give a small delay for the client to be registered
      setTimeout(() => {
        expect(ctx.eventService.getClientCount()).toBeGreaterThanOrEqual(1);
        res.destroy();
        setTimeout(() => {
          done();
        }, 50);
      }, 50);
    });
  });

  it('broadcasts events to connected clients', (done) => {
    http.get(`http://localhost:${port}/api/events`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('event: test-event')) {
          expect(data).toContain('"hello":"world"');
          res.destroy();
          done();
        }
      });

      // Wait for connection, then broadcast
      setTimeout(() => {
        ctx.eventService.broadcast('test-event', { hello: 'world' });
      }, 100);
    });
  });
});
