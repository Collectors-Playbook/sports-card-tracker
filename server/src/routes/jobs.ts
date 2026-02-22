import { Router, Request, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import { AuthenticatedRequest, JobStatus } from '../types';

export function createJobRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();

  // Create a job
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, payload } = req.body;
      if (!type) {
        res.status(400).json({ error: 'Missing required field: type' });
        return;
      }

      const job = await db.createJob({ type, payload });
      auditService.log(req, { action: 'job.create', entity: 'job', entityId: job.id, details: { type } });
      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  });

  // List jobs
  router.get('/', async (req: Request, res: Response) => {
    try {
      const status = req.query.status as JobStatus | undefined;
      const type = req.query.type as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const jobs = await db.getAllJobs({ status, type, limit });
      res.json(jobs);
    } catch (error) {
      console.error('Error listing jobs:', error);
      res.status(500).json({ error: 'Failed to list jobs' });
    }
  });

  // Get job by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const job = await db.getJobById(req.params.id);
      if (job) {
        res.json(job);
      } else {
        res.status(404).json({ error: 'Job not found' });
      }
    } catch (error) {
      console.error('Error getting job:', error);
      res.status(500).json({ error: 'Failed to get job' });
    }
  });

  // Cancel a job
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const job = await db.getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        res.status(400).json({ error: `Cannot cancel a ${job.status} job` });
        return;
      }

      const updated = await db.updateJob(req.params.id, { status: 'cancelled' });
      auditService.log(req, { action: 'job.cancel', entity: 'job', entityId: req.params.id, details: { type: job.type } });
      res.json(updated);
    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });

  return router;
}
