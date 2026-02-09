import { Router, Request, Response } from 'express';
import Database from '../database';
import FileService from '../services/fileService';

export function createHealthRoutes(db: Database, fileService: FileService): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      await db.waitReady();
      const dbConnected = true;
      const directoriesExist = fileService.directoriesExist();

      res.json({
        status: 'OK',
        version: '1.0.0',
        uptime: process.uptime(),
        database: dbConnected ? 'connected' : 'disconnected',
        directories: directoriesExist,
      });
    } catch {
      res.json({
        status: 'ERROR',
        version: '1.0.0',
        uptime: process.uptime(),
        database: 'disconnected',
        directories: false,
      });
    }
  });

  return router;
}
