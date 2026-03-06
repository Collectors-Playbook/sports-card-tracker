import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PriceAlertHistoryEntry } from '../../types';
import apiService from '../../services/api';
import { useSSE } from '../../hooks/useSSE';
import './AlertNotifications.css';

const AlertNotifications: React.FC = () => {
  const [history, setHistory] = useState<(PriceAlertHistoryEntry & { player: string })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);
  const sse = useSSE(true);

  const loadHistory = useCallback(async () => {
    try {
      const data = await apiService.getPriceAlertHistory();
      setHistory(data);

      const lastSeen = lastSeenRef.current || localStorage.getItem('lastSeenAlert');
      if (lastSeen) {
        const unread = data.filter(h => h.createdAt > lastSeen).length;
        setUnreadCount(unread);
      } else if (data.length > 0) {
        setUnreadCount(data.length);
      }
    } catch {
      // Silently fail — alerts are non-critical
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const unsub = sse.on('price-alert', () => {
      loadHistory();
    });
    return unsub;
  }, [sse, loadHistory]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && history.length > 0) {
      const latest = history[0].createdAt;
      lastSeenRef.current = latest;
      localStorage.setItem('lastSeenAlert', latest);
      setUnreadCount(0);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={ref} className="alert-notifications">
      <button className="alert-bell" onClick={handleOpen} title="Price Alerts">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="alert-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="alert-dropdown">
          <div className="alert-dropdown-header">
            <span>Price Alerts</span>
          </div>
          <div className="alert-dropdown-list">
            {history.length === 0 ? (
              <div className="alert-empty">No alert history yet.</div>
            ) : (
              history.slice(0, 20).map(entry => (
                <div key={entry.id} className="alert-history-item">
                  <div className="alert-history-info">
                    <span className="alert-history-player">{entry.player}</span>
                    <span className={`alert-history-type ${entry.type}`}>
                      {entry.type === 'above' ? 'rose above' : 'dropped below'} {formatCurrency(entry.threshold)}
                    </span>
                    <span className="alert-history-value">
                      Now: {formatCurrency(entry.currentValue)}
                    </span>
                  </div>
                  <span className="alert-history-time">{timeAgo(entry.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertNotifications;
