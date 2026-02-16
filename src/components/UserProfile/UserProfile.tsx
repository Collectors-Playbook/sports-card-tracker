import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import './UserProfile.css';

const UserProfile: React.FC = () => {
  const { state: authState, logout, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    email: authState.user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [profilePhoto, setProfilePhoto] = useState<string | null>(
    authState.user?.profilePhoto || null
  );
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear messages when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }

      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        setError('Image must be less than 100MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setPreviewPhoto(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate password confirmation
      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match');
        setLoading(false);
        return;
      }

      if (!authState.user) {
        throw new Error('User not found');
      }

      const updateData: {
        email?: string;
        currentPassword?: string;
        newPassword?: string;
        profilePhoto?: string | null;
      } = {
        email: formData.email,
        profilePhoto: previewPhoto !== null ? previewPhoto : profilePhoto,
      };

      // Only include password fields if user is changing password
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          setError('Current password is required to change password');
          setLoading(false);
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      // Update profile via backend API
      const updatedUser = await apiService.updateProfile(updateData);

      // Update auth context with new user data
      updateUser({
        ...authState.user,
        email: updatedUser.email,
        profilePhoto: updatedUser.profilePhoto,
      });
      
      // Update profile photo state
      if (previewPhoto) {
        setProfilePhoto(previewPhoto);
        setPreviewPhoto(null);
      }

      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));

      setSuccess('Profile updated successfully!');
      setIsEditing(false);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      email: authState.user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPreviewPhoto(null);
    setError(null);
    setSuccess(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerPhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = () => {
    setProfilePhoto(null);
    setPreviewPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayPhoto = previewPhoto || profilePhoto;

  return (
    <div className="user-profile">
      <div className="profile-header">
        <div className="breadcrumb">
          <span className="breadcrumb-item">Sports Card Tracker</span>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-item current">Profile</span>
        </div>
        <h1>User Profile</h1>
        <p>Manage your account settings and preferences</p>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-photo-section">
            <div className="photo-container">
              {displayPhoto ? (
                <img src={displayPhoto} alt="Profile" className="profile-photo" />
              ) : (
                <div className="default-avatar">
                  <span>{authState.user?.username?.charAt(0).toUpperCase()}</span>
                </div>
              )}
              
              {isEditing && (
                <div className="photo-controls">
                  <button type="button" onClick={triggerPhotoUpload} className="photo-btn upload">
                    📷 Upload
                  </button>
                  {displayPhoto && (
                    <button type="button" onClick={removePhoto} className="photo-btn remove">
                      🗑️ Remove
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            <div className="form-section">
              <h3>Account Information</h3>
              
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={authState.user?.username || ''}
                  disabled
                  className="form-input disabled"
                />
                <small className="form-help">Username cannot be changed</small>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing || loading}
                  className={`form-input ${!isEditing ? 'disabled' : ''}`}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Role</label>
                <input
                  type="text"
                  id="role"
                  value={authState.user?.role || ''}
                  disabled
                  className="form-input disabled role-badge"
                />
              </div>
            </div>

            {isEditing && (
              <div className="form-section">
                <h3>Change Password</h3>
                <p className="section-help">Leave blank to keep current password</p>
                
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    type="password"
                    id="currentPassword"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="form-input"
                    placeholder="Enter current password to change"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="form-input"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="form-input"
                    placeholder="Confirm new password"
                    minLength={6}
                  />
                  {formData.newPassword && formData.confirmPassword && 
                   formData.newPassword !== formData.confirmPassword && (
                    <div className="field-error">Passwords do not match</div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            {success && (
              <div className="form-success">
                {success}
              </div>
            )}

            <div className="form-actions">
              {!isEditing ? (
                <button type="button" onClick={() => setIsEditing(true)} className="btn-primary">
                  Edit Profile
                </button>
              ) : (
                <div className="action-buttons">
                  <button type="button" onClick={handleCancel} className="btn-secondary" disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                      <div className="loading-inline">
                        <div className="spinner-small"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <p>Use the navigation menu above to access other sections</p>
          <div className="action-info">
            <div className="info-item">
              <span className="info-icon">📊</span>
              <span>Dashboard - View your collection overview and statistics</span>
            </div>
            <div className="info-item">
              <span className="info-icon">📋</span>
              <span>Inventory - Browse and manage your card collection</span>
            </div>
            <div className="info-item">
              <span className="info-icon">➕</span>
              <span>Add Card - Add new cards to your collection</span>
            </div>
            {authState.user?.role === 'admin' && (
              <div className="info-item">
                <span className="info-icon">🔧</span>
                <span>Admin - Manage users and system settings</span>
              </div>
            )}
          </div>
        </div>

        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <p>Irreversible actions</p>
          <button onClick={logout} className="btn-danger">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;