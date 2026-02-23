import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService, UserData } from '../../services/userService';
import { apiService } from '../../services/api';
import './UserManagement.css';

interface EditingUser {
  id: string;
  field: 'username' | 'email' | 'password';
  value: string;
}

const UserManagement: React.FC = () => {
  const { state: authState } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [userStats, setUserStats] = useState<{ [userId: string]: { cardCount: number; totalValue: number } }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  });

  // Check if current user is admin
  const isAdmin = authState.user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = userService.getAllUsers();
      setUsers(allUsers);

      // Compute card statistics from API cards
      const allCards = await apiService.getAllCards();
      const stats: { [userId: string]: { cardCount: number; totalValue: number } } = {};
      allCards.forEach(card => {
        if (!stats[card.userId]) {
          stats[card.userId] = { cardCount: 0, totalValue: 0 };
        }
        stats[card.userId].cardCount++;
        stats[card.userId].totalValue += card.currentValue;
      });

      setUserStats(stats);
    } catch (err) {
      setError('Failed to load users');
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!editingUser || editingUser.id !== userId) return;

    try {
      const updates: Partial<UserData> = {
        [editingUser.field]: editingUser.value
      };

      if (editingUser.field === 'password') {
        userService.resetUserPassword(userId, editingUser.value);
      } else {
        userService.updateUser(userId, updates);
      }

      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      userService.toggleUserStatus(userId);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle user status');
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      userService.changeUserRole(userId, newRole);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? Their cards will be preserved.')) {
      return;
    }

    try {
      userService.deleteUser(userId);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      userService.createUser({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        isActive: true
      });
      
      setShowNewUserForm(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        role: 'user'
      });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  if (!isAdmin) {
    return (
      <div className="user-management">
        <div className="access-denied">
          <h2>🚫 Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-management">
        <div className="loading">
          <h2>Loading users...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h1>👥 User Management</h1>
        <button 
          className="add-user-btn"
          onClick={() => setShowNewUserForm(true)}
        >
          ➕ Add New User
        </button>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="dismiss-btn">✕</button>
        </div>
      )}

      {showNewUserForm && (
        <div className="new-user-form-overlay">
          <div className="new-user-form">
            <h2>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'user' })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowNewUserForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Cards</th>
              <th>Total Value</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={!user.isActive ? 'disabled' : ''}>
                <td>
                  <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? '✅ Active' : '❌ Inactive'}
                  </span>
                </td>
                <td>
                  {editingUser?.id === user.id && editingUser.field === 'username' ? (
                    <input
                      type="text"
                      value={editingUser.value}
                      onChange={(e) => setEditingUser({ ...editingUser, value: e.target.value })}
                      onBlur={() => handleUpdateUser(user.id)}
                      onKeyPress={(e) => e.key === 'Enter' && handleUpdateUser(user.id)}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="editable"
                      onClick={() => setEditingUser({ id: user.id, field: 'username', value: user.username })}
                    >
                      {user.username}
                    </span>
                  )}
                </td>
                <td>
                  {editingUser?.id === user.id && editingUser.field === 'email' ? (
                    <input
                      type="email"
                      value={editingUser.value}
                      onChange={(e) => setEditingUser({ ...editingUser, value: e.target.value })}
                      onBlur={() => handleUpdateUser(user.id)}
                      onKeyPress={(e) => e.key === 'Enter' && handleUpdateUser(user.id)}
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="editable"
                      onClick={() => setEditingUser({ id: user.id, field: 'email', value: user.email })}
                    >
                      {user.email}
                    </span>
                  )}
                </td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeUserRole(user.id, e.target.value as 'admin' | 'user')}
                    className="role-select"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{userStats[user.id]?.cardCount || 0}</td>
                <td>${(userStats[user.id]?.totalValue || 0).toFixed(2)}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn"
                      onClick={() => setEditingUser({ id: user.id, field: 'password', value: '' })}
                      title="Reset Password"
                    >
                      🔑
                    </button>
                    <button
                      className={`action-btn ${user.isActive ? 'disable' : 'enable'}`}
                      onClick={() => handleToggleUserStatus(user.id)}
                      title={user.isActive ? 'Disable User' : 'Enable User'}
                    >
                      {user.isActive ? '🚫' : '✅'}
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteUser(user.id)}
                      title="Delete User"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser?.field === 'password' && (
        <div className="password-reset-overlay">
          <div className="password-reset-form">
            <h3>Reset Password</h3>
            <p>Enter new password for user</p>
            <input
              type="password"
              placeholder="New password"
              value={editingUser.value}
              onChange={(e) => setEditingUser({ ...editingUser, value: e.target.value })}
              autoFocus
            />
            <div className="form-actions">
              <button onClick={() => setEditingUser(null)}>Cancel</button>
              <button 
                onClick={() => handleUpdateUser(editingUser.id)}
                disabled={!editingUser.value}
                className="primary"
              >
                Set Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;