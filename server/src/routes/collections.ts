import { Router, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest } from '../types';

export function createCollectionRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // Get all collections for the authenticated user
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const collections = await db.getAllCollections(userId);
      res.json(collections);
    } catch (error) {
      console.error('Error getting collections:', error);
      res.status(500).json({ error: 'Failed to fetch collections' });
    }
  });

  // Get default collection
  router.get('/default', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      const collection = await db.getDefaultCollection(userId);
      if (collection) {
        res.json(collection);
      } else {
        // Auto-initialize and return
        const newDefault = await db.initializeUserCollections(userId);
        res.json(newDefault);
      }
    } catch (error) {
      console.error('Error getting default collection:', error);
      res.status(500).json({ error: 'Failed to fetch default collection' });
    }
  });

  // Get collection by ID
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const collection = await db.getCollectionById(req.params.id);
      if (collection) {
        res.json(collection);
      } else {
        res.status(404).json({ error: 'Collection not found' });
      }
    } catch (error) {
      console.error('Error getting collection:', error);
      res.status(500).json({ error: 'Failed to fetch collection' });
    }
  });

  // Get collection stats
  router.get('/:id/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await db.getCollectionStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error('Error getting collection stats:', error);
      res.status(500).json({ error: 'Failed to fetch collection stats' });
    }
  });

  // Create collection
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { name, description, icon, color, visibility, tags } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const collection = await db.createCollection({
        userId,
        name,
        description,
        icon,
        color,
        isDefault: false,
        visibility,
        tags,
      });

      auditService.log(req, { action: 'collection.create', entity: 'collection', entityId: collection.id, details: { name } });
      res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      res.status(500).json({ error: 'Failed to create collection' });
    }
  });

  // Update collection
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, icon, color, visibility, tags } = req.body;
      const collection = await db.updateCollection(req.params.id, {
        name,
        description,
        icon,
        color,
        visibility,
        tags,
      });

      if (collection) {
        auditService.log(req, { action: 'collection.update', entity: 'collection', entityId: collection.id, details: { name: collection.name } });
        res.json(collection);
      } else {
        res.status(404).json({ error: 'Collection not found' });
      }
    } catch (error) {
      console.error('Error updating collection:', error);
      res.status(500).json({ error: 'Failed to update collection' });
    }
  });

  // Delete collection (reject if has cards)
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await db.getCollectionStats(req.params.id);
      if (stats.cardCount > 0) {
        res.status(400).json({ error: `Cannot delete collection with ${stats.cardCount} cards. Move or delete cards first.` });
        return;
      }

      const collection = await db.getCollectionById(req.params.id);
      if (collection?.isDefault) {
        res.status(400).json({ error: 'Cannot delete default collection' });
        return;
      }

      const success = await db.deleteCollection(req.params.id);
      if (success) {
        auditService.log(req, { action: 'collection.delete', entity: 'collection', entityId: req.params.id });
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Collection not found' });
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      res.status(500).json({ error: 'Failed to delete collection' });
    }
  });

  // Set collection as default
  router.post('/:id/set-default', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      await db.setCollectionAsDefault(req.params.id, userId);
      const collection = await db.getCollectionById(req.params.id);
      auditService.log(req, { action: 'collection.set-default', entity: 'collection', entityId: req.params.id });
      res.json(collection);
    } catch (error) {
      console.error('Error setting default collection:', error);
      res.status(500).json({ error: 'Failed to set default collection' });
    }
  });

  // Bulk move cards
  router.post('/move-cards', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cardIds, targetCollectionId } = req.body;
      if (!Array.isArray(cardIds) || !targetCollectionId) {
        res.status(400).json({ error: 'cardIds (array) and targetCollectionId are required' });
        return;
      }

      const moved = await db.moveCardsToCollection(cardIds, targetCollectionId);
      auditService.log(req, { action: 'collection.move-cards', entity: 'collection', entityId: targetCollectionId, details: { cardCount: moved } });
      res.json({ moved });
    } catch (error) {
      console.error('Error moving cards:', error);
      res.status(500).json({ error: 'Failed to move cards' });
    }
  });

  // Initialize user collections (idempotent)
  router.post('/initialize', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const collection = await db.initializeUserCollections(userId);
      res.json(collection);
    } catch (error) {
      console.error('Error initializing collections:', error);
      res.status(500).json({ error: 'Failed to initialize collections' });
    }
  });

  return router;
}
