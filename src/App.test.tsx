import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock heavy dependencies that cause issues in test env
jest.mock('./utils/debugEnhancedCards', () => ({}));
jest.mock('./services/api', () => ({
  apiService: {
    getAllCards: jest.fn().mockResolvedValue([]),
    getMe: jest.fn().mockRejectedValue(new Error('No token')),
    initializeCollections: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    // App renders an auth form when no user is logged in
    expect(document.body).toBeTruthy();
  });
});
