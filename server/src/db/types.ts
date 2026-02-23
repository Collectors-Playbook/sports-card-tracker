import { users, collections, cards, jobs, auditLogs } from './schema';

export type DbCard = typeof cards.$inferSelect;
export type DbUser = typeof users.$inferSelect;
export type DbCollection = typeof collections.$inferSelect;
export type DbJob = typeof jobs.$inferSelect;
export type DbAuditLogEntry = typeof auditLogs.$inferSelect;
