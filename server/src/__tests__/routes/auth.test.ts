import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

describe('Auth Routes', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user and returns user + token', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('does not return passwordHash in response', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'nohash', email: 'nohash@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('returns 400 for short password', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'short', email: 'short@example.com', password: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/);
    });

    it('returns 409 for duplicate email', async () => {
      await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'first', email: 'dupe@example.com', password: 'password123' });

      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'second', email: 'dupe@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Email already in use/);
    });

    it('returns 409 for duplicate username', async () => {
      await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'dupename', email: 'unique1@example.com', password: 'password123' });

      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'dupename', email: 'unique2@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Username already taken/);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'loginuser', email: 'login@example.com', password: 'password123' });

      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('login@example.com');
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid email or password/);
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user with valid token', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'meuser', email: 'me@example.com', password: 'password123' });

      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@example.com');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      const res = await request(ctx.app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('updates username', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'profileuser', email: 'profile@example.com', password: 'password123' });

      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'updatedname' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('updatedname');
    });

    it('changes password with correct current password', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'pwdchange', email: 'pwdchange@example.com', password: 'password123' });

      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

      expect(res.status).toBe(200);

      // Verify new password works
      const loginRes = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'pwdchange@example.com', password: 'newpassword456' });

      expect(loginRes.status).toBe(200);
    });

    it('rejects password change without current password', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'nopwd', email: 'nopwd@example.com', password: 'password123' });

      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ newPassword: 'newpassword456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Current password required/);
    });

    it('rejects wrong current password', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'wrongpwd', email: 'wrongpwd@example.com', password: 'password123' });
      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Current password is incorrect/);
    });

    it('rejects short new password', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'shortpw2', email: 'shortpw2@example.com', password: 'password123' });
      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/);
    });

    it('rejects duplicate email on profile update', async () => {
      // 'test@example.com' already registered by the first test in this file
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'profdupemail', email: 'profdupemail@example.com', password: 'password123' });
      expect(registerRes.status).toBe(201);
      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Email already in use/);
    });

    it('rejects duplicate username on profile update', async () => {
      // 'testuser' already registered by the first test in this file
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'profdupename', email: 'profdupename@example.com', password: 'password123' });
      expect(registerRes.status).toBe(201);
      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'testuser' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Username already taken/);
    });

    it('updates profilePhoto', async () => {
      const registerRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'photousr', email: 'photousr@example.com', password: 'password123' });
      const token = registerRes.body.token;

      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ profilePhoto: 'avatar.jpg' });
      expect(res.status).toBe(200);
      expect(res.body.profilePhoto).toBe('avatar.jpg');
    });
  });

  // ─── Error paths (500s) ─────────────────────────────────────────────────

  describe('error paths', () => {
    const JWT_SECRET = 'dev-secret-change-in-production';
    function makeToken(userId = 'err-user-1') {
      return jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    }

    it('returns 500 when register throws', async () => {
      jest.spyOn(ctx.db, 'getUserByEmail').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'err', email: 'err@example.com', password: 'password123' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to register user');
    });

    it('returns 500 when login throws', async () => {
      jest.spyOn(ctx.db, 'getUserByEmail').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to log in');
    });

    it('returns 500 when /me throws', async () => {
      jest.spyOn(ctx.db, 'getUserById').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get user');
    });

    it('returns 500 when profile update throws', async () => {
      jest.spyOn(ctx.db, 'getUserById').mockRejectedValueOnce(new Error('DB error'));
      const res = await request(ctx.app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update profile');
    });
  });
});
