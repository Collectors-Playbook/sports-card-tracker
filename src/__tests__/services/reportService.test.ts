import { createCard, createGradedCard } from '../helpers/factories';

// jsPDF mock
const mockSave = jest.fn();
const mockText = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetFont = jest.fn();
const mockSetTextColor = jest.fn();
const mockAutoTable = jest.fn();

const mockDoc = {
  setFontSize: (...args: any[]) => mockSetFontSize(...args),
  setFont: (...args: any[]) => mockSetFont(...args),
  setTextColor: (...args: any[]) => mockSetTextColor(...args),
  text: (...args: any[]) => mockText(...args),
  save: (...args: any[]) => mockSave(...args),
  autoTable: (...args: any[]) => mockAutoTable(...args),
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

jest.mock('jspdf-autotable', () => ({}));

import { exportToPDF } from '../../services/reportService';

beforeEach(() => {
  mockSave.mockClear();
  mockText.mockClear();
  mockSetFontSize.mockClear();
  mockSetFont.mockClear();
  mockAutoTable.mockClear();
});

describe('exportToPDF', () => {
  it('generates inventory report with stats and cards', () => {
    const cards = [
      createCard({ player: 'Mike Trout', purchasePrice: 50, currentValue: 100 }),
      createGradedCard({ player: 'Ohtani', purchasePrice: 100, currentValue: 250 }),
    ];

    exportToPDF('inventory-report', {
      title: 'My Inventory',
      date: '2024-01-01',
      stats: {
        totalCards: 2,
        totalValue: 350,
        averageValue: 175,
        uniquePlayers: 2,
        uniqueBrands: 1,
        gradedCards: 1,
        mostValuableCard: cards[1],
      },
      cards,
    });

    // Check title was written
    expect(mockText).toHaveBeenCalledWith('My Inventory', expect.any(Number), 20, expect.any(Object));
    // Check date was written
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining('2024-01-01'),
      expect.any(Number),
      30,
      expect.any(Object)
    );
    // Check stats section
    expect(mockText).toHaveBeenCalledWith('Collection Overview', 20, expect.any(Number));
    // Check most valuable card section
    expect(mockText).toHaveBeenCalledWith('Most Valuable Card:', 20, expect.any(Number));
    // Check save was called
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining('inventory-report'));
  });

  it('handles report without stats (generic fallback)', () => {
    exportToPDF('custom-report', { title: 'Custom' });

    expect(mockText).toHaveBeenCalledWith('Custom', expect.any(Number), 20, expect.any(Object));
    expect(mockText).toHaveBeenCalledWith('Report data export coming soon...', 20, expect.any(Number));
    expect(mockSave).toHaveBeenCalled();
  });

  it('uses reportType as title when no title provided', () => {
    exportToPDF('test-type', {});
    expect(mockText).toHaveBeenCalledWith('test-type', expect.any(Number), 20, expect.any(Object));
  });

  it('uses current date when no date provided', () => {
    exportToPDF('inventory-report', { stats: null });
    expect(mockText).toHaveBeenCalledWith(
      expect.stringContaining('Generated on:'),
      expect.any(Number),
      30,
      expect.any(Object)
    );
  });

  it('handles inventory report without mostValuableCard', () => {
    exportToPDF('inventory-report', {
      stats: {
        totalCards: 0,
        totalValue: 0,
        averageValue: 0,
        uniquePlayers: 0,
        uniqueBrands: 0,
        gradedCards: 0,
      },
    });

    expect(mockSave).toHaveBeenCalled();
  });
});
