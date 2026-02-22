import { Router, Request, Response } from 'express';
import Database from '../database';
import EbayExportService from '../services/ebayExportService';
import AuditService from '../services/auditService';
import { AuthenticatedRequest } from '../types';

export function createEbayRoutes(db: Database, ebayExportService: EbayExportService, auditService: AuditService): Router {
  const router = Router();

  // POST /api/ebay/generate — Sync CSV generation
  router.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { priceMultiplier, shippingCost, duration, location, dispatchTime, cardIds } = req.body;

      if (priceMultiplier == null || shippingCost == null) {
        res.status(400).json({ error: 'Missing required fields: priceMultiplier, shippingCost' });
        return;
      }

      const result = await ebayExportService.generateCsv({
        priceMultiplier,
        shippingCost,
        duration: duration || 'GTC',
        location: location || 'USA',
        dispatchTime: dispatchTime || 1,
        cardIds,
      });

      auditService.log(req, { action: 'ebay.generate', entity: 'export', details: { totalCards: result.totalCards } });
      res.json(result);
    } catch (error) {
      console.error('Error generating eBay CSV:', error);
      res.status(500).json({ error: 'Failed to generate eBay CSV' });
    }
  });

  // POST /api/ebay/generate-async — Creates ebay-csv job for async processing
  router.post('/generate-async', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { priceMultiplier, shippingCost, duration, location, dispatchTime, cardIds } = req.body;

      if (priceMultiplier == null || shippingCost == null) {
        res.status(400).json({ error: 'Missing required fields: priceMultiplier, shippingCost' });
        return;
      }

      const job = await db.createJob({
        type: 'ebay-csv',
        payload: { priceMultiplier, shippingCost, duration, location, dispatchTime, cardIds },
      });

      auditService.log(req, { action: 'ebay.generate_async', entity: 'job', entityId: job.id });
      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating eBay CSV job:', error);
      res.status(500).json({ error: 'Failed to create eBay CSV job' });
    }
  });

  // GET /api/ebay/download — Downloads generated CSV
  router.get('/download', (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!ebayExportService.outputExists()) {
        res.status(404).json({ error: 'No generated CSV file found. Run generate first.' });
        return;
      }

      const outputPath = ebayExportService.getOutputPath();
      auditService.log(req, { action: 'ebay.download', entity: 'export' });
      res.download(outputPath, 'ebay-draft-upload-batch.csv');
    } catch (error) {
      console.error('Error downloading eBay CSV:', error);
      res.status(500).json({ error: 'Failed to download eBay CSV' });
    }
  });

  // GET /api/ebay/template — Downloads template CSV
  router.get('/template', (_req: Request, res: Response) => {
    try {
      if (!ebayExportService.templateExists()) {
        res.status(404).json({ error: 'Template CSV not found' });
        return;
      }

      const templatePath = ebayExportService.getTemplatePath();
      res.download(templatePath, 'eBay-draft-listing-template.csv');
    } catch (error) {
      console.error('Error downloading template:', error);
      res.status(500).json({ error: 'Failed to download template' });
    }
  });

  // GET /api/ebay/status — Returns existence flags
  router.get('/status', (_req: Request, res: Response) => {
    try {
      res.json({
        templateExists: ebayExportService.templateExists(),
        outputExists: ebayExportService.outputExists(),
      });
    } catch (error) {
      console.error('Error checking eBay status:', error);
      res.status(500).json({ error: 'Failed to check eBay export status' });
    }
  });

  return router;
}
