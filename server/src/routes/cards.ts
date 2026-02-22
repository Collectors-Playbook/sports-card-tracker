import { Router, Request, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, CardInput } from '../types';

export function createCardRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // Get all cards (or find by image filename)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const image = req.query.image as string | undefined;
      if (image) {
        const card = await db.getCardByImage(image);
        if (card) {
          res.json(card);
        } else {
          res.status(404).json({ error: 'No card found for that image' });
        }
        return;
      }

      const userId = req.query.userId as string | undefined;
      const collectionId = req.query.collectionId as string | undefined;
      const collectionType = req.query.collectionType as string | undefined;
      const cards = await db.getAllCards({ userId, collectionId, collectionType });
      res.json(cards);
    } catch (error) {
      console.error('Error getting cards:', error);
      res.status(500).json({ error: 'Failed to fetch cards' });
    }
  });

  // Get a single card by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const card = await db.getCardById(req.params.id);
      if (card) {
        res.json(card);
      } else {
        res.status(404).json({ error: 'Card not found' });
      }
    } catch (error) {
      console.error('Error getting card:', error);
      res.status(500).json({ error: 'Failed to fetch card' });
    }
  });

  // Create a new card
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const cardInput: CardInput = req.body;

      const requiredFields = ['player', 'team', 'year', 'brand', 'category', 'cardNumber', 'condition', 'purchasePrice', 'purchaseDate', 'currentValue'];
      for (const field of requiredFields) {
        if (cardInput[field as keyof CardInput] === undefined || cardInput[field as keyof CardInput] === null || cardInput[field as keyof CardInput] === '') {
          res.status(400).json({ error: `Missing required field: ${field}` });
          return;
        }
      }

      if (!Array.isArray(cardInput.images)) {
        cardInput.images = [];
      }
      if (!cardInput.notes) {
        cardInput.notes = '';
      }

      const card = await db.createCard(cardInput);
      auditService.log(req, { action: 'card.create', entity: 'card', entityId: card.id, details: { player: card.player, year: card.year, brand: card.brand } });
      res.status(201).json(card);
    } catch (error) {
      console.error('Error creating card:', error);
      res.status(500).json({ error: 'Failed to create card' });
    }
  });

  // Update a card
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const cardInput: CardInput = req.body;

      const requiredFields = ['player', 'team', 'year', 'brand', 'category', 'cardNumber', 'condition', 'purchasePrice', 'purchaseDate', 'currentValue'];
      for (const field of requiredFields) {
        if (cardInput[field as keyof CardInput] === undefined || cardInput[field as keyof CardInput] === null || cardInput[field as keyof CardInput] === '') {
          res.status(400).json({ error: `Missing required field: ${field}` });
          return;
        }
      }

      if (!Array.isArray(cardInput.images)) {
        cardInput.images = [];
      }
      if (!cardInput.notes) {
        cardInput.notes = '';
      }

      const card = await db.updateCard(req.params.id, cardInput);
      if (card) {
        auditService.log(req, { action: 'card.update', entity: 'card', entityId: card.id, details: { player: card.player, year: card.year, brand: card.brand } });
        res.json(card);
      } else {
        res.status(404).json({ error: 'Card not found' });
      }
    } catch (error) {
      console.error('Error updating card:', error);
      res.status(500).json({ error: 'Failed to update card' });
    }
  });

  // Delete a card
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await db.deleteCard(req.params.id);
      if (success) {
        auditService.log(req, { action: 'card.delete', entity: 'card', entityId: req.params.id });
        res.status(204).send();
      } else {
        res.status(404).json({ error: 'Card not found' });
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      res.status(500).json({ error: 'Failed to delete card' });
    }
  });

  return router;
}
