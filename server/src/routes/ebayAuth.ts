import { Router, Response } from 'express';
import EbayAuthService from '../services/ebayAuthService';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, EbayEnvironment } from '../types';
import { authenticateToken } from '../middleware/auth';
import { loadConfig } from '../config';

export function createEbayAuthRoutes(ebayAuthService: EbayAuthService, auditService: AuditService): Router {
  const router = Router();

  // GET /api/ebay/auth/status — Connection state + eBay username
  router.get('/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = loadConfig();
      const environment = config.ebay.environment;
      const status = await ebayAuthService.getConnectionStatus(userId, environment);
      res.json(status);
    } catch (error) {
      console.error('Error getting eBay auth status:', error);
      res.status(500).json({ error: 'Failed to get eBay connection status' });
    }
  });

  // GET /api/ebay/auth/authorize — Returns eBay consent URL
  router.get('/authorize', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ebayAuthService.isConfigured()) {
        res.status(400).json({ error: 'eBay OAuth is not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_REDIRECT_URI, and EBAY_TOKEN_ENCRYPTION_KEY.' });
        return;
      }

      const userId = req.user!.userId;
      const url = ebayAuthService.getAuthorizationUrl(userId);
      res.json({ url });
    } catch (error) {
      console.error('Error generating eBay auth URL:', error);
      res.status(500).json({ error: 'Failed to generate eBay authorization URL' });
    }
  });

  // GET /api/ebay/auth/callback — eBay redirect → exchange code → store tokens
  router.get('/callback', async (req: AuthenticatedRequest, res: Response) => {
    const config = loadConfig();
    const frontendUrl = config.frontendUrl;

    try {
      const { code, state } = req.query;

      if (!code || !state) {
        res.redirect(`${frontendUrl}/settings/ebay?error=missing_params`);
        return;
      }

      const userId = ebayAuthService.validateAndConsumeState(state as string);
      if (!userId) {
        res.redirect(`${frontendUrl}/settings/ebay?error=invalid_state`);
        return;
      }

      const tokenResponse = await ebayAuthService.exchangeCodeForTokens(code as string);
      const tokenRow = await ebayAuthService.storeTokens(userId, tokenResponse);

      auditService.log(req, {
        action: 'ebay_auth.connect',
        entity: 'ebay_oauth',
        entityId: tokenRow.id,
        details: { environment: config.ebay.environment, ebayUsername: tokenRow.ebayUsername ?? undefined },
      });

      res.redirect(`${frontendUrl}/settings/ebay?connected=true`);
    } catch (error) {
      console.error('eBay OAuth callback error:', error);
      res.redirect(`${frontendUrl}/settings/ebay?error=token_exchange_failed`);
    }
  });

  // POST /api/ebay/auth/disconnect — Deactivate tokens
  router.post('/disconnect', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = loadConfig();
      const environment = config.ebay.environment;
      const disconnected = await ebayAuthService.disconnect(userId, environment);

      if (disconnected) {
        auditService.log(req, {
          action: 'ebay_auth.disconnect',
          entity: 'ebay_oauth',
          details: { environment },
        });
      }

      res.json({ disconnected });
    } catch (error) {
      console.error('Error disconnecting eBay:', error);
      res.status(500).json({ error: 'Failed to disconnect eBay account' });
    }
  });

  // POST /api/ebay/auth/refresh — Manual token refresh
  router.post('/refresh', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const config = loadConfig();
      const environment = config.ebay.environment;

      await ebayAuthService.refreshAccessToken(userId, environment);

      auditService.log(req, {
        action: 'ebay_auth.token_refresh',
        entity: 'ebay_oauth',
        details: { environment },
      });

      res.json({ refreshed: true });
    } catch (error) {
      const config = loadConfig();
      auditService.log(req, {
        action: 'ebay_auth.token_refresh_failed',
        entity: 'ebay_oauth',
        details: { environment: config.ebay.environment, error: (error as Error).message },
      });
      console.error('Error refreshing eBay token:', error);
      res.status(500).json({ error: 'Failed to refresh eBay token' });
    }
  });

  return router;
}
