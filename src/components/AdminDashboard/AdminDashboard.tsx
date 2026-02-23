import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCards } from '../../context/ApiCardContext';
import { apiService } from '../../services/api';
import './AdminDashboard.css';

interface AdminStats {
  totalCards: number;
  totalUsers: number;
  totalValue: number;
  averageCardValue: number;
  mostValuableCard: string;
  totalBackups: number;
  lastBackupDate: string | null;
  categoriesBreakdown: { [key: string]: number };
  yearBreakdown: { [key: string]: number };
}

interface UserStats {
  userId: string;
  username: string;
  cardCount: number;
  totalValue: number;
  avgValue: number;
}

interface BackupInfo {
  id?: number;
  timestamp: string;
  type: 'auto' | 'manual';
  sizeInMB: number;
  totalCards: number;
  totalValue: number;
  userName?: string;
}

const AdminDashboard: React.FC = () => {
  const { state: authState } = useAuth();
  const { state: cardState, clearAllCards } = useCards();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authState.user?.role !== 'admin') {
      setError('Admin access required');
      setLoading(false);
      return;
    }

    calculateStats();
  }, [authState.user, cardState.cards]);

  const calculateStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all cards from API
      const allCards = await apiService.getAllCards();

      // Calculate statistics
      const totalCards = allCards.length;
      const totalUsers = new Set(allCards.map(card => card.userId)).size;
      const totalValue = allCards.reduce((sum, card) => sum + card.currentValue, 0);
      const averageCardValue = totalCards > 0 ? totalValue / totalCards : 0;

      // Find most valuable card
      const mostValuableCard = allCards.reduce((prev, current) =>
        current.currentValue > (prev?.currentValue || 0) ? current : prev
      , allCards[0]);

      // Category breakdown
      const categoriesBreakdown: { [key: string]: number } = {};
      allCards.forEach(card => {
        categoriesBreakdown[card.category] = (categoriesBreakdown[card.category] || 0) + 1;
      });

      // Year breakdown
      const yearBreakdown: { [key: string]: number } = {};
      allCards.forEach(card => {
        yearBreakdown[card.year] = (yearBreakdown[card.year] || 0) + 1;
      });

      // User stats computed from cards
      const userStatsMap: { [userId: string]: { count: number; value: number } } = {};
      allCards.forEach(card => {
        if (!userStatsMap[card.userId]) {
          userStatsMap[card.userId] = { count: 0, value: 0 };
        }
        userStatsMap[card.userId].count++;
        userStatsMap[card.userId].value += card.currentValue;
      });

      const userStatistics: UserStats[] = Object.entries(userStatsMap).map(([userId, stats]) => ({
        userId,
        username: userId,
        cardCount: stats.count,
        totalValue: stats.value,
        avgValue: stats.count > 0 ? stats.value / stats.count : 0
      }));

      setStats({
        totalCards,
        totalUsers,
        totalValue,
        averageCardValue,
        mostValuableCard: mostValuableCard ? `${mostValuableCard.player} (${mostValuableCard.year})` : 'N/A',
        totalBackups: 0,
        lastBackupDate: null,
        categoriesBreakdown,
        yearBreakdown
      });

      setUserStats(userStatistics);
      setBackups([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate stats');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    try {
      const allCards = await apiService.getAllCards();
      const cardsToDelete = selectedUserId
        ? allCards.filter(card => card.userId === selectedUserId)
        : allCards;

      for (const card of cardsToDelete) {
        await apiService.deleteCard(card.id);
      }
      setShowClearConfirm(false);
      setSelectedUserId(null);
      calculateStats();
    } catch (error) {
      setError('Failed to clear database');
    }
  };

  const exportDatabaseInfo = () => {
    const dbInfo = {
      appVersion: '1.0.0',
      databaseType: 'SQLite (Server)',
      timestamp: new Date().toISOString(),
      stats,
      userStats,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };

    const json = JSON.stringify(dbInfo, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-database-info-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authState.user?.role !== 'admin') {
    return (
      <div className="admin-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">
          <p>Loading admin data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={calculateStats}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <h1>🔧 Admin Dashboard</h1>

      {stats && (
        <>
          <div className="admin-stats">
            <div className="stat-card">
              <h3>Total Users</h3>
              <p className="stat-value">{stats.totalUsers.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Total Cards</h3>
              <p className="stat-value">{stats.totalCards.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Total Value</h3>
              <p className="stat-value">${stats.totalValue.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <h3>Average Card Value</h3>
              <p className="stat-value">${stats.averageCardValue.toFixed(2)}</p>
            </div>
          </div>

          <div className="admin-section">
            <h2>👥 User Statistics</h2>
            <div className="user-stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Cards</th>
                    <th>Total Value</th>
                    <th>Avg Value</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userStats.map(user => (
                    <tr key={user.userId}>
                      <td>{user.username}</td>
                      <td>{user.cardCount.toLocaleString()}</td>
                      <td>${user.totalValue.toLocaleString()}</td>
                      <td>${user.avgValue.toFixed(2)}</td>
                      <td>
                        <button 
                          className="clear-user-btn"
                          onClick={() => {
                            setSelectedUserId(user.userId);
                            setShowClearConfirm(true);
                          }}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-section">
            <h2>📊 Category Breakdown (All Users)</h2>
            <div className="breakdown-grid">
              {Object.entries(stats.categoriesBreakdown).map(([category, count]) => (
                <div key={category} className="breakdown-item">
                  <span className="category">{category}</span>
                  <span className="count">{count} cards</span>
                  <span className="percentage">
                    {((count / stats.totalCards) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-section">
            <h2>📅 Year Distribution (All Users)</h2>
            <div className="year-chart">
              {Object.entries(stats.yearBreakdown)
                .sort(([a], [b]) => Number(b) - Number(a))
                .slice(0, 10)
                .map(([year, count]) => (
                  <div key={year} className="year-bar">
                    <span className="year-label">{year}</span>
                    <div className="bar-container">
                      <div 
                        className="bar" 
                        style={{ width: `${(count / stats.totalCards) * 100}%` }}
                      />
                    </div>
                    <span className="year-count">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="admin-section">
            <h2>💾 Backup & Restore</h2>
            {backups.length === 0 ? (
              <div className="backup-info">
                <p>No backups found</p>
              </div>
            ) : (
              <div className="backup-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>User</th>
                      <th>Cards</th>
                      <th>Total Value</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup, index) => (
                      <tr key={backup.id || index}>
                        <td>{new Date(backup.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`backup-type ${backup.type}`}>
                            {backup.type === 'auto' ? '🔄 Auto' : '📦 Manual'}
                          </span>
                        </td>
                        <td>{backup.userName || 'Unknown'}</td>
                        <td>{backup.totalCards.toLocaleString()}</td>
                        <td>${backup.totalValue.toLocaleString()}</td>
                        <td>{backup.sizeInMB.toFixed(2)} MB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="backup-summary">
                  <p><strong>Total Backups:</strong> {stats.totalBackups}</p>
                  <p><strong>Total Size:</strong> {backups.reduce((sum, b) => sum + b.sizeInMB, 0).toFixed(2)} MB</p>
                </div>
              </div>
            )}
          </div>

          <div className="admin-section">
            <h2>⚙️ Database Management</h2>
            <div className="admin-actions">
              <button 
                onClick={exportDatabaseInfo}
                className="admin-btn export"
              >
                📊 Export Database Info
              </button>
              
              <button 
                onClick={() => {
                  setSelectedUserId(null);
                  setShowClearConfirm(true);
                }}
                className="admin-btn danger"
              >
                🗑️ Clear All Data
              </button>
            </div>
          </div>

          <div className="admin-section">
            <h2>ℹ️ System Information</h2>
            <div className="system-info">
              <p><strong>App Version:</strong> 1.0.0</p>
              <p><strong>Database:</strong> SQLite (Server)</p>
              <p><strong>Browser:</strong> {navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
              <p><strong>Platform:</strong> {navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Win') ? 'Windows' : navigator.userAgent.includes('Linux') ? 'Linux' : 'Unknown'}</p>
              <p><strong>Language:</strong> {navigator.language}</p>
              <p><strong>Current User:</strong> {authState.user?.username} ({authState.user?.email})</p>
              <p><strong>Current User ID:</strong> {authState.user?.id}</p>
            </div>
          </div>
        </>
      )}

      {showClearConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <h3>⚠️ Clear {selectedUserId ? `User ${selectedUserId}'s` : 'All'} Data?</h3>
            <p>
              This will permanently delete {selectedUserId ? `all cards for user ${selectedUserId}` : 'all cards from all users'}. 
              This action cannot be undone!
            </p>
            <p><strong>Are you absolutely sure?</strong></p>
            <div className="dialog-actions">
              <button 
                onClick={handleClearDatabase}
                className="btn-confirm-danger"
              >
                Yes, Delete {selectedUserId ? 'User Data' : 'Everything'}
              </button>
              <button 
                onClick={() => {
                  setShowClearConfirm(false);
                  setSelectedUserId(null);
                }}
                className="btn-cancel"
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

export default AdminDashboard;