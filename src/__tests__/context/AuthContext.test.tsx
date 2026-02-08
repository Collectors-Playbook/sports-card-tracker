import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock dependencies
// NOTE: CRA sets resetMocks: true, which resets jest.fn() implementations after each test.
// We use __esModule + getter pattern so the mock functions are re-created on each access,
// or we set up implementations in beforeEach.
const mockUsers = new Map<string, any>();
const resetMockUsers = () => {
  mockUsers.clear();
  mockUsers.set('admin-001', {
    id: 'admin-001', username: 'admin', email: 'admin@sportscard.local',
    role: 'admin', isActive: true, password: 'admin123',
    createdAt: new Date(), updatedAt: new Date(),
  });
};

const mockAuthenticateUser = jest.fn();
const mockGetAllUsers = jest.fn();
const mockCreateUser = jest.fn();
const mockInitializeUserCollections = jest.fn();

jest.mock('../../services/userService', () => ({
  userService: {
    authenticateUser: (...args: any[]) => mockAuthenticateUser(...args),
    getAllUsers: (...args: any[]) => mockGetAllUsers(...args),
    createUser: (...args: any[]) => mockCreateUser(...args),
  },
}));

jest.mock('../../db/collectionsDatabase', () => ({
  collectionsDatabase: {
    initializeUserCollections: (...args: any[]) => mockInitializeUserCollections(...args),
  },
}));

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
      <button data-testid="register" onClick={() => register('newuser', 'new@test.com', 'pass').catch(() => {})}>Register</button>
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
    resetMockUsers();

    mockAuthenticateUser.mockImplementation((email: string, password: string) => {
      const user = Array.from(mockUsers.values()).find(
        (u: any) => u.email === email && u.password === password && u.isActive
      );
      return user ? { ...user, password: undefined } : null;
    });

    mockGetAllUsers.mockImplementation(() =>
      Array.from(mockUsers.values()).map((u: any) => ({ ...u, password: undefined }))
    );

    mockCreateUser.mockImplementation((data: any) => {
      const newUser = { ...data, id: `user-${Date.now()}`, createdAt: new Date(), updatedAt: new Date() };
      mockUsers.set(newUser.id, newUser);
      return { ...newUser, password: undefined };
    });

    mockInitializeUserCollections.mockResolvedValue(undefined);
  });

  // ---- initial state ----
  describe('initial state', () => {
    it('starts with no user', () => {
      renderAuth();
      expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('restores user from localStorage on mount', () => {
      localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'stored@test.com', username: 'stored', role: 'user' }));
      localStorage.setItem('token', 'some-token');
      renderAuth();
      expect(screen.getByTestId('user').textContent).toBe('stored@test.com');
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
        expect(localStorage.getItem('token')).toBeTruthy();
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
      mockGetAllUsers.mockReturnValueOnce([{ email: 'new@test.com' }]);
      renderAuth();
      await act(async () => {
        screen.getByTestId('register').click();
      });
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toContain('already registered');
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
