import Database from '../../database';
import EbayAuthService from '../../services/ebayAuthService';
import { Config } from '../../config';
import { EbayEnvironment } from '../../types';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createTestConfig(overrides: Partial<Config['ebay']> = {}): Config {
  return {
    port: 8000,
    frontendUrl: 'http://localhost:3000',
    dataDir: '/tmp/test',
    rawDir: '/tmp/test/raw',
    processedDir: '/tmp/test/processed',
    dbPath: ':memory:',
    jwtSecret: 'test-secret',
    jobPollInterval: 5000,
    puppeteerEnabled: false,
    puppeteerHeadless: true,
    compCacheTtlMs: 86400000,
    rateLimits: {},
    ebay: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:8000/api/ebay/auth/callback',
      environment: 'sandbox' as EbayEnvironment,
      tokenEncryptionKey: 'test-encryption-key-at-least-16-chars',
      scopes: [
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
      ],
      ...overrides,
    },
  };
}

describe('EbayAuthService', () => {
  let db: Database;
  let service: EbayAuthService;
  let config: Config;

  beforeAll(async () => {
    db = new Database(':memory:');
    await db.waitReady();
  });

  beforeEach(() => {
    config = createTestConfig();
    service = new EbayAuthService(db, config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    service.destroy();
  });

  afterAll(async () => {
    await db.close();
  });

  // Helper: create a user for testing
  async function createTestUser(username = 'testuser'): Promise<string> {
    const user = await db.createUser({
      username,
      email: `${username}@test.com`,
      password: 'password123',
    });
    return user.id;
  }

  // ─── Encryption ─────────────────────────────────────────────────────────

  describe('encrypt/decrypt', () => {
    it('should round-trip encrypt and decrypt a string', () => {
      const plaintext = 'v^1.1#i^1#I^3#p^1#r^0#f^0#t^H4sIAAAA...';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-token-value';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
      // Both should decrypt to same value
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('secret-token');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext portion
      const tamperedBytes = Buffer.from(parts[2], 'base64');
      tamperedBytes[0] ^= 0xFF;
      parts[2] = tamperedBytes.toString('base64');
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw on invalid format', () => {
      expect(() => service.decrypt('not-valid-format')).toThrow('Invalid encrypted token format');
    });

    it('should fail to decrypt with a different encryption key', () => {
      const encrypted = service.encrypt('secret-token');

      const otherConfig = createTestConfig({ tokenEncryptionKey: 'different-key-entirely!!' });
      const otherService = new EbayAuthService(db, otherConfig);

      expect(() => otherService.decrypt(encrypted)).toThrow();
      otherService.destroy();
    });
  });

  // ─── CSRF State ──────────────────────────────────────────────────────────

  describe('CSRF state management', () => {
    it('should generate and validate a state token', () => {
      const state = service.generateAuthState('user-123');
      const userId = service.validateAndConsumeState(state);
      expect(userId).toBe('user-123');
    });

    it('should return null for unknown state', () => {
      const userId = service.validateAndConsumeState('unknown-state-value');
      expect(userId).toBeNull();
    });

    it('should consume state on first use (single-use)', () => {
      const state = service.generateAuthState('user-123');
      expect(service.validateAndConsumeState(state)).toBe('user-123');
      expect(service.validateAndConsumeState(state)).toBeNull();
    });

    it('should return null for expired state', () => {
      const state = service.generateAuthState('user-123');

      // Manually expire the state by manipulating the internal map
      const csrfStates = (service as any).csrfStates as Map<string, { userId: string; createdAt: number }>;
      const entry = csrfStates.get(state)!;
      entry.createdAt = Date.now() - 11 * 60 * 1000; // 11 minutes ago

      const userId = service.validateAndConsumeState(state);
      expect(userId).toBeNull();
    });
  });

  // ─── Authorization URL ────────────────────────────────────────────────────

  describe('getAuthorizationUrl', () => {
    it('should generate a valid sandbox authorization URL', () => {
      const url = service.getAuthorizationUrl('user-123');
      expect(url).toContain('https://auth.sandbox.ebay.com/oauth2/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=');
      expect(url).toContain('scope=');
    });

    it('should generate a production URL when configured for production', () => {
      const prodConfig = createTestConfig({ environment: 'production' });
      const prodService = new EbayAuthService(db, prodConfig);
      const url = prodService.getAuthorizationUrl('user-123');
      expect(url).toContain('https://auth.ebay.com/oauth2/authorize');
      prodService.destroy();
    });

    it('should include all required parameters', () => {
      const url = new URL(service.getAuthorizationUrl('user-123'));
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8000/api/ebay/auth/callback');
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('scope')).toContain('sell.inventory');
    });
  });

  // ─── Token Exchange ───────────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const tokenResponse = {
        access_token: 'v^1.1#access-token',
        refresh_token: 'v^1.1#refresh-token',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
        token_type: 'User Access Token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      });

      const result = await service.exchangeCodeForTokens('auth-code-123');
      expect(result).toEqual(tokenResponse);

      // Verify correct request was made
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': expect.stringContaining('Basic '),
          }),
        })
      );

      // Verify Basic auth is properly encoded
      const authHeader = mockFetch.mock.calls[0][1].headers['Authorization'];
      const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('test-client-id:test-client-secret');
    });

    it('should throw on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      });

      await expect(service.exchangeCodeForTokens('bad-code'))
        .rejects.toThrow('eBay token exchange failed (400)');
    });
  });

  // ─── Token Storage ────────────────────────────────────────────────────────

  describe('storeTokens', () => {
    it('should encrypt and store tokens', async () => {
      const userId = await createTestUser('store-test');

      // Mock the username fetch (fire-and-forget, will fail gracefully)
      mockFetch.mockResolvedValueOnce({ ok: false });

      const tokenRow = await service.storeTokens(userId, {
        access_token: 'access-token-value',
        refresh_token: 'refresh-token-value',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      expect(tokenRow.userId).toBe(userId);
      expect(tokenRow.environment).toBe('sandbox');
      expect(tokenRow.isActive).toBe(true);

      // Verify tokens are encrypted (not stored as plaintext)
      expect(tokenRow.accessTokenEncrypted).not.toBe('access-token-value');
      expect(tokenRow.refreshTokenEncrypted).not.toBe('refresh-token-value');

      // Verify tokens can be decrypted
      expect(service.decrypt(tokenRow.accessTokenEncrypted)).toBe('access-token-value');
      expect(service.decrypt(tokenRow.refreshTokenEncrypted)).toBe('refresh-token-value');
    });

    it('should upsert (update existing) on second store', async () => {
      const userId = await createTestUser('upsert-test');

      mockFetch.mockResolvedValue({ ok: false });

      const row1 = await service.storeTokens(userId, {
        access_token: 'first-access',
        refresh_token: 'first-refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      const row2 = await service.storeTokens(userId, {
        access_token: 'second-access',
        refresh_token: 'second-refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      // Should reuse the same row ID
      expect(row2.id).toBe(row1.id);
      expect(service.decrypt(row2.accessTokenEncrypted)).toBe('second-access');
      expect(service.decrypt(row2.refreshTokenEncrypted)).toBe('second-refresh');
    });
  });

  // ─── Auto-refresh / getValidAccessToken ───────────────────────────────────

  describe('getValidAccessToken', () => {
    it('should return cached token if not near expiry', async () => {
      const userId = await createTestUser('valid-token-test');
      mockFetch.mockResolvedValue({ ok: false });

      await service.storeTokens(userId, {
        access_token: 'valid-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 7200, // 2 hours from now
        refresh_token_expires_in: 47304000,
      });

      const accessToken = await service.getValidAccessToken(userId, 'sandbox');
      expect(accessToken).toBe('valid-access-token');
      // Should NOT have made a refresh call (only the username fetch from storeTokens)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should auto-refresh when token is near expiry', async () => {
      const userId = await createTestUser('refresh-test');
      mockFetch.mockResolvedValue({ ok: false });

      await service.storeTokens(userId, {
        access_token: 'old-access-token',
        refresh_token: 'valid-refresh-token',
        expires_in: 60, // Only 60 seconds left (within 5-min buffer)
        refresh_token_expires_in: 47304000,
      });

      // Mock the refresh response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 7200,
        }),
      });

      const accessToken = await service.getValidAccessToken(userId, 'sandbox');
      expect(accessToken).toBe('new-access-token');
    });

    it('should throw when no token exists', async () => {
      await expect(service.getValidAccessToken('nonexistent-user', 'sandbox'))
        .rejects.toThrow('No active eBay token found for this user');
    });
  });

  // ─── Connection Status ────────────────────────────────────────────────────

  describe('getConnectionStatus', () => {
    it('should return disconnected when no token exists', async () => {
      const status = await service.getConnectionStatus('no-such-user', 'sandbox');
      expect(status.connected).toBe(false);
      expect(status.ebayUsername).toBeNull();
      expect(status.environment).toBe('sandbox');
    });

    it('should return connected when valid token exists', async () => {
      const userId = await createTestUser('status-connected');
      mockFetch.mockResolvedValue({ ok: false });

      await service.storeTokens(userId, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      const status = await service.getConnectionStatus(userId, 'sandbox');
      expect(status.connected).toBe(true);
      expect(status.environment).toBe('sandbox');
      expect(status.accessTokenExpiresAt).toBeTruthy();
      expect(status.refreshTokenExpiresAt).toBeTruthy();
    });

    it('should detect expired refresh token', async () => {
      const userId = await createTestUser('status-expired');
      mockFetch.mockResolvedValue({ ok: false });

      await service.storeTokens(userId, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 7200,
        refresh_token_expires_in: -1, // Already expired
      });

      const status = await service.getConnectionStatus(userId, 'sandbox');
      expect(status.connected).toBe(false);
    });
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('should deactivate token in DB', async () => {
      const userId = await createTestUser('disconnect-test');
      mockFetch.mockResolvedValue({ ok: false });

      await service.storeTokens(userId, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      const disconnected = await service.disconnect(userId, 'sandbox');
      expect(disconnected).toBe(true);

      // Should now show as disconnected
      const status = await service.getConnectionStatus(userId, 'sandbox');
      expect(status.connected).toBe(false);
    });

    it('should return false when no token to deactivate', async () => {
      const disconnected = await service.disconnect('no-such-user', 'sandbox');
      expect(disconnected).toBe(false);
    });
  });

  // ─── isConfigured ─────────────────────────────────────────────────────────

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when clientId is missing', () => {
      const badConfig = createTestConfig({ clientId: '' });
      const badService = new EbayAuthService(db, badConfig);
      expect(badService.isConfigured()).toBe(false);
      badService.destroy();
    });

    it('should return false when tokenEncryptionKey is missing', () => {
      const badConfig = createTestConfig({ tokenEncryptionKey: '' });
      const badService = new EbayAuthService(db, badConfig);
      expect(badService.isConfigured()).toBe(false);
      badService.destroy();
    });
  });

  // ─── refreshAccessToken ───────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('should refresh and update the access token', async () => {
      const userId = await createTestUser('manual-refresh');
      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch from storeTokens

      await service.storeTokens(userId, {
        access_token: 'old-access',
        refresh_token: 'the-refresh-token',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-access-token',
          expires_in: 7200,
        }),
      });

      const updatedRow = await service.refreshAccessToken(userId, 'sandbox');
      expect(service.decrypt(updatedRow.accessTokenEncrypted)).toBe('refreshed-access-token');
    });

    it('should throw when no active token exists', async () => {
      await expect(service.refreshAccessToken('nonexistent', 'sandbox'))
        .rejects.toThrow('No active eBay token found for this user');
    });

    it('should throw on eBay API error during refresh', async () => {
      const userId = await createTestUser('refresh-error');
      mockFetch.mockResolvedValueOnce({ ok: false }); // username fetch

      await service.storeTokens(userId, {
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: 7200,
        refresh_token_expires_in: 47304000,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => '{"error":"invalid_grant"}',
      });

      await expect(service.refreshAccessToken(userId, 'sandbox'))
        .rejects.toThrow('eBay token refresh failed (401)');
    });
  });
});
