import Database from '../database';
import { AuditLogInput, AuditLogQuery, AuthenticatedRequest } from '../types';

export default class AuditService {
  constructor(private db: Database) {}

  /**
   * Fire-and-forget audit log. Extracts userId and IP from the request.
   * Never throws — errors are caught and logged to console.
   */
  log(req: AuthenticatedRequest, input: Omit<AuditLogInput, 'userId' | 'ipAddress'>): void {
    const entry: AuditLogInput = {
      ...input,
      userId: req.user?.userId ?? null,
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? null,
    };
    this.db.insertAuditLog(entry).catch(err => {
      console.error('Audit log write failed:', err);
    });
  }

  async query(query: AuditLogQuery) {
    return this.db.queryAuditLogs(query);
  }

  async getDistinctActions() {
    return this.db.getDistinctAuditActions();
  }
}
