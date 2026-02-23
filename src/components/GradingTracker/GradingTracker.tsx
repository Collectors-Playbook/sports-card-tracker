import React, { useState, useEffect, useCallback } from 'react';
import { apiService, GradingSubmission, GradingStats } from '../../services/api';
import GradingSubmissionForm from './GradingSubmissionForm';
import './GradingTracker.css';

const STATUS_ORDER = ['Submitted', 'Received', 'Grading', 'Shipped', 'Complete'];
const ALL_FILTER = 'All';

function nextStatus(current: string): string | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

const GradingTracker: React.FC = () => {
  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [stats, setStats] = useState<GradingStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<GradingSubmission | null>(null);
  const [gradeModal, setGradeModal] = useState<{ submissionId: string } | null>(null);
  const [gradeInput, setGradeInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = statusFilter !== ALL_FILTER ? { status: statusFilter } : undefined;
      const [subs, st] = await Promise.all([
        apiService.getGradingSubmissions(filters),
        apiService.getGradingStats(),
      ]);
      setSubmissions(subs);
      setStats(st);
    } catch (err) {
      console.error('Failed to fetch grading data:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdvanceStatus = async (submission: GradingSubmission) => {
    const next = nextStatus(submission.status);
    if (!next) return;

    if (next === 'Complete') {
      setGradeModal({ submissionId: submission.id });
      setGradeInput('');
      return;
    }

    try {
      await apiService.updateGradingSubmissionStatus(submission.id, next);
      fetchData();
    } catch (err) {
      console.error('Failed to advance status:', err);
    }
  };

  const handleCompleteWithGrade = async () => {
    if (!gradeModal) return;
    try {
      await apiService.updateGradingSubmissionStatus(
        gradeModal.submissionId,
        'Complete',
        gradeInput || undefined
      );
      setGradeModal(null);
      fetchData();
    } catch (err) {
      console.error('Failed to complete submission:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this grading submission?')) return;
    try {
      await apiService.deleteGradingSubmission(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete submission:', err);
    }
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditingSubmission(null);
    fetchData();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="grading-tracker">
      <h2>Grading Submissions</h2>

      {/* Stats Bar */}
      {stats && (
        <div className="grading-stats-bar">
          <div className="grading-stat-card">
            <div className="stat-value">{stats.totalSubmissions}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
          <div className="grading-stat-card">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="grading-stat-card">
            <div className="stat-value">{stats.complete}</div>
            <div className="stat-label">Complete</div>
          </div>
          <div className="grading-stat-card">
            <div className="stat-value">{formatCurrency(stats.totalCost)}</div>
            <div className="stat-label">Total Cost</div>
          </div>
          <div className="grading-stat-card">
            <div className="stat-value">{stats.avgTurnaroundDays != null ? `${stats.avgTurnaroundDays}d` : '--'}</div>
            <div className="stat-label">Avg Turnaround</div>
          </div>
          <div className="grading-stat-card">
            <div className="stat-value">{stats.avgGrade != null ? stats.avgGrade : '--'}</div>
            <div className="stat-label">Avg Grade</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="grading-filter-tabs">
        {[ALL_FILTER, ...STATUS_ORDER].map(status => (
          <button
            key={status}
            className={`grading-filter-tab ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="grading-actions-bar">
        <button className="grading-new-btn" onClick={() => { setEditingSubmission(null); setShowForm(true); }}>
          + New Submission
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="grading-loading">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="grading-empty">
          <p>No grading submissions found.</p>
          <button className="grading-new-btn" onClick={() => setShowForm(true)}>
            Create Your First Submission
          </button>
        </div>
      ) : (
        <div className="grading-table-wrapper">
          <table className="grading-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Submission #</th>
                <th>Status</th>
                <th>Tier</th>
                <th>Cost</th>
                <th>Submitted</th>
                <th>Est. Return</th>
                <th>Grade</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <tr key={sub.id}>
                  <td>{sub.gradingCompany}</td>
                  <td>{sub.submissionNumber}</td>
                  <td><span className={`grading-status-badge ${sub.status}`}>{sub.status}</span></td>
                  <td>{sub.tier}</td>
                  <td>{formatCurrency(sub.cost)}</td>
                  <td>{formatDate(sub.submittedAt)}</td>
                  <td>{formatDate(sub.estimatedReturnDate)}</td>
                  <td>{sub.grade || '--'}</td>
                  <td>
                    <div className="grading-row-actions">
                      {nextStatus(sub.status) && (
                        <button
                          className="grading-action-btn advance"
                          onClick={() => handleAdvanceStatus(sub)}
                        >
                          {nextStatus(sub.status)}
                        </button>
                      )}
                      <button
                        className="grading-action-btn"
                        onClick={() => { setEditingSubmission(sub); setShowForm(true); }}
                      >
                        Edit
                      </button>
                      <button
                        className="grading-action-btn delete"
                        onClick={() => handleDelete(sub.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <GradingSubmissionForm
          submission={editingSubmission}
          onClose={() => { setShowForm(false); setEditingSubmission(null); }}
          onSaved={handleFormSaved}
        />
      )}

      {/* Grade Input Modal (for Complete status) */}
      {gradeModal && (
        <div className="grading-grade-modal-overlay" onClick={(e) => e.target === e.currentTarget && setGradeModal(null)}>
          <div className="grading-grade-modal">
            <h3>Complete Submission</h3>
            <label>Grade (e.g. 10, 9.5, 8)</label>
            <input
              type="text"
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="Enter grade..."
              autoFocus
            />
            <div className="grading-grade-modal-actions">
              <button onClick={() => setGradeModal(null)}>Cancel</button>
              <button className="confirm" onClick={handleCompleteWithGrade}>
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GradingTracker;
