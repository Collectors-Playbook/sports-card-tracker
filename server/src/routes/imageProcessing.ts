import { Router, Request, Response } from 'express';
import Database from '../database';
import ImageProcessingService from '../services/imageProcessingService';
import FileService from '../services/fileService';

export function createImageProcessingRoutes(
  db: Database,
  imageProcessingService: ImageProcessingService,
  fileService: FileService
): Router {
  const router = Router();

  // POST /api/image-processing/process -- async via job queue
  router.post('/process', async (req: Request, res: Response) => {
    try {
      const { filenames, skipExisting, confidenceThreshold } = req.body;

      if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
        res.status(400).json({ error: 'filenames must be a non-empty array' });
        return;
      }

      const job = await db.createJob({
        type: 'image-processing',
        payload: { filenames, skipExisting, confidenceThreshold },
      });

      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating image-processing job:', error);
      res.status(500).json({ error: 'Failed to create image processing job' });
    }
  });

  // POST /api/image-processing/process-sync -- process single file synchronously
  router.post('/process-sync', async (req: Request, res: Response) => {
    try {
      const { filename, confidenceThreshold } = req.body;

      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'filename is required' });
        return;
      }

      const result = await imageProcessingService.processSingleImage(filename, {
        confidenceThreshold,
      });

      res.json(result);
    } catch (error) {
      console.error('Error processing image:', error);
      res.status(500).json({ error: 'Failed to process image' });
    }
  });

  // POST /api/image-processing/identify -- vision only, no commit
  router.post('/identify', async (req: Request, res: Response) => {
    try {
      const { filename, backFile } = req.body;

      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'filename is required' });
        return;
      }

      const data = await imageProcessingService.identifyOnly(filename, backFile);
      res.json(data);
    } catch (error) {
      console.error('Error identifying card:', error);
      res.status(500).json({ error: 'Failed to identify card' });
    }
  });

  // POST /api/image-processing/confirm -- commit user-reviewed card data
  router.post('/confirm', async (req: Request, res: Response) => {
    try {
      const { filename, backFile, cardData } = req.body;

      if (!filename || typeof filename !== 'string') {
        res.status(400).json({ error: 'filename is required' });
        return;
      }
      if (!cardData || typeof cardData !== 'object') {
        res.status(400).json({ error: 'cardData is required' });
        return;
      }

      const result = await imageProcessingService.confirmCard(filename, cardData, backFile);
      res.json(result);
    } catch (error) {
      console.error('Error confirming card:', error);
      res.status(500).json({ error: 'Failed to confirm card' });
    }
  });

  // GET /api/image-processing/status
  router.get('/status', (_req: Request, res: Response) => {
    try {
      const rawFiles = fileService.listFiles(fileService.getRawDir());
      const processedFiles = fileService.listFiles(fileService.getProcessedDir());
      const errors = fileService.readLog('image-error.log');
      const recentErrors = errors.slice(-10);

      res.json({
        rawCount: rawFiles.length,
        processedCount: processedFiles.length,
        recentErrors,
      });
    } catch (error) {
      console.error('Error getting image processing status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  return router;
}
