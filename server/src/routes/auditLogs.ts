import { Router, Response } from 'express';
import AuditService from '../services/auditService';
import { AuthenticatedRequest } from '../types';
import { authenticateToken, requireAdmin } from '../middleware/auth';

export function createAuditLogRoutes(auditService: AuditService): Router {
  const router = Router();

  // GET /api/audit-logs — query audit logs (admin only)
  router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, action, entity, entityId, limit, offset } = req.query;

      const result = await auditService.query({
        userId: userId as string | undefined,
        action: action as string | undefined,
        entity: entity as string | undefined,
        entityId: entityId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error('Error querying audit logs:', error);
      res.status(500).json({ error: 'Failed to query audit logs' });
    }
  });

  // GET /api/audit-logs/actions — list distinct action values (admin only)
  router.get('/actions', authenticateToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const actions = await auditService.getDistinctActions();
      res.json(actions);
    } catch (error) {
      console.error('Error getting audit actions:', error);
      res.status(500).json({ error: 'Failed to get audit actions' });
    }
  });

  return router;
}
