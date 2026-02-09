// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// ---- structuredClone polyfill for fake-indexeddb ----
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));
}

// ---- localStorage / sessionStorage mock (resettable) ----
// Uses plain functions (NOT jest.fn) so that jest.restoreAllMocks() does not wipe them.
const createStorageMock = (): Storage => {
  let store: Record<string, string> = {};
  const mock: Storage = {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = String(value); },
    removeItem(key: string) { delete store[key]; },
    clear() { store = {}; },
    get length() { return Object.keys(store).length; },
    key(index: number) { return Object.keys(store)[index] ?? null; },
  };
  return mock;
};

Object.defineProperty(window, 'localStorage', { value: createStorageMock() });
Object.defineProperty(window, 'sessionStorage', { value: createStorageMock() });

// ---- URL mocks (not using jest.fn so restoreAllMocks doesn't undo them) ----
URL.createObjectURL = (_obj: Blob | MediaSource) => 'blob:mock-url';
URL.revokeObjectURL = (_url: string) => {};

// ---- Canvas mocks ----
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  drawImage: jest.fn(),
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  translate: jest.fn(),
  transform: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  fillText: jest.fn(),
  strokeText: jest.fn(),
  font: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  canvas: document.createElement('canvas'),
})) as any;

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');

// ---- Global fetch mock ----
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response)
);

// ---- Suppress console.log in tests (keep warn/error) ----
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});
afterAll(() => {
  console.log = originalConsoleLog;
});

// Reset mocks between tests
afterEach(() => {
  // NOTE: We intentionally do NOT call jest.restoreAllMocks() globally because it
  // resets jest.fn() implementations created in jest.mock() factories, breaking
  // module-level mocks across tests. Tests that use jest.spyOn() should call
  // mockRestore() in their own afterEach.
  localStorage.clear();
  sessionStorage.clear();
  (fetch as jest.Mock).mockClear();
});
