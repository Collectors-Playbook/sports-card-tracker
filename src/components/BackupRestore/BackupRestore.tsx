import React, { useState, useRef } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { useAuth } from '../../context/AuthContext';
import {
  downloadBackup,
  loadBackupFile,
  restoreFromBackup,
  exportBackupAsCSV,
  BackupData
} from '../../utils/backupRestore';
import './BackupRestore.css';

interface RestoreOptions {
  clearExisting: boolean;
  skipDuplicates: boolean;
}

export const BackupRestore: React.FC = () => {
  const { state } = useCards();
  const { state: authState } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupData | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    clearExisting: false,
    skipDuplicates: true
  });
  const [restoreProgress, setRestoreProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBackupDownload = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      await downloadBackup(authState.user?.username);
      setMessage({
        type: 'success',
        text: `Backup downloaded successfully (${state.cards.length} cards)`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to create backup. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCSVExport = async () => {
    setIsProcessing(true);
    setMessage(null);

    try {
      await exportBackupAsCSV();
      setMessage({
        type: 'success',
        text: `CSV backup exported successfully (${state.cards.length} cards)`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to export CSV backup. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setMessage(null);

    try {
      const backupData = await loadBackupFile(file);
      setSelectedBackup(backupData);
      setShowRestoreDialog(true);
      setMessage({
        type: 'info',
        text: `Backup file loaded: ${backupData.metadata.totalCards} cards from ${new Date(backupData.timestamp).toLocaleDateString()}`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Invalid backup file. Please select a valid backup file.'
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    setIsProcessing(true);
    setMessage(null);
    setRestoreProgress({ current: 0, total: selectedBackup.cards.length });

    try {
      const results = await restoreFromBackup(selectedBackup, {
        ...restoreOptions,
        onProgress: (current, total) => {
          setRestoreProgress({ current, total });
        }
      });

      setMessage({
        type: 'success',
        text: `Restore complete: ${results.imported} cards imported, ${results.skipped} skipped${
          results.errors.length > 0 ? `, ${results.errors.length} errors` : ''
        }`
      });

      setShowRestoreDialog(false);
      setSelectedBackup(null);

      // Reload the page to refresh the card list
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to restore backup. Please try again.'
      });
    } finally {
      setIsProcessing(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="backup-restore">
      <h2>Backup & Restore</h2>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="backup-stats">
        <div className="stat">
          <span className="label">Total Cards:</span>
          <span className="value">{state.cards.length}</span>
        </div>
        <div className="stat">
          <span className="label">Total Value:</span>
          <span className="value">
            ${state.cards.reduce((sum, card) => sum + card.currentValue, 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="backup-actions">
        <h3>Create Backup</h3>
        <div className="action-buttons">
          <button
            onClick={handleBackupDownload}
            disabled={isProcessing || state.cards.length === 0}
            className="backup-btn"
          >
            Download JSON Backup
          </button>

          <button
            onClick={handleCSVExport}
            disabled={isProcessing || state.cards.length === 0}
            className="backup-btn csv"
          >
            Export as CSV
          </button>
        </div>
      </div>

      <div className="restore-actions">
        <h3>Restore Backup</h3>
        <div className="action-buttons">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="restore-btn"
          >
            Upload Backup File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {showRestoreDialog && selectedBackup && (
        <div className="restore-dialog-overlay">
          <div className="restore-dialog">
            <h3>Restore Backup</h3>

            <div className="backup-details">
              <p><strong>Backup Date:</strong> {new Date(selectedBackup.timestamp).toLocaleString()}</p>
              <p><strong>Cards:</strong> {selectedBackup.metadata.totalCards}</p>
              <p><strong>Total Value:</strong> ${selectedBackup.metadata.totalValue.toLocaleString()}</p>
              {selectedBackup.metadata.exportedBy && (
                <p><strong>Exported By:</strong> {selectedBackup.metadata.exportedBy}</p>
              )}
            </div>

            <div className="restore-options">
              <h4>Restore Options</h4>

              <label className="option">
                <input
                  type="checkbox"
                  checked={restoreOptions.clearExisting}
                  onChange={(e) => setRestoreOptions({
                    ...restoreOptions,
                    clearExisting: e.target.checked,
                    skipDuplicates: e.target.checked ? false : restoreOptions.skipDuplicates
                  })}
                />
                <span>Clear existing cards before restore</span>
                <small>Warning: This will delete all current cards!</small>
              </label>

              <label className="option">
                <input
                  type="checkbox"
                  checked={restoreOptions.skipDuplicates}
                  onChange={(e) => setRestoreOptions({
                    ...restoreOptions,
                    skipDuplicates: e.target.checked
                  })}
                  disabled={restoreOptions.clearExisting}
                />
                <span>Skip duplicate cards</span>
                <small>Cards with existing IDs will be skipped</small>
              </label>
            </div>

            {restoreProgress && (
              <div className="restore-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(restoreProgress.current / restoreProgress.total) * 100}%` }}
                  />
                </div>
                <span className="progress-text">
                  {restoreProgress.current} / {restoreProgress.total} cards
                </span>
              </div>
            )}

            <div className="dialog-actions">
              <button
                onClick={handleRestore}
                disabled={isProcessing}
                className="confirm-btn"
              >
                {isProcessing ? 'Restoring...' : 'Restore'}
              </button>

              <button
                onClick={() => {
                  setShowRestoreDialog(false);
                  setSelectedBackup(null);
                }}
                disabled={isProcessing}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
