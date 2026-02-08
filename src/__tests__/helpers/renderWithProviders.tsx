import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';

interface WrapperOptions {
  initialRoute?: string;
}

const createWrapper = (options: WrapperOptions = {}) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={[options.initialRoute || '/']}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </MemoryRouter>
  );
  return Wrapper;
};

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, 'wrapper'>
) => {
  const { initialRoute, ...renderOptions } = options || {};
  return render(ui, {
    wrapper: createWrapper({ initialRoute }),
    ...renderOptions,
  });
};
