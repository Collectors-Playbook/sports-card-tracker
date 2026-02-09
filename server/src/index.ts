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

dotenv.config();

const config = loadConfig();

// Initialize services
const db = new Database(config.dbPath);
const fileService = new FileService(config.rawDir, config.processedDir, config.dataDir);
const eventService = new EventService();
const jobService = new JobService(db, eventService);

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

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
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

export { app, db, fileService, eventService, jobService };
