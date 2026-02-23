import { Router, Response } from 'express';
import Database from '../database';
import AuditService from '../services/auditService';
import { authenticateToken } from '../middleware/auth';
import { AuthenticatedRequest, GradingSubmissionInput, GradingStatus } from '../types';

const VALID_STATUSES: GradingStatus[] = ['Submitted', 'Received', 'Grading', 'Shipped', 'Complete'];
const VALID_COMPANIES = ['PSA', 'BGS', 'SGC', 'CGC', 'HGA', 'Other'];
const VALID_TIERS = ['Economy', 'Regular', 'Express', 'Super Express', 'Walk-Through'];

export function createGradingSubmissionRoutes(db: Database, auditService: AuditService): Router {
  const router = Router();
  router.use(authenticateToken);

  // GET / — List submissions (filter by status, cardId)
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as GradingStatus | undefined;
      const cardId = req.query.cardId as string | undefined;

      if (status && !VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }

      const submissions = await db.getAllGradingSubmissions({ userId, status, cardId });
      res.json(submissions);
    } catch (error) {
      console.error('Error listing grading submissions:', error);
      res.status(500).json({ error: 'Failed to fetch grading submissions' });
    }
  });

  // GET /stats — Aggregate stats for current user
  router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const stats = await db.getGradingStats(userId);
      res.json(stats);
    } catch (error) {
      console.error('Error getting grading stats:', error);
      res.status(500).json({ error: 'Failed to fetch grading stats' });
    }
  });

  // GET /:id — Get single submission
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const submission = await db.getGradingSubmissionById(req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Grading submission not found' });
        return;
      }
      if (submission.userId !== req.user!.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      res.json(submission);
    } catch (error) {
      console.error('Error getting grading submission:', error);
      res.status(500).json({ error: 'Failed to fetch grading submission' });
    }
  });

  // POST / — Create submission
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const input: GradingSubmissionInput = req.body;

      // Validate required fields
      if (!input.cardId) {
        res.status(400).json({ error: 'Missing required field: cardId' });
        return;
      }
      if (!input.gradingCompany) {
        res.status(400).json({ error: 'Missing required field: gradingCompany' });
        return;
      }
      if (!input.submissionNumber) {
        res.status(400).json({ error: 'Missing required field: submissionNumber' });
        return;
      }
      if (!input.tier) {
        res.status(400).json({ error: 'Missing required field: tier' });
        return;
      }
      if (input.cost === undefined || input.cost === null) {
        res.status(400).json({ error: 'Missing required field: cost' });
        return;
      }
      if (!input.submittedAt) {
        res.status(400).json({ error: 'Missing required field: submittedAt' });
        return;
      }

      // Validate enum values
      if (!VALID_COMPANIES.includes(input.gradingCompany)) {
        res.status(400).json({ error: `Invalid gradingCompany. Must be one of: ${VALID_COMPANIES.join(', ')}` });
        return;
      }
      if (!VALID_TIERS.includes(input.tier)) {
        res.status(400).json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
        return;
      }

      // Validate card exists
      const card = await db.getCardById(input.cardId);
      if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
      }

      const submission = await db.createGradingSubmission(userId, input);
      auditService.log(req, {
        action: 'grading.create',
        entity: 'grading_submission',
        entityId: submission.id,
        details: { cardId: input.cardId, gradingCompany: input.gradingCompany, submissionNumber: input.submissionNumber },
      });
      res.status(201).json(submission);
    } catch (error) {
      console.error('Error creating grading submission:', error);
      res.status(500).json({ error: 'Failed to create grading submission' });
    }
  });

  // PUT /:id — Update submission fields
  router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await db.getGradingSubmissionById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Grading submission not found' });
        return;
      }
      if (existing.userId !== req.user!.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const allowedFields = ['gradingCompany', 'submissionNumber', 'tier', 'cost', 'declaredValue', 'submittedAt', 'estimatedReturnDate', 'notes'];
      const updates: Record<string, unknown> = {};
      const changedFields: string[] = [];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
          changedFields.push(field);
        }
      }

      if (changedFields.length === 0) {
        res.status(400).json({ error: 'No valid fields to update' });
        return;
      }

      const updated = await db.updateGradingSubmission(req.params.id, updates);
      auditService.log(req, {
        action: 'grading.update',
        entity: 'grading_submission',
        entityId: req.params.id,
        details: { submissionId: req.params.id, fields: changedFields },
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating grading submission:', error);
      res.status(500).json({ error: 'Failed to update grading submission' });
    }
  });

  // POST /:id/status — Advance status
  router.post('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await db.getGradingSubmissionById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Grading submission not found' });
        return;
      }
      if (existing.userId !== req.user!.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { status, grade } = req.body as { status: GradingStatus; grade?: string };
      if (!status || !VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }

      // Validate forward-only transition
      const currentIdx = VALID_STATUSES.indexOf(existing.status);
      const newIdx = VALID_STATUSES.indexOf(status);
      if (newIdx <= currentIdx) {
        res.status(400).json({ error: `Cannot transition from ${existing.status} to ${status}. Status can only advance forward.` });
        return;
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status };

      // Set the timestamp for the new status
      switch (status) {
        case 'Received':
          updates.receivedAt = now;
          break;
        case 'Grading':
          updates.gradingAt = now;
          break;
        case 'Shipped':
          updates.shippedAt = now;
          break;
        case 'Complete':
          updates.completedAt = now;
          if (grade) updates.grade = grade;
          break;
      }

      const updated = await db.updateGradingSubmission(req.params.id, updates);

      // On Complete: update card's grade/isGraded/gradingCompany
      if (status === 'Complete' && grade && updated) {
        const card = await db.getCardById(updated.cardId);
        if (card) {
          await db.updateCard(card.id, {
            ...card,
            grade,
            isGraded: true,
            gradingCompany: updated.gradingCompany,
          });
        }
      }

      auditService.log(req, {
        action: 'grading.update_status',
        entity: 'grading_submission',
        entityId: req.params.id,
        details: { submissionId: req.params.id, oldStatus: existing.status, newStatus: status, ...(grade ? { grade } : {}) },
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating grading submission status:', error);
      res.status(500).json({ error: 'Failed to update grading submission status' });
    }
  });

  // DELETE /:id — Delete submission
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const existing = await db.getGradingSubmissionById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Grading submission not found' });
        return;
      }
      if (existing.userId !== req.user!.userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await db.deleteGradingSubmission(req.params.id);
      auditService.log(req, {
        action: 'grading.delete',
        entity: 'grading_submission',
        entityId: req.params.id,
        details: { submissionId: req.params.id, cardId: existing.cardId },
      });
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting grading submission:', error);
      res.status(500).json({ error: 'Failed to delete grading submission' });
    }
  });

  return router;
}
