import crypto from 'crypto';
import Database from '../database';
import { Config } from '../config';
import { EbayEnvironment, EbayAuthStatus, EbayOAuthTokenRow } from '../types';

interface CsrfEntry {
  userId: string;
  createdAt: number;
}

const CSRF_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

const EBAY_URLS = {
  sandbox: {
    authUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    apiUrl: 'https://api.sandbox.ebay.com',
  },
  production: {
    authUrl: 'https://auth.ebay.com/oauth2/authorize',
    tokenUrl: 'https://api.ebay.com/identity/v1/oauth2/token',
    apiUrl: 'https://api.ebay.com',
  },
};

export default class EbayAuthService {
  private csrfStates: Map<string, CsrfEntry> = new Map();
  private csrfCleanupTimer: ReturnType<typeof setInterval>;

  constructor(private db: Database, private config: Config) {
    this.csrfCleanupTimer = setInterval(() => this.cleanupExpiredStates(), CSRF_TTL_MS);
  }

  // ─── Encryption ──────────────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(this.config.ebay.tokenEncryptionKey).digest();
  }

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(encoded: string): string {
    const key = this.getEncryptionKey();
    const parts = encoded.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  // ─── CSRF State Management ───────────────────────────────────────────────

  generateAuthState(userId: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    this.csrfStates.set(state, { userId, createdAt: Date.now() });
    return state;
  }

  validateAndConsumeState(state: string): string | null {
    const entry = this.csrfStates.get(state);
    if (!entry) return null;

    this.csrfStates.delete(state);

    if (Date.now() - entry.createdAt > CSRF_TTL_MS) {
      return null;
    }

    return entry.userId;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, entry] of this.csrfStates.entries()) {
      if (now - entry.createdAt > CSRF_TTL_MS) {
        this.csrfStates.delete(state);
      }
    }
  }

  // ─── eBay API ────────────────────────────────────────────────────────────

  private getUrls(): typeof EBAY_URLS.sandbox {
    return EBAY_URLS[this.config.ebay.environment];
  }

  getAuthorizationUrl(userId: string): string {
    const state = this.generateAuthState(userId);
    const urls = this.getUrls();
    const params = new URLSearchParams({
      client_id: this.config.ebay.clientId,
      response_type: 'code',
      redirect_uri: this.config.ebay.redirectUri,
      scope: this.config.ebay.scopes.join(' '),
      state,
    });
    return `${urls.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in: number;
    token_type: string;
  }> {
    const urls = this.getUrls();
    const credentials = Buffer.from(
      `${this.config.ebay.clientId}:${this.config.ebay.clientSecret}`
    ).toString('base64');

    const response = await fetch(urls.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.ebay.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`eBay token exchange failed (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_token_expires_in: number;
      token_type: string;
    }>;
  }

  async refreshAccessToken(userId: string, environment: EbayEnvironment): Promise<EbayOAuthTokenRow> {
    const tokenRow = await this.db.getEbayOAuthToken(userId, environment);
    if (!tokenRow) {
      throw new Error('No active eBay token found for this user');
    }

    const refreshToken = this.decrypt(tokenRow.refreshTokenEncrypted);
    const urls = EBAY_URLS[environment];
    const credentials = Buffer.from(
      `${this.config.ebay.clientId}:${this.config.ebay.clientSecret}`
    ).toString('base64');

    const response = await fetch(urls.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: this.config.ebay.scopes.join(' '),
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`eBay token refresh failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    const newAccessTokenEncrypted = this.encrypt(data.access_token);
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await this.db.updateEbayAccessToken(tokenRow.id, newAccessTokenEncrypted, newExpiresAt);

    return {
      ...tokenRow,
      accessTokenEncrypted: newAccessTokenEncrypted,
      accessTokenExpiresAt: newExpiresAt,
    };
  }

  async getValidAccessToken(userId: string, environment: EbayEnvironment): Promise<string> {
    const tokenRow = await this.db.getEbayOAuthToken(userId, environment);
    if (!tokenRow) {
      throw new Error('No active eBay token found for this user');
    }

    const expiresAt = new Date(tokenRow.accessTokenExpiresAt).getTime();
    const now = Date.now();

    if (expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
      return this.decrypt(tokenRow.accessTokenEncrypted);
    }

    // Token is near expiry or expired — refresh it
    const refreshedRow = await this.refreshAccessToken(userId, environment);
    return this.decrypt(refreshedRow.accessTokenEncrypted);
  }

  async storeTokens(
    userId: string,
    tokenResponse: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_token_expires_in: number;
    }
  ): Promise<EbayOAuthTokenRow> {
    const accessTokenEncrypted = this.encrypt(tokenResponse.access_token);
    const refreshTokenEncrypted = this.encrypt(tokenResponse.refresh_token);
    const accessTokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    const refreshTokenExpiresAt = new Date(Date.now() + tokenResponse.refresh_token_expires_in * 1000).toISOString();

    const row = await this.db.upsertEbayOAuthToken({
      userId,
      environment: this.config.ebay.environment,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      scopes: this.config.ebay.scopes.join(' '),
    });

    // Asynchronously fetch eBay username (fire-and-forget)
    this.fetchAndStoreEbayUsername(userId, tokenResponse.access_token).catch(err => {
      console.error('Failed to fetch eBay username:', err);
    });

    return row;
  }

  private async fetchAndStoreEbayUsername(userId: string, accessToken: string): Promise<void> {
    const urls = this.getUrls();
    const response = await fetch(`${urls.apiUrl}/commerce/identity/v1/user/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return;

    const data = await response.json() as { username?: string };
    const ebayUsername = data.username;
    if (!ebayUsername) return;

    // Update the stored token with the username
    const tokenRow = await this.db.getEbayOAuthToken(userId, this.config.ebay.environment);
    if (tokenRow) {
      await this.db.upsertEbayOAuthToken({
        userId,
        environment: this.config.ebay.environment,
        accessTokenEncrypted: tokenRow.accessTokenEncrypted,
        refreshTokenEncrypted: tokenRow.refreshTokenEncrypted,
        accessTokenExpiresAt: tokenRow.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenRow.refreshTokenExpiresAt,
        ebayUsername,
        scopes: tokenRow.scopes,
      });
    }
  }

  async getConnectionStatus(userId: string, environment: EbayEnvironment): Promise<EbayAuthStatus> {
    const tokenRow = await this.db.getEbayOAuthToken(userId, environment);

    if (!tokenRow) {
      return {
        connected: false,
        ebayUsername: null,
        environment,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scopes: null,
        isConfigured: this.isConfigured(),
      };
    }

    const refreshExpired = new Date(tokenRow.refreshTokenExpiresAt).getTime() < Date.now();

    return {
      connected: !refreshExpired,
      ebayUsername: tokenRow.ebayUsername,
      environment,
      accessTokenExpiresAt: tokenRow.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenRow.refreshTokenExpiresAt,
      scopes: tokenRow.scopes,
      isConfigured: this.isConfigured(),
    };
  }

  async disconnect(userId: string, environment: EbayEnvironment): Promise<boolean> {
    return this.db.deactivateEbayOAuthToken(userId, environment);
  }

  isConfigured(): boolean {
    return !!(
      this.config.ebay.clientId &&
      this.config.ebay.clientSecret &&
      this.config.ebay.redirectUri &&
      this.config.ebay.tokenEncryptionKey
    );
  }

  destroy(): void {
    clearInterval(this.csrfCleanupTimer);
  }
}
