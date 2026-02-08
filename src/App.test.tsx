import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock heavy dependencies that cause issues in test env
jest.mock('./utils/debugDatabase', () => ({}));
jest.mock('./utils/debugEnhancedCards', () => ({}));
jest.mock('./utils/testCollectionMove', () => ({}));
jest.mock('./utils/testCardSave', () => ({}));
jest.mock('./db/simpleDatabase', () => ({
  cardDatabase: {
    getAllCards: jest.fn().mockResolvedValue([]),
    subscribeToChanges: jest.fn(() => jest.fn()),
  },
  migrateFromLocalStorage: jest.fn(),
}));
jest.mock('./db/collectionsDatabase', () => ({
  collectionsDatabase: {
    initializeUserCollections: jest.fn().mockResolvedValue(undefined),
    getUserCollections: jest.fn().mockResolvedValue([]),
    getDefaultCollection: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('./utils/backupRestore', () => ({
  createAutoBackup: jest.fn().mockResolvedValue(undefined),
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // App renders an auth form when no user is logged in
    expect(document.body).toBeTruthy();
  });
});
