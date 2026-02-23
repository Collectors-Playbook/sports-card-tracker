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

const ENTITY_OPTIONS = ['', 'card', 'user', 'file', 'job', 'export', 'log'];

const getActionBadgeClass = (action: string): string => {
  const prefix = action.split('.')[0].toLowerCase();
  switch (prefix) {
    case 'card': return 'badge-card';
    case 'user': return 'badge-user';
    case 'file': return 'badge-file';
    case 'job': return 'badge-job';
    case 'ebay': return 'badge-ebay';
    case 'image': return 'badge-image';
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

      {error && (
        <div className="audit-error">
          <p>{error}</p>
          <button onClick={fetchEntries}>Retry</button>
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
                  {renderSortableHeader('Timestamp', 'createdAt')}
                  {renderSortableHeader('Action', 'action')}
                  {renderSortableHeader('Entity', 'entity')}
                  {renderSortableHeader('Entity ID', 'entityId')}
                  <th>Details</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="audit-empty">No audit log entries found.</td>
                  </tr>
                ) : (
                  entries.map(entry => (
                    <React.Fragment key={entry.id}>
                      <tr
                        className={`audit-row ${expandedRow === entry.id ? 'expanded' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                      >
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
                      </tr>
                      {expandedRow === entry.id && entry.details && (
                        <tr className="audit-details-row">
                          <td colSpan={6}>
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
