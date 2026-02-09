import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadConfig } from './config';
import Database from './database';
import FileService from './services/fileService';
import EventService from './services/eventService';
import JobService from './services/jobService';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { createHealthRoutes } from './routes/health';
import { createCardRoutes } from './routes/cards';
import { createFileRoutes } from './routes/files';
import { createJobRoutes } from './routes/jobs';
import { createEventRoutes } from './routes/events';
import { createAuthRoutes } from './routes/auth';
import { createCompRoutes } from './routes/comps';
import { createImageProcessingRoutes } from './routes/imageProcessing';
import CompService from './services/compService';
import OCRService from './services/ocrService';
import CardParserService from './services/cardParserService';
import ImageProcessingService from './services/imageProcessingService';

dotenv.config();

const config = loadConfig();

// Initialize services
const db = new Database(config.dbPath);
const fileService = new FileService(config.rawDir, config.processedDir, config.dataDir);
const eventService = new EventService();
const jobService = new JobService(db, eventService);
const compService = new CompService(fileService);
const ocrService = new OCRService();
const cardParserService = new CardParserService();
const imageProcessingService = new ImageProcessingService(fileService, db, ocrService, cardParserService);

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(requestLogger);

// Routes
app.use('/api/health', createHealthRoutes(db, fileService));
app.use('/api/cards', createCardRoutes(db));
app.use('/api/files', createFileRoutes(fileService));
app.use('/api/jobs', createJobRoutes(db));
app.use('/api/events', createEventRoutes(eventService));
app.use('/api/auth', createAuthRoutes(db));
app.use('/api/comps', createCompRoutes(db, compService));
app.use('/api/image-processing', createImageProcessingRoutes(db, imageProcessingService, fileService));

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Register job handlers
jobService.registerHandler('comp-generation', async (job, updateProgress) => {
  const cardIds = (job.payload.cardIds as string[]) || [];
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < cardIds.length; i++) {
    const card = await db.getCardById(cardIds[i]);
    if (card) {
      const report = await compService.generateAndWriteComps({
        cardId: card.id,
        player: card.player,
        year: card.year,
        brand: card.brand,
        cardNumber: card.cardNumber,
        condition: card.condition,
      });
      results.push({ cardId: card.id, generatedAt: report.generatedAt });
    }
    await updateProgress(((i + 1) / cardIds.length) * 100, i + 1);
  }

  return { processed: results.length, results };
});

// Register image-processing job handler
jobService.registerHandler('image-processing', async (job, updateProgress) => {
  const payload = job.payload as unknown as { filenames: string[]; skipExisting?: boolean; confidenceThreshold?: number };
  const result = await imageProcessingService.processImages(
    {
      filenames: payload.filenames || [],
      skipExisting: payload.skipExisting,
      confidenceThreshold: payload.confidenceThreshold,
    },
    updateProgress
  );
  return result as unknown as Record<string, unknown>;
});

// Start server (only when run directly, not when imported for testing)
if (require.main === module) {
  (async () => {
    try {
      await db.waitReady();
      console.log('Database ready');

      fileService.ensureDirectories();
      console.log('Directories ready');

      jobService.start(config.jobPollInterval);
      console.log('Job service started');

      eventService.startHeartbeat();

      const server = app.listen(config.port, '0.0.0.0', () => {
        console.log(`Server running on port ${config.port}`);
        console.log(`Frontend URL: ${config.frontendUrl}`);
      });

      const shutdown = () => {
        console.log('Shutting down...');
        jobService.stop();
        eventService.stopHeartbeat();
        server.close(async () => {
          await db.close();
          console.log('Server stopped');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}

export { app, db, fileService, eventService, jobService, compService, ocrService, cardParserService, imageProcessingService };
