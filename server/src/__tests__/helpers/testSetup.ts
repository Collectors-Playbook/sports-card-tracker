import express from 'express';
import cors from 'cors';
import Database from '../../database';
import FileService from '../../services/fileService';
import EventService from '../../services/eventService';
import JobService from '../../services/jobService';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import { createHealthRoutes } from '../../routes/health';
import { createCardRoutes } from '../../routes/cards';
import { createFileRoutes } from '../../routes/files';
import { createJobRoutes } from '../../routes/jobs';
import { createEventRoutes } from '../../routes/events';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface TestContext {
  app: express.Express;
  db: Database;
  fileService: FileService;
  eventService: EventService;
  jobService: JobService;
  tempDir: string;
}

export function createTestDb(): Database {
  return new Database(':memory:');
}

export async function createTestApp(): Promise<TestContext> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sct-test-'));
  const rawDir = path.join(tempDir, 'raw');
  const processedDir = path.join(tempDir, 'processed');
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(processedDir, { recursive: true });

  const db = new Database(':memory:');
  await db.waitReady();

  const fileService = new FileService(rawDir, processedDir, tempDir);
  const eventService = new EventService();
  const jobService = new JobService(db, eventService);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/health', createHealthRoutes(db, fileService));
  app.use('/api/cards', createCardRoutes(db));
  app.use('/api/files', createFileRoutes(fileService));
  app.use('/api/jobs', createJobRoutes(db));
  app.use('/api/events', createEventRoutes(eventService));

  app.use(errorHandler);

  return { app, db, fileService, eventService, jobService, tempDir };
}

export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  ctx.jobService.stop();
  ctx.eventService.stopHeartbeat();
  await ctx.db.close();
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
}
