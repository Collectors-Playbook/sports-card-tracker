import { createCard, createSoldCard, createGradedCard } from '../helpers/factories';

// jsPDF mock
const mockSave = jest.fn();
const mockText = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetFont = jest.fn();
const mockAddPage = jest.fn();
const mockSetPage = jest.fn();
const mockSplitTextToSize = jest.fn();

const mockDoc = {
  setFontSize: (...args: any[]) => mockSetFontSize(...args),
  setFont: (...args: any[]) => mockSetFont(...args),
  text: (...args: any[]) => mockText(...args),
  save: (...args: any[]) => mockSave(...args),
  addPage: (...args: any[]) => mockAddPage(...args),
  setPage: (...args: any[]) => mockSetPage(...args),
  splitTextToSize: (...args: any[]) => mockSplitTextToSize(...args),
  internal: {
    pageSize: {
      width: 210,
      height: 297,
      getWidth: () => 210,
      getHeight: () => 297,
    },
    getNumberOfPages: () => 1,
  },
  lastAutoTable: { finalY: 100 },
};

jest.mock('jspdf', () => ({
  __esModule: true,
  default: function JsPDFMock() { return mockDoc; },
}));

const mockAutoTable = jest.fn();
jest.mock('jspdf-autotable', () => ({
  __esModule: true,
  default: (...args: any[]) => mockAutoTable(...args),
}));

// Re-set mockAutoTable implementation in beforeEach since resetMocks clears it


import { exportCardsToPDF, exportDetailedCardReport } from '../../utils/pdfExport';

beforeEach(() => {
  mockSave.mockClear();
  mockText.mockClear();
  mockSetFontSize.mockClear();
  mockSetFont.mockClear();
  mockAddPage.mockClear();
  mockSetPage.mockClear();
  mockAutoTable.mockClear();
  mockSplitTextToSize.mockReturnValue(['text']);
});

describe('exportCardsToPDF', () => {
  it('generates PDF with default options', () => {
    const cards = [createCard(), createGradedCard()];
    exportCardsToPDF(cards);

    expect(mockText).toHaveBeenCalledWith('Sports Card Collection Report', 20, 25);
    expect(mockAutoTable).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('sports-cards-collection'));
  });

  it('includes stats section by default', () => {
    const cards = [createCard({ purchasePrice: 50, currentValue: 100 })];
    exportCardsToPDF(cards);

    // Stats autoTable call + cards autoTable call
    expect(mockAutoTable).toHaveBeenCalledTimes(2);
    // Verify stats header
    expect(mockText).toHaveBeenCalledWith('Portfolio Summary', 20, expect.any(Number));
  });

  it('skips stats when includeStats is false', () => {
    const cards = [createCard()];
    exportCardsToPDF(cards, { includeStats: false });

    // Only cards table, no stats table
    expect(mockAutoTable).toHaveBeenCalledTimes(1);
  });

  it('skips stats for empty card array', () => {
    exportCardsToPDF([]);
    // No autoTable calls when no cards and includeStats condition (cards.length > 0) fails
    expect(mockSave).toHaveBeenCalled();
  });

  it('groups by category', () => {
    const cards = [
      createCard({ category: 'Baseball' }),
      createCard({ category: 'Basketball' }),
    ];
    exportCardsToPDF(cards, { groupBy: 'category' });

    // Should have group headers written
    expect(mockText).toHaveBeenCalledWith('Baseball', 20, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('Basketball', 20, expect.any(Number));
  });

  it('groups by team', () => {
    const cards = [
      createCard({ team: 'Angels' }),
      createCard({ team: 'Yankees' }),
    ];
    exportCardsToPDF(cards, { groupBy: 'team' });

    expect(mockText).toHaveBeenCalledWith('Angels', 20, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('Yankees', 20, expect.any(Number));
  });

  it('groups by year', () => {
    const cards = [
      createCard({ year: 2023 }),
      createCard({ year: 2024 }),
    ];
    exportCardsToPDF(cards, { groupBy: 'year' });

    expect(mockText).toHaveBeenCalledWith('2023', 20, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('2024', 20, expect.any(Number));
  });

  it('sorts by value', () => {
    const cards = [
      createCard({ currentValue: 50, player: 'Low' }),
      createCard({ currentValue: 200, player: 'High' }),
    ];
    exportCardsToPDF(cards, { sortBy: 'value' });

    // autoTable should have been called; high value card first
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('sorts by year', () => {
    const cards = [
      createCard({ year: 2020 }),
      createCard({ year: 2024 }),
    ];
    exportCardsToPDF(cards, { sortBy: 'year' });
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('sorts by team', () => {
    const cards = [
      createCard({ team: 'Yankees' }),
      createCard({ team: 'Angels' }),
    ];
    exportCardsToPDF(cards, { sortBy: 'team' });
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('sorts by purchaseDate', () => {
    const cards = [
      createCard({ purchaseDate: new Date('2023-01-01') }),
      createCard({ purchaseDate: new Date('2024-06-01') }),
    ];
    exportCardsToPDF(cards, { sortBy: 'purchaseDate' });
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('adds page numbers', () => {
    const cards = [createCard()];
    exportCardsToPDF(cards);
    expect(mockSetPage).toHaveBeenCalledWith(1);
  });
});

describe('exportDetailedCardReport', () => {
  it('generates detail report for a card', () => {
    const card = createCard({
      player: 'Mike Trout',
      team: 'Angels',
      year: 2023,
      brand: 'Topps',
      cardNumber: '1',
      notes: 'Great card',
    });

    exportDetailedCardReport(card);

    expect(mockText).toHaveBeenCalledWith('Card Detail Report', 20, 25);
    expect(mockText).toHaveBeenCalledWith('Mike Trout - Angels', 20, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('2023 Topps #1', 20, expect.any(Number));
    // Notes section
    expect(mockText).toHaveBeenCalledWith('Notes:', 20, expect.any(Number));
    expect(mockSplitTextToSize).toHaveBeenCalledWith('Great card', expect.any(Number));
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('card-detail-mike-trout'));
  });

  it('includes sell data for sold card', () => {
    const card = createSoldCard({
      player: 'Aaron Judge',
      sellPrice: 150,
      sellDate: new Date('2024-06-01'),
    });

    exportDetailedCardReport(card);

    // autoTable should include sell price/date rows
    expect(mockAutoTable).toHaveBeenCalled();
    const autoTableCall = mockAutoTable.mock.calls[0];
    const bodyData = autoTableCall[1].body;
    // Sold card has 10 rows (8 base + 2 sell fields)
    expect(bodyData.length).toBe(10);
  });

  it('omits sell data for unsold card', () => {
    const card = createCard();
    exportDetailedCardReport(card);

    const autoTableCall = mockAutoTable.mock.calls[0];
    const bodyData = autoTableCall[1].body;
    // Unsold card has 8 rows
    expect(bodyData.length).toBe(8);
  });

  it('omits notes section when notes are empty', () => {
    const card = createCard({ notes: '' });
    exportDetailedCardReport(card);

    expect(mockSplitTextToSize).not.toHaveBeenCalled();
  });
});
