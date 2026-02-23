import Database from '../database';
import { AuditLogEntry, AuditLogQuery, AuditAction, AuditDetailsMap, AuthenticatedRequest } from '../types';

type LogInput<A extends AuditAction> = {
  action: A;
  entity: string;
  entityId?: string | null;
} & (AuditDetailsMap[A] extends undefined
  ? { details?: undefined }
  : { details: AuditDetailsMap[A] });

export default class AuditService {
  constructor(private db: Database) {}

  /**
   * Fire-and-forget audit log. Extracts userId and IP from the request.
   * Never throws — errors are caught and logged to console.
   */
  log<A extends AuditAction>(req: AuthenticatedRequest, input: LogInput<A>): void {
    const entry = {
      ...input,
      details: input.details as Record<string, unknown> | undefined,
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

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<boolean> {
    return this.db.deleteAuditLog(id);
  }

  async deleteBulk(ids: string[]): Promise<number> {
    return this.db.deleteAuditLogs(ids);
  }

  async purge(before: string, filters?: { action?: string; entity?: string; userId?: string }): Promise<number> {
    return this.db.purgeAuditLogs(before, filters);
  }

  // ─── Export ─────────────────────────────────────────────────────────────────

  async exportAll(filters?: { action?: string; entity?: string; userId?: string; before?: string; after?: string }): Promise<AuditLogEntry[]> {
    return this.db.exportAuditLogs(filters);
  }

  formatCSV(entries: AuditLogEntry[]): string {
    const headers = ['id', 'userId', 'action', 'entity', 'entityId', 'details', 'ipAddress', 'createdAt'];
    const escapeCSV = (value: string | null | undefined): string => {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = entries.map(entry =>
      headers.map(h => {
        const val = h === 'details' ? (entry.details ? JSON.stringify(entry.details) : '') : (entry as unknown as Record<string, unknown>)[h];
        return escapeCSV(val as string | null);
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  formatJSON(entries: AuditLogEntry[]): string {
    return JSON.stringify(entries, null, 2);
  }
}
