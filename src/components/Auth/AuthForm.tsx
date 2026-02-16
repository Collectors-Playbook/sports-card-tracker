import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './AuthForm.css';

interface AuthFormProps {
  mode: 'login' | 'register';
  onToggleMode: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, onToggleMode }) => {
  const { state, login, register, clearError } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (state.error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'register' && formData.password !== formData.confirmPassword) {
      return;
    }

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await register(formData.username, formData.email, formData.password);
      }
    } catch (error) {
      // Error is handled by the auth context
    }
  };

  const isFormValid = () => {
    if (mode === 'login') {
      return formData.email && formData.password;
    } else {
      return (
        formData.username &&
        formData.email &&
        formData.password &&
        formData.confirmPassword &&
        formData.password === formData.confirmPassword
      );
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/logo.png" alt="Collectors Playbook" className="auth-logo" />
          <h1>Collectors Playbook</h1>
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={state.loading}
                placeholder="Enter your username"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={state.loading}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={state.loading}
              placeholder="Enter your password"
              minLength={6}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={state.loading}
                placeholder="Confirm your password"
                minLength={6}
              />
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <div className="field-error">Passwords do not match</div>
              )}
            </div>
          )}

          {state.error && (
            <div className="auth-error">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={state.loading || !isFormValid()}
          >
            {state.loading ? (
              <div className="auth-loading">
                <div className="spinner"></div>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </div>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" onClick={onToggleMode} className="toggle-link">
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={onToggleMode} className="toggle-link">
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;