import React, { useState, useEffect, useCallback } from 'react';
import { Card, PriceAlert, PriceAlertType } from '../../types';
import apiService from '../../services/api';
import './PriceAlertModal.css';

interface PriceAlertModalProps {
  card: Card;
  onClose: () => void;
}

const PriceAlertModal: React.FC<PriceAlertModalProps> = ({ card, onClose }) => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<PriceAlertType>('above');
  const [threshold, setThreshold] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadAlerts = useCallback(async () => {
    try {
      const data = await apiService.getPriceAlertsByCard(card.id);
      setAlerts(data);
    } catch {
      setError('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [card.id]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(threshold);
    if (isNaN(value) || value <= 0) {
      setError('Enter a valid threshold amount');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiService.createPriceAlert({
        cardId: card.id,
        type,
        ...(type === 'above' ? { thresholdHigh: value } : { thresholdLow: value }),
      });
      setThreshold('');
      await loadAlerts();
    } catch {
      setError('Failed to create alert');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (alert: PriceAlert) => {
    try {
      await apiService.updatePriceAlert(alert.id, { isEnabled: !alert.isEnabled });
      await loadAlerts();
    } catch {
      setError('Failed to update alert');
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await apiService.deletePriceAlert(alertId);
      await loadAlerts();
    } catch {
      setError('Failed to delete alert');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="price-alert-modal-overlay" onClick={onClose}>
      <div className="price-alert-modal" onClick={e => e.stopPropagation()}>
        <div className="price-alert-header">
          <h3>Price Alerts</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="price-alert-card-info">
          <span className="card-name">{card.year} {card.brand} {card.player}</span>
          <span className="current-value">Current: {formatCurrency(card.currentValue)}</span>
        </div>

        <form className="price-alert-form" onSubmit={handleCreate}>
          <div className="form-row">
            <select value={type} onChange={e => setType(e.target.value as PriceAlertType)}>
              <option value="above">Alert when above</option>
              <option value="below">Alert when below</option>
            </select>
            <div className="threshold-input">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
              />
            </div>
            <button type="submit" disabled={saving}>
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>

        {error && <div className="alert-error">{error}</div>}

        <div className="alerts-list">
          {loading ? (
            <div className="loading">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="empty">No alerts configured for this card.</div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={`alert-item ${!alert.isEnabled ? 'disabled' : ''}`}>
                <div className="alert-info">
                  <span className={`alert-type ${alert.type}`}>
                    {alert.type === 'above' ? 'Above' : 'Below'}
                  </span>
                  <span className="alert-threshold">
                    {formatCurrency(alert.type === 'above' ? alert.thresholdHigh! : alert.thresholdLow!)}
                  </span>
                  {alert.triggerCount > 0 && (
                    <span className="trigger-count">
                      Triggered {alert.triggerCount}x
                    </span>
                  )}
                </div>
                <div className="alert-actions">
                  <button
                    className={`toggle-btn ${alert.isEnabled ? 'enabled' : ''}`}
                    onClick={() => handleToggle(alert)}
                    title={alert.isEnabled ? 'Disable' : 'Enable'}
                  >
                    {alert.isEnabled ? 'On' : 'Off'}
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(alert.id)}
                    title="Delete alert"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceAlertModal;
