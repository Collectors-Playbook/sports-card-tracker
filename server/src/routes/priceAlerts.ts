import { Router, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import PriceAlertService from '../services/priceAlertService';
import { AuthenticatedRequest, PriceAlertInput } from '../types';

export function createPriceAlertRoutes(
  db: Database,
  auditService: AuditService,
  priceAlertService: PriceAlertService
): Router {
  const router = Router();

  // Get alerts for the authenticated user
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const alerts = await db.getPriceAlertsByUser(userId);
      res.json(alerts);
    } catch (error) {
      console.error('Error getting price alerts:', error);
      res.status(500).json({ error: 'Failed to fetch price alerts' });
    }
  });

  // Get alerts for a specific card
  router.get('/card/:cardId', async (req, res: Response) => {
    try {
      const alerts = await db.getPriceAlertsByCard(req.params.cardId);
      res.json(alerts);
    } catch (error) {
      console.error('Error getting card alerts:', error);
      res.status(500).json({ error: 'Failed to fetch card alerts' });
    }
  });

  // Get recent alert history for the authenticated user
  router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await db.getRecentAlertHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error('Error getting alert history:', error);
      res.status(500).json({ error: 'Failed to fetch alert history' });
    }
  });

  // Get history for a specific alert
  router.get('/:id/history', async (req, res: Response) => {
    try {
      const history = await db.getAlertHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error('Error getting alert history:', error);
      res.status(500).json({ error: 'Failed to fetch alert history' });
    }
  });

  // Create a new price alert
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const input: PriceAlertInput = req.body;
      if (!input.cardId || !input.type) {
        res.status(400).json({ error: 'cardId and type are required' });
        return;
      }

      if (!['above', 'below'].includes(input.type)) {
        res.status(400).json({ error: 'type must be "above" or "below"' });
        return;
      }

      if (input.type === 'above' && (input.thresholdHigh === undefined || input.thresholdHigh === null)) {
        res.status(400).json({ error: 'thresholdHigh is required for "above" alerts' });
        return;
      }

      if (input.type === 'below' && (input.thresholdLow === undefined || input.thresholdLow === null)) {
        res.status(400).json({ error: 'thresholdLow is required for "below" alerts' });
        return;
      }

      const alert = await db.createPriceAlert(userId, input);

      auditService.log(req, {
        action: 'price_alert.create',
        entity: 'price_alert',
        entityId: alert.id,
        details: { cardId: input.cardId, type: input.type },
      });

      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating price alert:', error);
      res.status(500).json({ error: 'Failed to create price alert' });
    }
  });

  // Update a price alert
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const existing = await db.getPriceAlert(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      if (existing.userId !== userId) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }

      const alert = await db.updatePriceAlert(req.params.id, req.body);

      auditService.log(req, {
        action: 'price_alert.update',
        entity: 'price_alert',
        entityId: req.params.id,
        details: req.body,
      });

      res.json(alert);
    } catch (error) {
      console.error('Error updating price alert:', error);
      res.status(500).json({ error: 'Failed to update price alert' });
    }
  });

  // Delete a price alert
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const existing = await db.getPriceAlert(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      if (existing.userId !== userId) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }

      await db.deletePriceAlert(req.params.id);

      auditService.log(req, {
        action: 'price_alert.delete',
        entity: 'price_alert',
        entityId: req.params.id,
        details: { cardId: existing.cardId },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting price alert:', error);
      res.status(500).json({ error: 'Failed to delete price alert' });
    }
  });

  // Manually trigger alert check
  router.post('/check', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const result = await priceAlertService.checkAlerts();
      res.json(result);
    } catch (error) {
      console.error('Error checking alerts:', error);
      res.status(500).json({ error: 'Failed to check alerts' });
    }
  });

  return router;
}
