import request from 'supertest';
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
  });
});
