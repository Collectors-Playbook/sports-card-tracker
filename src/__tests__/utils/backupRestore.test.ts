import { createCard, createSoldCard, createGradedCard } from '../helpers/factories';
import { Card } from '../../types';

// Delegation mocks for CRA resetMocks compatibility
const mockGetAllCards = jest.fn();
const mockCreateCard = jest.fn();
const mockDeleteCard = jest.fn();

jest.mock('../../services/api', () => ({
  apiService: {
    getAllCards: (...args: any[]) => mockGetAllCards(...args),
    createCard: (...args: any[]) => mockCreateCard(...args),
    deleteCard: (...args: any[]) => mockDeleteCard(...args),
  },
}));

import {
  createBackup,
  downloadBackup,
  restoreFromBackup,
  loadBackupFile,
  exportBackupAsCSV,
  createAutoBackup,
  getAutoBackups,
  clearAutoBackup,
  getAutoBackupSize,
  BackupData,
} from '../../utils/backupRestore';

beforeEach(() => {
  mockGetAllCards.mockResolvedValue([createCard(), createGradedCard()]);
  mockCreateCard.mockResolvedValue(undefined);
  mockDeleteCard.mockResolvedValue(undefined);
});

describe('createBackup', () => {
  it('fetches cards and returns backup structure', async () => {
    const backup = await createBackup('test-user');
    expect(backup.version).toBe('2.0');
    expect(backup.appName).toBe('Sports Card Tracker');
    expect(backup.cards).toHaveLength(2);
    expect(backup.metadata.totalCards).toBe(2);
    expect(backup.metadata.exportedBy).toBe('test-user');
  });

  it('calculates total value from cards', async () => {
    mockGetAllCards.mockResolvedValue([
      createCard({ currentValue: 100 }),
      createCard({ currentValue: 200 }),
    ]);
    const backup = await createBackup();
    expect(backup.metadata.totalValue).toBe(300);
  });

  it('reads user info from localStorage', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'collector' }));
    const backup = await createBackup();
    expect(backup.userId).toBe('u1');
    expect(backup.metadata.userName).toBe('collector');
  });

  it('uses anonymous when no user in localStorage', async () => {
    const backup = await createBackup();
    expect(backup.userId).toBe('anonymous');
  });

  it('throws on API error', async () => {
    mockGetAllCards.mockRejectedValue(new Error('Network error'));
    await expect(createBackup()).rejects.toThrow('Failed to create backup');
  });
});

describe('downloadBackup', () => {
  let mockClick: jest.Mock;
  let mockAppendChild: jest.SpyInstance;
  let mockRemoveChild: jest.SpyInstance;

  beforeEach(() => {
    mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLElement);
    mockAppendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    mockRemoveChild = jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('triggers file download', async () => {
    await downloadBackup();
    expect(mockClick).toHaveBeenCalled();
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('propagates errors', async () => {
    mockGetAllCards.mockRejectedValue(new Error('fail'));
    await expect(downloadBackup()).rejects.toThrow();
  });
});

describe('restoreFromBackup', () => {
  const makeBackup = (cards: Card[]): BackupData => ({
    version: '2.0',
    timestamp: new Date().toISOString(),
    appName: 'Sports Card Tracker',
    userId: 'user-1',
    cards,
    metadata: {
      totalCards: cards.length,
      totalValue: cards.reduce((s, c) => s + c.currentValue, 0),
    },
  });

  it('imports cards from backup', async () => {
    const backup = makeBackup([createCard(), createCard()]);
    mockGetAllCards.mockResolvedValue([]);
    const result = await restoreFromBackup(backup);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(mockCreateCard).toHaveBeenCalledTimes(2);
  });

  it('skips duplicates by default', async () => {
    const existingCard = createCard({ id: 'dup-1' });
    mockGetAllCards.mockResolvedValue([existingCard]);
    const backup = makeBackup([createCard({ id: 'dup-1' }), createCard({ id: 'new-1' })]);

    const result = await restoreFromBackup(backup);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('clears existing cards when clearExisting is true', async () => {
    const existingCards = [createCard(), createCard()];
    mockGetAllCards.mockResolvedValue(existingCards);

    const backup = makeBackup([createCard()]);
    await restoreFromBackup(backup, { clearExisting: true });

    expect(mockDeleteCard).toHaveBeenCalledTimes(2);
  });

  it('calls onProgress callback', async () => {
    mockGetAllCards.mockResolvedValue([]);
    const backup = makeBackup([createCard(), createCard()]);
    const onProgress = jest.fn();

    await restoreFromBackup(backup, { onProgress });
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
  });

  it('records errors for individual card failures', async () => {
    mockGetAllCards.mockResolvedValue([]);
    mockCreateCard.mockRejectedValueOnce(new Error('bad card')).mockResolvedValue(undefined);

    const backup = makeBackup([createCard({ player: 'BadCard' }), createCard()]);
    const result = await restoreFromBackup(backup);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('BadCard');
  });

  it('converts string dates to Date objects', async () => {
    mockGetAllCards.mockResolvedValue([]);
    const card = createCard();
    // Simulate dates as strings (how JSON parse would return them)
    const cardWithStringDates = {
      ...card,
      purchaseDate: '2023-06-15T00:00:00.000Z',
      createdAt: '2023-06-15T00:00:00.000Z',
      updatedAt: '2023-06-15T00:00:00.000Z',
    } as unknown as Card;

    const backup = makeBackup([cardWithStringDates]);
    await restoreFromBackup(backup);

    const importedCard = mockCreateCard.mock.calls[0][0];
    expect(importedCard.purchaseDate).toBeInstanceOf(Date);
    expect(importedCard.createdAt).toBeInstanceOf(Date);
  });
});

describe('loadBackupFile', () => {
  it('resolves with parsed backup data for valid file', async () => {
    const backup: BackupData = {
      version: '2.0',
      timestamp: new Date().toISOString(),
      appName: 'Sports Card Tracker',
      userId: 'user-1',
      cards: [createCard()],
      metadata: { totalCards: 1, totalValue: 75 },
    };
    const json = JSON.stringify(backup);
    const file = new File([json], 'backup.json', { type: 'application/json' });

    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const promise = loadBackupFile(file);
    mockFileReader.onload!({ target: { result: json } });

    const result = await promise;
    expect(result.version).toBe('2.0');
    expect(result.cards).toHaveLength(1);
  });

  it('rejects for invalid backup structure', async () => {
    const file = new File(['{}'], 'bad.json');
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const promise = loadBackupFile(file);
    mockFileReader.onload!({ target: { result: '{}' } });

    await expect(promise).rejects.toThrow('Invalid backup file format');
  });

  it('rejects for invalid JSON', async () => {
    const file = new File(['not-json'], 'bad.json');
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const promise = loadBackupFile(file);
    mockFileReader.onload!({ target: { result: 'not-json' } });

    await expect(promise).rejects.toThrow('Failed to parse backup file');
  });

  it('rejects on FileReader error', async () => {
    const file = new File(['data'], 'backup.json');
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null as any,
      onerror: null as any,
    };
    jest.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    const promise = loadBackupFile(file);
    mockFileReader.onerror!();

    await expect(promise).rejects.toThrow('Failed to read backup file');
  });
});

describe('exportBackupAsCSV', () => {
  let mockClick: jest.Mock;

  beforeEach(() => {
    mockClick = jest.fn();
    jest.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLElement);
    jest.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n) => n);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports cards as CSV download', async () => {
    mockGetAllCards.mockResolvedValue([createCard()]);
    await exportBackupAsCSV();
    expect(mockClick).toHaveBeenCalled();
  });

  it('throws when no cards to export', async () => {
    mockGetAllCards.mockResolvedValue([]);
    await expect(exportBackupAsCSV()).rejects.toThrow('No cards to export');
  });

  it('propagates API errors', async () => {
    mockGetAllCards.mockRejectedValue(new Error('API fail'));
    await expect(exportBackupAsCSV()).rejects.toThrow();
  });
});

describe('no-op stubs', () => {
  it('createAutoBackup resolves', async () => {
    await expect(createAutoBackup()).resolves.toBeUndefined();
  });

  it('getAutoBackups returns empty array', async () => {
    const result = await getAutoBackups();
    expect(result).toEqual([]);
  });

  it('clearAutoBackup resolves', async () => {
    await expect(clearAutoBackup()).resolves.toBeUndefined();
  });

  it('getAutoBackupSize returns zero', async () => {
    const result = await getAutoBackupSize();
    expect(result).toEqual({ sizeInMB: 0, exists: false });
  });
});
