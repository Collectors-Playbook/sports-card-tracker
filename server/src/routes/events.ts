import { Router, Request, Response } from 'express';
import EventService from '../services/eventService';

export function createEventRoutes(eventService: EventService): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const clientId = eventService.addClient(res);

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    req.on('close', () => {
      eventService.removeClient(clientId);
    });
  });

  return router;
}
