import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService, AuditLogEntry } from '../../services/api';
import './AuditLog.css';

interface Filters {
  action: string;
  entity: string;
  limit: number;
  offset: number;
}

type SortableColumn = 'createdAt' | 'action' | 'entity' | 'entityId';

interface SortState {
  column: SortableColumn;
  direction: 'asc' | 'desc';
}

const ENTITY_OPTIONS = ['', 'card', 'user', 'file', 'job', 'export', 'log', 'audit'];

const getActionBadgeClass = (action: string): string => {
  const prefix = action.split('.')[0].toLowerCase();
  switch (prefix) {
    case 'card': return 'badge-card';
    case 'user': return 'badge-user';
    case 'file': return 'badge-file';
    case 'job': return 'badge-job';
    case 'ebay': return 'badge-ebay';
    case 'image': return 'badge-image';
    case 'audit': return 'badge-audit';
    default: return 'badge-default';
  }
};

const truncateDetails = (details: Record<string, unknown> | null, maxLen = 60): string => {
  if (!details) return '-';
  const str = JSON.stringify(details);
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
};

const AuditLog: React.FC = () => {
  const { state: authState } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ action: '', entity: '', limit: 25, offset: 0 });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [sort, setSort] = useState<SortState>({ column: 'createdAt', direction: 'desc' });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Purge dialog state
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [purgeDate, setPurgeDate] = useState('');
  const [purgeAction, setPurgeAction] = useState('');
  const [purgeEntity, setPurgeEntity] = useState('');

  // Success banner
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Export loading
  const [exporting, setExporting] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await apiService.getAuditLogs({
        action: filters.action || undefined,
        entity: filters.entity || undefined,
        limit: filters.limit,
        offset: filters.offset,
        sortBy: sort.column,
        sortDirection: sort.direction,
      });
      setEntries(data.entries);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters, sort]);

  // Fetch entries when filters change
  useEffect(() => {
    setLoading(true);
    fetchEntries();
  }, [fetchEntries]);

  // Fetch distinct actions on mount
  useEffect(() => {
    apiService.getAuditLogActions()
      .then(setActions)
      .catch(() => { /* non-critical */ });
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const id = setInterval(fetchEntries, refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, fetchEntries]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  const handleSort = (column: SortableColumn) => {
    setSort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: column === 'createdAt' ? 'desc' : 'asc' };
    });
    setFilters(prev => ({ ...prev, offset: 0 }));
  };

  const renderSortableHeader = (label: string, column: SortableColumn) => {
    const isActive = sort.column === column;
    const arrow = sort.direction === 'asc' ? '\u25B2' : '\u25BC';
    return (
      <th
        className="audit-sortable-th"
        onClick={() => handleSort(column)}
        aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <span className={`audit-sort-arrow ${isActive ? 'active' : ''}`}>
          {isActive ? arrow : '\u25B2'}
        </span>
      </th>
    );
  };

  // ─── Selection helpers ──────────────────────────────────────────────────────

  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Delete handlers ───────────────────────────────────────────────────────

  const handleDeleteSingle = async (id: string) => {
    if (!window.confirm('Delete this audit log entry?')) return;
    try {
      await apiService.deleteAuditLog(id);
      setSuccessMessage('1 entry deleted.');
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected audit log entries?`)) return;
    try {
      const { deletedCount } = await apiService.deleteAuditLogsBulk(ids);
      setSuccessMessage(`${deletedCount} entries deleted.`);
      setSelectedIds(new Set());
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    }
  };

  const handlePurge = async () => {
    if (!purgeDate) return;
    const isoDate = new Date(purgeDate).toISOString();
    const filterParts: string[] = [];
    if (purgeAction) filterParts.push(`action=${purgeAction}`);
    if (purgeEntity) filterParts.push(`entity=${purgeEntity}`);
    const desc = `Purge all entries before ${purgeDate}${filterParts.length ? ` (${filterParts.join(', ')})` : ''}?`;
    if (!window.confirm(desc)) return;
    try {
      const purgeFilters: { action?: string; entity?: string } = {};
      if (purgeAction) purgeFilters.action = purgeAction;
      if (purgeEntity) purgeFilters.entity = purgeEntity;
      const { deletedCount } = await apiService.purgeAuditLogs(
        isoDate,
        Object.keys(purgeFilters).length > 0 ? purgeFilters : undefined
      );
      setSuccessMessage(`${deletedCount} entries purged.`);
      setShowPurgeDialog(false);
      setPurgeDate('');
      setPurgeAction('');
      setPurgeEntity('');
      setSelectedIds(new Set());
      fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purge failed');
    }
  };

  // ─── Export handlers ────────────────────────────────────────────────────────

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const exportFilters: Record<string, string> = {};
      if (filters.action) exportFilters.action = filters.action;
      if (filters.entity) exportFilters.entity = filters.entity;
      await apiService.exportAuditLogs(
        format,
        Object.keys(exportFilters).length > 0 ? exportFilters : undefined
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ─── Access guard ───────────────────────────────────────────────────────────

  if (authState.user?.role !== 'admin') {
    return (
      <div className="audit-log">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an admin to view audit logs.</p>
        </div>
      </div>
    );
  }

  const handleFilterChange = (key: keyof Filters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...(key !== 'offset' ? { offset: 0 } : {}),
    }));
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);
  const showFrom = total === 0 ? 0 : filters.offset + 1;
  const showTo = Math.min(filters.offset + filters.limit, total);

  return (
    <div className="audit-log">
      <h1>Audit Log</h1>

      <div className="audit-filter-bar">
        <select
          value={filters.action}
          onChange={e => handleFilterChange('action', e.target.value)}
        >
          <option value="">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filters.entity}
          onChange={e => handleFilterChange('entity', e.target.value)}
        >
          <option value="">All entities</option>
          {ENTITY_OPTIONS.filter(Boolean).map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={filters.limit}
          onChange={e => handleFilterChange('limit', Number(e.target.value))}
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>

        <select
          value={refreshInterval}
          onChange={e => setRefreshInterval(Number(e.target.value))}
        >
          <option value={0}>Auto-refresh: Off</option>
          <option value={10000}>Auto-refresh: 10s</option>
          <option value={30000}>Auto-refresh: 30s</option>
          <option value={60000}>Auto-refresh: 60s</option>
        </select>
      </div>

      {/* Toolbar */}
      <div className="audit-toolbar">
        <div className="audit-toolbar-left">
          {selectedIds.size > 0 && (
            <button className="audit-btn audit-btn-danger" onClick={handleDeleteSelected}>
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <button className="audit-btn audit-btn-warning" onClick={() => setShowPurgeDialog(true)}>
            Purge...
          </button>
        </div>
        <div className="audit-toolbar-right">
          <button className="audit-btn audit-btn-secondary" onClick={() => handleExport('csv')} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button className="audit-btn audit-btn-secondary" onClick={() => handleExport('json')} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export JSON'}
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="audit-success">{successMessage}</div>
      )}

      {error && (
        <div className="audit-error">
          <p>{error}</p>
          <button onClick={fetchEntries}>Retry</button>
        </div>
      )}

      {/* Purge Dialog */}
      {showPurgeDialog && (
        <div className="audit-purge-overlay" onClick={() => setShowPurgeDialog(false)}>
          <div className="audit-purge-dialog" onClick={e => e.stopPropagation()}>
            <h3>Purge Audit Logs</h3>
            <p>Delete all entries before the specified date.</p>
            <label>
              Before date:
              <input
                type="date"
                value={purgeDate}
                onChange={e => setPurgeDate(e.target.value)}
              />
            </label>
            <label>
              Action (optional):
              <select value={purgeAction} onChange={e => setPurgeAction(e.target.value)}>
                <option value="">All actions</option>
                {actions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              Entity (optional):
              <select value={purgeEntity} onChange={e => setPurgeEntity(e.target.value)}>
                <option value="">All entities</option>
                {ENTITY_OPTIONS.filter(Boolean).map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </label>
            <div className="audit-purge-actions">
              <button className="audit-btn audit-btn-danger" onClick={handlePurge} disabled={!purgeDate}>
                Purge
              </button>
              <button className="audit-btn audit-btn-secondary" onClick={() => setShowPurgeDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && entries.length === 0 ? (
        <div className="audit-loading">Loading audit logs...</div>
      ) : (
        <>
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th className="audit-checkbox-th">
                    <input
                      type="checkbox"
                      checked={entries.length > 0 && selectedIds.size === entries.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {renderSortableHeader('Timestamp', 'createdAt')}
                  {renderSortableHeader('Action', 'action')}
                  {renderSortableHeader('Entity', 'entity')}
                  {renderSortableHeader('Entity ID', 'entityId')}
                  <th>Details</th>
                  <th>IP</th>
                  <th className="audit-actions-th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="audit-empty">No audit log entries found.</td>
                  </tr>
                ) : (
                  entries.map(entry => (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={`audit-row ${expandedRow === entry.id ? 'expanded' : ''} ${selectedIds.has(entry.id) ? 'selected' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                      >
                        <td className="audit-checkbox-cell" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => toggleSelectRow(entry.id)}
                          />
                        </td>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                        <td>
                          <span className={`audit-action-badge ${getActionBadgeClass(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td>{entry.entity}</td>
                        <td className="audit-entity-id">{entry.entityId || '-'}</td>
                        <td className="audit-details-cell">{truncateDetails(entry.details)}</td>
                        <td>{entry.ipAddress || '-'}</td>
                        <td className="audit-actions-cell" onClick={e => e.stopPropagation()}>
                          <button
                            className="audit-row-delete-btn"
                            title="Delete entry"
                            onClick={() => handleDeleteSingle(entry.id)}
                          >
                            &#128465;
                          </button>
                        </td>
                      </tr>
                      {expandedRow === entry.id && entry.details && (
                        <tr className="audit-details-row">
                          <td colSpan={8}>
                            <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="audit-pagination">
            <span className="audit-pagination-info">
              Showing {showFrom}–{showTo} of {total}
            </span>
            <div className="audit-pagination-buttons">
              <button
                className="audit-page-btn"
                disabled={filters.offset === 0}
                onClick={() => handleFilterChange('offset', Math.max(0, filters.offset - filters.limit))}
              >
                Prev
              </button>
              <span className="audit-page-indicator">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                className="audit-page-btn"
                disabled={filters.offset + filters.limit >= total}
                onClick={() => handleFilterChange('offset', filters.offset + filters.limit)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLog;
