import { Router, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, StorageLocation } from '../types';

export function createStorageRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // Get all distinct storage locations with card counts
  router.get('/locations', async (_req, res: Response) => {
    try {
      const locations = db.getDistinctStorageLocations();
      res.json(locations);
    } catch (error) {
      console.error('Error getting storage locations:', error);
      res.status(500).json({ error: 'Failed to fetch storage locations' });
    }
  });

  // Get cards by storage location
  router.get('/cards', async (req, res: Response) => {
    try {
      const room = req.query.room as string | undefined;
      const shelf = req.query.shelf as string | undefined;
      const box = req.query.box as string | undefined;
      const cards = await db.getCardsByStorage({ room, shelf, box });
      res.json(cards);
    } catch (error) {
      console.error('Error getting cards by storage:', error);
      res.status(500).json({ error: 'Failed to fetch cards by storage' });
    }
  });

  // Update a single card's storage location
  router.put('/cards/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const location: StorageLocation | null = req.body.location;
      const card = await db.updateCardStorage(req.params.id, location);

      if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
      }

      auditService.log(req, {
        action: 'storage.update',
        entity: 'card',
        entityId: card.id,
        details: { cardId: card.id, location: location || {} },
      });

      res.json(card);
    } catch (error) {
      console.error('Error updating card storage:', error);
      res.status(500).json({ error: 'Failed to update card storage' });
    }
  });

  // Bulk assign storage location to multiple cards
  router.post('/bulk-assign', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { cardIds, location } = req.body as { cardIds: string[]; location: StorageLocation };

      if (!Array.isArray(cardIds) || cardIds.length === 0) {
        res.status(400).json({ error: 'cardIds must be a non-empty array' });
        return;
      }

      if (!location || !location.room) {
        res.status(400).json({ error: 'location with at least a room is required' });
        return;
      }

      const updated = await db.bulkUpdateCardStorage(cardIds, location);

      auditService.log(req, {
        action: 'storage.bulk_assign',
        entity: 'storage',
        entityId: null,
        details: { cardIds, location },
      });

      res.json({ updated });
    } catch (error) {
      console.error('Error bulk assigning storage:', error);
      res.status(500).json({ error: 'Failed to bulk assign storage' });
    }
  });

  return router;
}
