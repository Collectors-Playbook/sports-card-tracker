import { Router, Request, Response } from 'express';
import Database from '../database';
import CompService from '../services/compService';
import { CompRequest } from '../types';

export function createCompRoutes(db: Database, compService: CompService): Router {
  const router = Router();

  // POST /api/comps/generate
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const { cardId, player, year, brand, cardNumber, condition } = req.body;

      if (!cardId || !player || !year || !brand || !cardNumber) {
        res.status(400).json({ error: 'Missing required fields: cardId, player, year, brand, cardNumber' });
        return;
      }

      const request: CompRequest = { cardId, player, year, brand, cardNumber, condition };
      const report = await compService.generateComps(request);
      res.json(report);
    } catch (error) {
      console.error('Error generating comps:', error);
      res.status(500).json({ error: 'Failed to generate comps' });
    }
  });

  // POST /api/comps/generate-and-save
  router.post('/generate-and-save', async (req: Request, res: Response) => {
    try {
      const { cardId, player, year, brand, cardNumber, condition } = req.body;

      if (!cardId || !player || !year || !brand || !cardNumber) {
        res.status(400).json({ error: 'Missing required fields: cardId, player, year, brand, cardNumber' });
        return;
      }

      const request: CompRequest = { cardId, player, year, brand, cardNumber, condition };
      const report = await compService.generateAndWriteComps(request);
      res.json(report);
    } catch (error) {
      console.error('Error generating and saving comps:', error);
      res.status(500).json({ error: 'Failed to generate and save comps' });
    }
  });

  // GET /api/comps/:cardId
  router.get('/:cardId', async (req: Request, res: Response) => {
    try {
      const card = await db.getCardById(req.params.cardId);
      if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
      }

      const request: CompRequest = {
        cardId: card.id,
        player: card.player,
        year: card.year,
        brand: card.brand,
        cardNumber: card.cardNumber,
        condition: card.condition,
      };

      const report = await compService.generateComps(request);
      res.json(report);
    } catch (error) {
      console.error('Error getting comps for card:', error);
      res.status(500).json({ error: 'Failed to get comps' });
    }
  });

  return router;
}
