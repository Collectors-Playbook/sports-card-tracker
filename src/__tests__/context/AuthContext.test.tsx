import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock dependencies
// NOTE: CRA sets resetMocks: true, which resets jest.fn() implementations after each test.
// We use wrapper functions in mock factories that delegate to jest.fn() variables,
// and set up .mockImplementation() in beforeEach.
const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockGetMe = jest.fn();
const mockInitializeUserCollections = jest.fn();

jest.mock('../../services/api', () => ({
  apiService: {
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    getMe: (...args: any[]) => mockGetMe(...args),
  },
}));

jest.mock('../../db/collectionsDatabase', () => ({
  collectionsDatabase: {
    initializeUserCollections: (...args: any[]) => mockInitializeUserCollections(...args),
  },
}));

const adminUser = {
  id: 'admin-001', username: 'admin', email: 'admin@sportscard.local', role: 'admin' as const,
};

// Test helper component that exposes auth context
const TestConsumer: React.FC = () => {
  const { state, login, register, logout, clearError } = useAuth();
  return (
    <div>
      <div data-testid="user">{state.user?.email || 'none'}</div>
      <div data-testid="loading">{String(state.loading)}</div>
      <div data-testid="error">{state.error || 'none'}</div>
      <button data-testid="login" onClick={() => login('admin@sportscard.local', 'admin123')}>Login</button>
      <button data-testid="login-bad" onClick={() => login('admin@sportscard.local', 'wrong').catch(() => {})}>Bad Login</button>
      <button data-testid="register" onClick={() => register('newuser', 'new@test.com', 'pass123').catch(() => {})}>Register</button>
      <button data-testid="logout" onClick={logout}>Logout</button>
      <button data-testid="clear-error" onClick={clearError}>Clear Error</button>
    </div>
  );
};

const renderAuth = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();

    mockLogin.mockImplementation(async (email: string, password: string) => {
      if (email === 'admin@sportscard.local' && password === 'admin123') {
        return { user: adminUser, token: 'jwt-token-123' };
      }
      throw new Error('Invalid email or password');
    });

    mockRegister.mockImplementation(async (username: string, email: string, _password: string) => {
      if (email === 'existing@test.com') {
        throw new Error('Email already in use');
      }
      return {
        user: { id: `user-${Date.now()}`, username, email, role: 'user' },
        token: 'jwt-token-new',
      };
    });

    mockGetMe.mockImplementation(async () => {
      return adminUser;
    });

    mockInitializeUserCollections.mockResolvedValue(undefined);
  });

  // ---- initial state ----
  describe('initial state', () => {
    it('starts with no user', () => {
      renderAuth();
      expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('restores user from token validation on mount', async () => {
      localStorage.setItem('token', 'valid-token');
      renderAuth();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('admin@sportscard.local');
      });
      expect(mockGetMe).toHaveBeenCalled();
    });

    it('logs out when stored token is invalid', async () => {
      localStorage.setItem('token', 'expired-token');
      mockGetMe.mockRejectedValueOnce(new Error('Unauthorized'));
      renderAuth();
      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
      });
    });
  });

  // ---- login ----
  describe('login', () => {
    it('logs in with valid credentials', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('admin@sportscard.local');
      });
    });

    it('stores token in localStorage after login', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login').click();
      });
      await waitFor(() => {
        expect(localStorage.getItem('token')).toBe('jwt-token-123');
      });
    });

    it('sets error for invalid credentials', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login-bad').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).not.toBe('none');
      });
    });

    it('clears user data on failed login', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login-bad').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('none');
      });
    });
  });

  // ---- register ----
  describe('register', () => {
    it('registers a new user', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('register').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).not.toBe('none');
      });
    });

    it('sets error for duplicate email', async () => {
      mockRegister.mockRejectedValueOnce(new Error('Email already in use'));
      renderAuth();
      await act(async () => {
        screen.getByTestId('register').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toContain('already in use');
      });
    });

    it('initializes collections after registration', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('register').click();
      });
      await waitFor(() => {
        expect(mockInitializeUserCollections).toHaveBeenCalled();
      });
    });
  });

  // ---- logout ----
  describe('logout', () => {
    it('clears user and token', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).not.toBe('none');
      });

      await act(async () => {
        screen.getByTestId('logout').click();
      });
      expect(screen.getByTestId('user').textContent).toBe('none');
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('removes user from localStorage', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login').click();
      });
      await waitFor(() => {
        expect(localStorage.getItem('user')).toBeTruthy();
      });
      await act(async () => {
        screen.getByTestId('logout').click();
      });
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  // ---- clearError ----
  describe('clearError', () => {
    it('clears error state', async () => {
      renderAuth();
      await act(async () => {
        screen.getByTestId('login-bad').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).not.toBe('none');
      });
      await act(async () => {
        screen.getByTestId('clear-error').click();
      });
      expect(screen.getByTestId('error').textContent).toBe('none');
    });
  });
});
