import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp, cleanupTestContext, TestContext } from '../helpers/testSetup';

const JWT_SECRET = 'dev-secret-change-in-production';

function userToken(userId = 'user-1') {
  return jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

// Mock global fetch for eBay API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('eBay Auth Routes', () => {
  let ctx: TestContext;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();

    const user = await ctx.db.createUser({
      username: 'ebayauthuser',
      email: 'ebayauth@test.com',
      password: 'password123',
    });
    userId = user.id;
    token = userToken(userId);
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─── GET /api/ebay/auth/status ──────────────────────────────────────────────

  describe('GET /api/ebay/auth/status', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app).get('/api/ebay/auth/status');
      expect(res.status).toBe(401);
    });

    it('returns disconnected status when no token stored', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
      expect(res.body.ebayUsername).toBeNull();
      expect(res.body.environment).toBeDefined();
      expect(res.body.isConfigured).toBeDefined();
    });

    it('returns connected status when valid token exists', async () => {
      // Store a token for this user
      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch
      await ctx.ebayAuthService.storeTokens(userId, {
        access_token: 'status-access',
        refresh_token: 'status-refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      const res = await request(ctx.app)
        .get('/api/ebay/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.accessTokenExpiresAt).toBeTruthy();
      expect(res.body.refreshTokenExpiresAt).toBeTruthy();
    });

    it('returns 500 when service throws', async () => {
      const spy = jest.spyOn(ctx.ebayAuthService, 'getConnectionStatus')
        .mockRejectedValueOnce(new Error('DB error'));

      const res = await request(ctx.app)
        .get('/api/ebay/auth/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get eBay connection status');
      spy.mockRestore();
    });
  });

  // ─── GET /api/ebay/auth/authorize ───────────────────────────────────────────

  describe('GET /api/ebay/auth/authorize', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app).get('/api/ebay/auth/authorize');
      expect(res.status).toBe(401);
    });

    it('returns authorization URL when configured', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/authorize')
        .set('Authorization', `Bearer ${token}`);

      // isConfigured depends on env vars — may return 400 or 200
      if (ctx.ebayAuthService.isConfigured()) {
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('oauth2/authorize');
        expect(res.body.url).toContain('state=');
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('not configured');
      }
    });

    it('returns 400 when eBay OAuth is not configured', async () => {
      const spy = jest.spyOn(ctx.ebayAuthService, 'isConfigured')
        .mockReturnValueOnce(false);

      const res = await request(ctx.app)
        .get('/api/ebay/auth/authorize')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not configured');
      spy.mockRestore();
    });

    it('returns URL with correct parameters when configured', async () => {
      const spy = jest.spyOn(ctx.ebayAuthService, 'isConfigured')
        .mockReturnValueOnce(true);

      const res = await request(ctx.app)
        .get('/api/ebay/auth/authorize')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(typeof res.body.url).toBe('string');
      spy.mockRestore();
    });

    it('returns 500 when service throws', async () => {
      const spy = jest.spyOn(ctx.ebayAuthService, 'isConfigured')
        .mockReturnValueOnce(true);
      const urlSpy = jest.spyOn(ctx.ebayAuthService, 'getAuthorizationUrl')
        .mockImplementationOnce(() => { throw new Error('Unexpected error'); });

      const res = await request(ctx.app)
        .get('/api/ebay/auth/authorize')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to generate eBay authorization URL');
      spy.mockRestore();
      urlSpy.mockRestore();
    });
  });

  // ─── GET /api/ebay/auth/callback ────────────────────────────────────────────

  describe('GET /api/ebay/auth/callback', () => {
    it('redirects with error when code is missing', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/callback?state=some-state');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('redirects with error when state is missing', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/callback?code=some-code');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('redirects with error when both code and state are missing', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/callback');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=missing_params');
    });

    it('redirects with error when state is invalid', async () => {
      const res = await request(ctx.app)
        .get('/api/ebay/auth/callback?code=auth-code&state=bogus-state');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid_state');
    });

    it('redirects with connected=true on successful token exchange', async () => {
      // Generate a valid CSRF state
      const state = ctx.ebayAuthService.generateAuthState(userId);

      const tokenResponse = {
        access_token: 'callback-access-token',
        refresh_token: 'callback-refresh-token',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
        token_type: 'User Access Token',
      };

      // Mock exchangeCodeForTokens and storeTokens
      const exchangeSpy = jest.spyOn(ctx.ebayAuthService, 'exchangeCodeForTokens')
        .mockResolvedValueOnce(tokenResponse);
      const storeSpy = jest.spyOn(ctx.ebayAuthService, 'storeTokens')
        .mockResolvedValueOnce({
          id: 'token-id',
          userId,
          environment: 'sandbox',
          accessTokenEncrypted: 'enc-access',
          refreshTokenEncrypted: 'enc-refresh',
          accessTokenExpiresAt: new Date(Date.now() + 7200000).toISOString(),
          refreshTokenExpiresAt: new Date(Date.now() + 47304000000).toISOString(),
          ebayUsername: 'testebayuser',
          scopes: 'sell.inventory',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      const res = await request(ctx.app)
        .get(`/api/ebay/auth/callback?code=auth-code-123&state=${state}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('connected=true');
      expect(exchangeSpy).toHaveBeenCalledWith('auth-code-123');
      expect(storeSpy).toHaveBeenCalledWith(userId, tokenResponse);

      exchangeSpy.mockRestore();
      storeSpy.mockRestore();
    });

    it('redirects with error when token exchange fails', async () => {
      const state = ctx.ebayAuthService.generateAuthState(userId);

      const exchangeSpy = jest.spyOn(ctx.ebayAuthService, 'exchangeCodeForTokens')
        .mockRejectedValueOnce(new Error('eBay token exchange failed (400)'));

      const res = await request(ctx.app)
        .get(`/api/ebay/auth/callback?code=bad-code&state=${state}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=token_exchange_failed');

      exchangeSpy.mockRestore();
    });

    it('consumes the CSRF state (single-use)', async () => {
      const state = ctx.ebayAuthService.generateAuthState(userId);

      const exchangeSpy = jest.spyOn(ctx.ebayAuthService, 'exchangeCodeForTokens')
        .mockRejectedValue(new Error('fail'));

      // First call consumes the state
      await request(ctx.app)
        .get(`/api/ebay/auth/callback?code=code&state=${state}`);

      exchangeSpy.mockRestore();

      // Second call with same state should fail with invalid_state
      const res = await request(ctx.app)
        .get(`/api/ebay/auth/callback?code=code&state=${state}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=invalid_state');
    });
  });

  // ─── POST /api/ebay/auth/disconnect ─────────────────────────────────────────

  describe('POST /api/ebay/auth/disconnect', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app).post('/api/ebay/auth/disconnect');
      expect(res.status).toBe(401);
    });

    it('returns disconnected: false when no token to deactivate', async () => {
      // Use a user with no stored tokens
      const newUser = await ctx.db.createUser({
        username: 'notoken',
        email: 'notoken@test.com',
        password: 'password123',
      });
      const newToken = userToken(newUser.id);

      const res = await request(ctx.app)
        .post('/api/ebay/auth/disconnect')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(200);
      expect(res.body.disconnected).toBe(false);
    });

    it('returns disconnected: true after disconnecting', async () => {
      // Create a user with stored tokens
      const disconnectUser = await ctx.db.createUser({
        username: 'disconnectme',
        email: 'disconnect@test.com',
        password: 'password123',
      });
      const disconnectToken = userToken(disconnectUser.id);

      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch
      await ctx.ebayAuthService.storeTokens(disconnectUser.id, {
        access_token: 'disc-access',
        refresh_token: 'disc-refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      const res = await request(ctx.app)
        .post('/api/ebay/auth/disconnect')
        .set('Authorization', `Bearer ${disconnectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.disconnected).toBe(true);
    });

    it('returns 500 when service throws', async () => {
      const spy = jest.spyOn(ctx.ebayAuthService, 'disconnect')
        .mockRejectedValueOnce(new Error('DB error'));

      const res = await request(ctx.app)
        .post('/api/ebay/auth/disconnect')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to disconnect eBay account');
      spy.mockRestore();
    });
  });

  // ─── POST /api/ebay/auth/refresh ────────────────────────────────────────────

  describe('POST /api/ebay/auth/refresh', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(ctx.app).post('/api/ebay/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('returns refreshed: true on successful refresh', async () => {
      // Create a user with stored tokens
      const refreshUser = await ctx.db.createUser({
        username: 'refreshuser',
        email: 'refresh@test.com',
        password: 'password123',
      });
      const refreshToken = userToken(refreshUser.id);

      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch
      await ctx.ebayAuthService.storeTokens(refreshUser.id, {
        access_token: 'old-access',
        refresh_token: 'the-refresh-token',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      // Mock the refresh API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 7200,
        }),
      });

      const res = await request(ctx.app)
        .post('/api/ebay/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.refreshed).toBe(true);
    });

    it('returns 500 when no token exists for user', async () => {
      const noTokenUser = await ctx.db.createUser({
        username: 'norefresh',
        email: 'norefresh@test.com',
        password: 'password123',
      });
      const noRefreshToken = userToken(noTokenUser.id);

      const res = await request(ctx.app)
        .post('/api/ebay/auth/refresh')
        .set('Authorization', `Bearer ${noRefreshToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to refresh eBay token');
    });

    it('returns 500 when eBay API rejects refresh', async () => {
      const failUser = await ctx.db.createUser({
        username: 'failrefresh',
        email: 'failrefresh@test.com',
        password: 'password123',
      });
      const failToken = userToken(failUser.id);

      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch
      await ctx.ebayAuthService.storeTokens(failUser.id, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      // Mock the refresh API call to fail
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":"invalid_grant"}',
      });

      const res = await request(ctx.app)
        .post('/api/ebay/auth/refresh')
        .set('Authorization', `Bearer ${failToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to refresh eBay token');
    });
  });
});
