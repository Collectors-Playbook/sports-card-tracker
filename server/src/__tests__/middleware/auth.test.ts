import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { optionalAuth, authenticateToken, requireAdmin } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types';

const JWT_SECRET = 'dev-secret-change-in-production';

function createApp(middleware: express.RequestHandler[]) {
  const app = express();
  app.use(express.json());
  app.get(
    '/test',
    ...middleware,
    (req: express.Request, res: express.Response) => {
      const authReq = req as AuthenticatedRequest;
      res.json({ user: authReq.user || null });
    }
  );
  return app;
}

describe('Auth Middleware', () => {
  describe('optionalAuth', () => {
    it('continues without error if no auth header', async () => {
      const app = createApp([optionalAuth]);
      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it('sets user if valid token', async () => {
      const token = jwt.sign({ userId: 'u1', role: 'user' }, JWT_SECRET);
      const app = createApp([optionalAuth]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.userId).toBe('u1');
    });

    it('continues without user if token is invalid', async () => {
      const app = createApp([optionalAuth]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });

  describe('authenticateToken', () => {
    it('returns 401 if no auth header', async () => {
      const app = createApp([authenticateToken]);
      const res = await request(app).get('/test');
      expect(res.status).toBe(401);
    });

    it('returns 403 if token is invalid', async () => {
      const app = createApp([authenticateToken]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer badtoken');
      expect(res.status).toBe(403);
    });

    it('sets user and calls next for valid token', async () => {
      const token = jwt.sign({ userId: 'u2', role: 'admin' }, JWT_SECRET);
      const app = createApp([authenticateToken]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.userId).toBe('u2');
      expect(res.body.user.role).toBe('admin');
    });

    it('returns 401 for Bearer without token', async () => {
      const app = createApp([authenticateToken]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', 'Bearer ');
      // Empty token after split is falsy, so treated as missing
      expect(res.status).toBe(401);
    });
  });

  describe('requireAdmin', () => {
    it('returns 403 if no user', async () => {
      const app = createApp([requireAdmin]);
      const res = await request(app).get('/test');
      expect(res.status).toBe(403);
    });

    it('returns 403 if user is not admin', async () => {
      const token = jwt.sign({ userId: 'u3', role: 'user' }, JWT_SECRET);
      const app = createApp([authenticateToken, requireAdmin]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('allows admin through', async () => {
      const token = jwt.sign({ userId: 'u4', role: 'admin' }, JWT_SECRET);
      const app = createApp([authenticateToken, requireAdmin]);
      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
    });
  });
});
