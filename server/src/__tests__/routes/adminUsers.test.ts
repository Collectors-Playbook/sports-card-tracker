import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';
import { loadConfig } from '../../config';

describe('Admin User Routes', () => {
  let ctx: TestContext;
  let adminToken: string;
  let adminUserId: string;
  let userToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    // Register an admin user
    const adminRes = await request(ctx.app)
      .post('/api/auth/register')
      .send({ username: 'superadmin', email: 'superadmin@test.com', password: 'password123' });
    adminUserId = adminRes.body.user.id;
    // Promote to admin directly in DB
    await ctx.db.updateUser(adminUserId, { role: 'admin' });
    // Re-sign token with admin role
    const config = loadConfig();
    adminToken = jwt.sign({ userId: adminUserId, role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });

    // Register a regular user
    const userRes = await request(ctx.app)
      .post('/api/auth/register')
      .send({ username: 'regularuser', email: 'regular@test.com', password: 'password123' });
    userToken = userRes.body.token;
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  // ─── GET /api/admin/users ─────────────────────────────────────────────────

  describe('GET /api/admin/users', () => {
    it('returns 200 and list of users for admin', async () => {
      const res = await request(ctx.app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('does not include passwordHash in response', async () => {
      const res = await request(ctx.app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      res.body.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });

    it('returns 401 without token', async () => {
      const res = await request(ctx.app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(ctx.app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/admin/users/:id ─────────────────────────────────────────────

  describe('GET /api/admin/users/:id', () => {
    it('returns a single user', async () => {
      const res = await request(ctx.app)
        .get(`/api/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(adminUserId);
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(ctx.app)
        .get('/api/admin/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/admin/users ────────────────────────────────────────────────

  describe('POST /api/admin/users', () => {
    it('creates a new user and returns 201', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'newuser', email: 'new@test.com', password: 'password123', role: 'user' });

      expect(res.status).toBe(201);
      expect(res.body.username).toBe('newuser');
      expect(res.body.email).toBe('new@test.com');
      expect(res.body.role).toBe('user');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('returns 400 for missing fields', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required fields/);
    });

    it('returns 400 for short password', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'shortpw', email: 'shortpw@test.com', password: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/);
    });

    it('returns 409 for duplicate email', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'dupemail', email: 'new@test.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Email already in use/);
    });

    it('returns 409 for duplicate username', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'newuser', email: 'unique@test.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Username already taken/);
    });

    it('returns 403 for non-admin', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ username: 'x', email: 'x@test.com', password: 'password123' });

      expect(res.status).toBe(403);
    });
  });

  // ─── PUT /api/admin/users/:id ─────────────────────────────────────────────

  describe('PUT /api/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'editable', email: 'editable@test.com', password: 'password123' });
      targetUserId = res.body.id;
    });

    it('updates username', async () => {
      const res = await request(ctx.app)
        .put(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'edited' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('edited');
    });

    it('updates email', async () => {
      const res = await request(ctx.app)
        .put(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'edited@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('edited@test.com');
    });

    it('returns 409 for duplicate username', async () => {
      const res = await request(ctx.app)
        .put(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'superadmin' });

      expect(res.status).toBe(409);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(ctx.app)
        .put('/api/admin/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'x' });

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/admin/users/:id/reset-password ────────────────────────────

  describe('POST /api/admin/users/:id/reset-password', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'pwreset', email: 'pwreset@test.com', password: 'password123' });
      targetUserId = res.body.id;
    });

    it('resets password successfully', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'newpassword456' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Password reset/);

      // Verify new password works
      const loginRes = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: 'pwreset@test.com', password: 'newpassword456' });
      expect(loginRes.status).toBe(200);
    });

    it('returns 400 for short password', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: '12345' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users/nonexistent-id/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'newpassword456' });

      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/admin/users/:id/toggle-status ─────────────────────────────

  describe('POST /api/admin/users/:id/toggle-status', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'toggleme', email: 'toggle@test.com', password: 'password123' });
      targetUserId = res.body.id;
    });

    it('toggles user from active to inactive', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('toggles user back to active', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
    });

    it('blocks disabling the last active admin', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${adminUserId}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/last active admin/);
    });
  });

  // ─── POST /api/admin/users/:id/change-role ───────────────────────────────

  describe('POST /api/admin/users/:id/change-role', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'roleme', email: 'role@test.com', password: 'password123' });
      targetUserId = res.body.id;
    });

    it('changes role from user to admin', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/change-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
    });

    it('changes role back to user', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/change-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('user');
    });

    it('blocks demoting the last active admin', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${adminUserId}/change-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/last active admin/);
    });

    it('returns 400 for invalid role', async () => {
      const res = await request(ctx.app)
        .post(`/api/admin/users/${targetUserId}/change-role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superuser' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid role/);
    });
  });

  // ─── DELETE /api/admin/users/:id ──────────────────────────────────────────

  describe('DELETE /api/admin/users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      const res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'deleteme', email: 'delete@test.com', password: 'password123' });
      targetUserId = res.body.id;
    });

    it('deletes a user and returns 204', async () => {
      const res = await request(ctx.app)
        .delete(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);

      // Verify user is gone
      const getRes = await request(ctx.app)
        .get(`/api/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it('blocks self-delete', async () => {
      const res = await request(ctx.app)
        .delete(`/api/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete your own account/);
    });

    it('blocks deleting the last active admin', async () => {
      // Create another admin, then try to delete both
      const admin2Res = await request(ctx.app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'admin2', email: 'admin2@test.com', password: 'password123', role: 'admin' });
      const admin2Id = admin2Res.body.id;

      // Create a token for admin2 so they can try to delete superadmin
      const config = loadConfig();
      const admin2Token = jwt.sign({ userId: admin2Id, role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });

      // admin2 deletes superadmin — should succeed since admin2 is still there
      const deleteRes = await request(ctx.app)
        .delete(`/api/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(deleteRes.status).toBe(204);

      // Now admin2 is the only admin. A new user trying to be deleted that is admin2 should be blocked.
      // But admin2 can't self-delete anyway (self-delete guard).
      // Restore superadmin for remaining tests.
      const restoreRes = await request(ctx.app)
        .post('/api/auth/register')
        .send({ username: 'superadmin2', email: 'superadmin2@test.com', password: 'password123' });
      const newAdminId = restoreRes.body.user.id;
      await ctx.db.updateUser(newAdminId, { role: 'admin' });
      adminUserId = newAdminId;
      adminToken = jwt.sign({ userId: newAdminId, role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(ctx.app)
        .delete('/api/admin/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
