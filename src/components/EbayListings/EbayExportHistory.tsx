import React, { useState, useEffect, useCallback } from 'react';
import apiService, { EbayExportDraftSummary } from '../../services/api';

const EbayExportHistory: React.FC = () => {
  const [drafts, setDrafts] = useState<EbayExportDraftSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getEbayExportDrafts(20);
      setDrafts(result.drafts);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load export history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDownload = async (draft: EbayExportDraftSummary) => {
    try {
      await apiService.downloadEbayDraft(draft.id, draft.filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleDelete = async (draft: EbayExportDraftSummary) => {
    if (!window.confirm(`Delete export "${draft.filename}"? This cannot be undone.`)) return;
    try {
      setDeletingId(draft.id);
      await apiService.deleteEbayDraft(draft.id);
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      setTotal(prev => prev - 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  if (loading) {
    return <div className="export-history-loading">Loading export history...</div>;
  }

  if (error) {
    return (
      <div className="export-history-error">
        <p>{error}</p>
        <button onClick={fetchDrafts}>Retry</button>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="export-history-empty">
        <p>No export history yet. Generate an eBay CSV to see past exports here.</p>
      </div>
    );
  }

  return (
    <div className="export-history">
      <h3>Export History ({total})</h3>
      <table className="export-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Cards</th>
            <th>Total Value</th>
            <th>Comp Priced</th>
            <th>Filename</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map(draft => (
            <tr key={draft.id}>
              <td>{formatDate(draft.generatedAt)}</td>
              <td>{draft.totalCards}</td>
              <td>{formatCurrency(draft.totalListingValue)}</td>
              <td>{draft.compPricedCards} / {draft.totalCards}</td>
              <td className="filename-cell" title={draft.filename}>
                {draft.filename.length > 30
                  ? draft.filename.slice(0, 27) + '...'
                  : draft.filename}
              </td>
              <td className="actions-cell">
                <button
                  className="btn-download-draft"
                  onClick={() => handleDownload(draft)}
                  title="Download CSV"
                >
                  Download
                </button>
                <button
                  className="btn-delete-draft"
                  onClick={() => handleDelete(draft)}
                  disabled={deletingId === draft.id}
                  title="Delete export"
                >
                  {deletingId === draft.id ? 'Deleting...' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EbayExportHistory;
