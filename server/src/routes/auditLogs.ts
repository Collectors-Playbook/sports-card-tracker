import { Router, Response } from 'express';
import AuditService from '../services/auditService';
import { AuthenticatedRequest } from '../types';
import { authenticateToken, requireAdmin } from '../middleware/auth';

export function createAuditLogRoutes(auditService: AuditService): Router {
  const router = Router();

  // GET /api/audit-logs — query audit logs (admin only)
  router.get('/', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, action, entity, entityId, limit, offset, sortBy, sortDirection } = req.query;

      const result = await auditService.query({
        userId: userId as string | undefined,
        action: action as string | undefined,
        entity: entity as string | undefined,
        entityId: entityId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        sortBy: sortBy as 'createdAt' | 'action' | 'entity' | 'entityId' | undefined,
        sortDirection: sortDirection as 'asc' | 'desc' | undefined,
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

  // GET /api/audit-logs/export — export audit logs as CSV or JSON (admin only)
  router.get('/export', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { format, action, entity, userId, before, after } = req.query;

      if (!format || (format !== 'csv' && format !== 'json')) {
        return res.status(400).json({ error: 'Invalid format. Must be "csv" or "json".' });
      }

      const filters: Record<string, string> = {};
      if (action) filters.action = action as string;
      if (entity) filters.entity = entity as string;
      if (userId) filters.userId = userId as string;
      if (before) filters.before = before as string;
      if (after) filters.after = after as string;

      const entries = await auditService.exportAll(
        Object.keys(filters).length > 0 ? filters : undefined
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      if (format === 'csv') {
        const csv = auditService.formatCSV(entries);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${timestamp}.csv"`);
        res.send(csv);
      } else {
        const json = auditService.formatJSON(entries);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${timestamp}.json"`);
        res.send(json);
      }

      // Self-audit the export
      const auditFilters: Record<string, string> = {};
      if (action) auditFilters.action = action as string;
      if (entity) auditFilters.entity = entity as string;
      if (userId) auditFilters.userId = userId as string;
      if (before) auditFilters.before = before as string;
      if (after) auditFilters.after = after as string;

      auditService.log(req, {
        action: 'audit.export',
        entity: 'audit',
        details: {
          format: format as 'csv' | 'json',
          entryCount: entries.length,
          ...(Object.keys(auditFilters).length > 0 && { filters: auditFilters }),
        },
      });
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      res.status(500).json({ error: 'Failed to export audit logs' });
    }
  });

  // POST /api/audit-logs/delete-bulk — bulk delete audit logs (admin only)
  router.post('/delete-bulk', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids must be a non-empty array of strings' });
      }

      const deletedCount = await auditService.deleteBulk(ids);

      auditService.log(req, {
        action: 'audit.delete_bulk',
        entity: 'audit',
        details: { deletedCount, requestedIds: ids },
      });

      res.json({ deletedCount });
    } catch (error) {
      console.error('Error bulk deleting audit logs:', error);
      res.status(500).json({ error: 'Failed to delete audit logs' });
    }
  });

  // POST /api/audit-logs/purge — purge audit logs before a date (admin only)
  router.post('/purge', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { before, action, entity, userId } = req.body;

      if (!before || typeof before !== 'string') {
        return res.status(400).json({ error: 'before must be an ISO date string' });
      }

      // Validate date
      const date = new Date(before);
      if (isNaN(date.getTime())) {
        return res.status(400).json({ error: 'before must be a valid ISO date string' });
      }

      const filters: { action?: string; entity?: string; userId?: string } = {};
      if (action) filters.action = action;
      if (entity) filters.entity = entity;
      if (userId) filters.userId = userId;

      const deletedCount = await auditService.purge(
        before,
        Object.keys(filters).length > 0 ? filters : undefined
      );

      const auditFilters: Record<string, string> = {};
      if (action) auditFilters.action = action;
      if (entity) auditFilters.entity = entity;
      if (userId) auditFilters.userId = userId;

      auditService.log(req, {
        action: 'audit.purge',
        entity: 'audit',
        details: {
          deletedCount,
          before,
          ...(Object.keys(auditFilters).length > 0 && { filters: auditFilters }),
        },
      });

      res.json({ deletedCount });
    } catch (error) {
      console.error('Error purging audit logs:', error);
      res.status(500).json({ error: 'Failed to purge audit logs' });
    }
  });

  // DELETE /api/audit-logs/:id — delete a single audit log (admin only)
  router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await auditService.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Audit log entry not found' });
      }

      auditService.log(req, {
        action: 'audit.delete',
        entity: 'audit',
        entityId: id,
        details: { deletedId: id },
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting audit log:', error);
      res.status(500).json({ error: 'Failed to delete audit log' });
    }
  });

  return router;
}
