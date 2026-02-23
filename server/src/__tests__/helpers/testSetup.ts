import express from 'express';
import cors from 'cors';
import Database from '../../database';
import FileService from '../../services/fileService';
import EventService from '../../services/eventService';
import JobService from '../../services/jobService';
import CompService from '../../services/compService';
import OCRService from '../../services/ocrService';
import CardParserService from '../../services/cardParserService';
import ImageProcessingService from '../../services/imageProcessingService';
import EbayExportService from '../../services/ebayExportService';
import AuditService from '../../services/auditService';
import { requestLogger } from '../../middleware/requestLogger';
import { errorHandler } from '../../middleware/errorHandler';
import { optionalAuth } from '../../middleware/auth';
import { createHealthRoutes } from '../../routes/health';
import { createCardRoutes } from '../../routes/cards';
import { createFileRoutes } from '../../routes/files';
import { createJobRoutes } from '../../routes/jobs';
import { createEventRoutes } from '../../routes/events';
import { createAuthRoutes } from '../../routes/auth';
import { createCompRoutes } from '../../routes/comps';
import { createImageProcessingRoutes } from '../../routes/imageProcessing';
import { createEbayRoutes } from '../../routes/ebay';
import { createAuditLogRoutes } from '../../routes/auditLogs';
import { createAdminUserRoutes } from '../../routes/adminUsers';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface TestContext {
  app: express.Express;
  db: Database;
  fileService: FileService;
  eventService: EventService;
  jobService: JobService;
  compService: CompService;
  imageProcessingService: ImageProcessingService;
  ebayExportService: EbayExportService;
  ocrService: OCRService;
  cardParserService: CardParserService;
  visionService: { identifyCard: jest.Mock; identifyCardPair: jest.Mock };
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
  const compService = new CompService(fileService);
  const ocrService = new OCRService();
  const cardParserService = new CardParserService();
  // Use a stub vision service to avoid requiring ANTHROPIC_API_KEY in tests
  const stubVisionService = {
    identifyCard: jest.fn().mockRejectedValue(new Error('Vision service not configured in tests')),
    identifyCardPair: jest.fn().mockRejectedValue(new Error('Vision service not configured in tests')),
  } as any;
  const imageProcessingService = new ImageProcessingService(fileService, db, stubVisionService);
  const ebayExportService = new EbayExportService(db, fileService);
  const auditService = new AuditService(db);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(optionalAuth);

  app.use('/api/health', createHealthRoutes(db, fileService));
  app.use('/api/cards', createCardRoutes(db, auditService));
  app.use('/api/files', createFileRoutes(fileService, auditService));
  app.use('/api/jobs', createJobRoutes(db, auditService));
  app.use('/api/events', createEventRoutes(eventService));
  app.use('/api/auth', createAuthRoutes(db, auditService));
  app.use('/api/comps', createCompRoutes(db, compService));
  app.use('/api/image-processing', createImageProcessingRoutes(db, imageProcessingService, fileService, auditService));
  app.use('/api/ebay', createEbayRoutes(db, ebayExportService, auditService));
  app.use('/api/audit-logs', createAuditLogRoutes(auditService));
  app.use('/api/admin/users', createAdminUserRoutes(db, auditService));

  app.use(errorHandler);

  return { app, db, fileService, eventService, jobService, compService, imageProcessingService, ebayExportService, ocrService, cardParserService, visionService: stubVisionService, tempDir };
}

export async function cleanupTestContext(ctx: TestContext): Promise<void> {
  ctx.jobService.stop();
  ctx.eventService.stopHeartbeat();
  await ctx.db.close();
  fs.rmSync(ctx.tempDir, { recursive: true, force: true });
}
