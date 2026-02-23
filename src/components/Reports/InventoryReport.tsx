import React, { useState, useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';
import { exportToPDF } from '../../services/reportService';
import './InventoryReport.css';

interface InventoryStats {
  totalCards: number;
  uniquePlayers: number;
  uniqueBrands: number;
  totalValue: number;
  averageValue: number;
  oldestCard: Card | null;
  newestCard: Card | null;
  mostValuableCard: Card | null;
  gradedCards: number;
  rawCards: number;
  cardsByCategory: Record<string, number>;
  cardsByBrand: Record<string, number>;
  cardsByYear: Record<string, number>;
  cardsByCondition: Record<string, number>;
}

const InventoryReport: React.FC = () => {
  const { state } = useCards();
  const [sortBy, setSortBy] = useState<'player' | 'year' | 'value' | 'brand'>('player');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'brand' | 'year' | 'player'>('none');
  const [showDetails, setShowDetails] = useState<boolean>(true);

  const stats = useMemo((): InventoryStats => {
    const cards = filterCategory === 'all' 
      ? state.cards 
      : state.cards.filter(card => card.category === filterCategory);

    if (cards.length === 0) {
      return {
        totalCards: 0,
        uniquePlayers: 0,
        uniqueBrands: 0,
        totalValue: 0,
        averageValue: 0,
        oldestCard: null,
        newestCard: null,
        mostValuableCard: null,
        gradedCards: 0,
        rawCards: 0,
        cardsByCategory: {},
        cardsByBrand: {},
        cardsByYear: {},
        cardsByCondition: {}
      };
    }

    const uniquePlayers = new Set(cards.map(c => c.player)).size;
    const uniqueBrands = new Set(cards.map(c => c.brand)).size;
    const totalValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
    const averageValue = totalValue / cards.length;

    const sortedByYear = [...cards].sort((a, b) => parseInt(a.year.toString()) - parseInt(b.year.toString()));
    const oldestCard = sortedByYear[0];
    const newestCard = sortedByYear[sortedByYear.length - 1];

    const mostValuableCard = [...cards].sort((a, b) => b.currentValue - a.currentValue)[0];

    const gradedCards = cards.filter(c => c.gradingCompany).length;
    const rawCards = cards.filter(c => !c.gradingCompany).length;

    // Group by various attributes
    const cardsByCategory = cards.reduce((acc, card) => {
      acc[card.category] = (acc[card.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const cardsByBrand = cards.reduce((acc, card) => {
      acc[card.brand] = (acc[card.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const cardsByYear = cards.reduce((acc, card) => {
      acc[card.year] = (acc[card.year] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const cardsByCondition = cards.reduce((acc, card) => {
      const condition = card.gradingCompany ? `${card.gradingCompany} ${card.condition}` : card.condition;
      acc[condition] = (acc[condition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalCards: cards.length,
      uniquePlayers,
      uniqueBrands,
      totalValue,
      averageValue,
      oldestCard,
      newestCard,
      mostValuableCard,
      gradedCards,
      rawCards,
      cardsByCategory,
      cardsByBrand,
      cardsByYear,
      cardsByCondition
    };
  }, [state.cards, filterCategory]);

  const sortedCards = useMemo(() => {
    const cards = filterCategory === 'all' 
      ? state.cards 
      : state.cards.filter(card => card.category === filterCategory);

    return [...cards].sort((a, b) => {
      switch (sortBy) {
        case 'player':
          return a.player.localeCompare(b.player);
        case 'year':
          return parseInt(a.year.toString()) - parseInt(b.year.toString());
        case 'value':
          return b.currentValue - a.currentValue;
        case 'brand':
          return a.brand.localeCompare(b.brand);
        default:
          return 0;
      }
    });
  }, [state.cards, filterCategory, sortBy]);

  const groupedCards = useMemo(() => {
    if (groupBy === 'none') return { 'All Cards': sortedCards };

    return sortedCards.reduce((acc, card) => {
      let key: string;
      switch (groupBy) {
        case 'category':
          key = card.category;
          break;
        case 'brand':
          key = card.brand;
          break;
        case 'year':
          key = card.year.toString();
          break;
        case 'player':
          key = card.player;
          break;
        default:
          key = 'Unknown';
      }
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(card);
      return acc;
    }, {} as Record<string, Card[]>);
  }, [sortedCards, groupBy]);

  const handleExportPDF = () => {
    const reportData = {
      title: 'Detailed Inventory Report',
      date: new Date().toLocaleDateString(),
      stats,
      cards: sortedCards,
      groupBy,
      filterCategory
    };

    exportToPDF('inventory-report', reportData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const categories = ['all', ...Array.from(new Set(state.cards.map(card => card.category))).sort()];

  return (
    <div className="inventory-report">
      <div className="report-header">
        <div>
          <h2>Detailed Inventory Report</h2>
          <p>Complete catalog of your card collection</p>
        </div>
        <button onClick={handleExportPDF} className="export-button">
          Export to PDF
        </button>
      </div>

      <div className="report-controls">
        <div className="control-group">
          <label>Category Filter</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="player">Player Name</option>
            <option value="year">Year</option>
            <option value="value">Current Value</option>
            <option value="brand">Brand</option>
          </select>
        </div>

        <div className="control-group">
          <label>Group By</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as any)}>
            <option value="none">No Grouping</option>
            <option value="category">Category</option>
            <option value="brand">Brand</option>
            <option value="year">Year</option>
            <option value="player">Player</option>
          </select>
        </div>

        <div className="control-group">
          <label>
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
            />
            Show Detailed View
          </label>
        </div>
      </div>

      <div className="inventory-stats">
        <h3>Collection Overview</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Cards</span>
            <span className="stat-value">{stats.totalCards}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Value</span>
            <span className="stat-value">{formatCurrency(stats.totalValue)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Average Value</span>
            <span className="stat-value">{formatCurrency(stats.averageValue)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unique Players</span>
            <span className="stat-value">{stats.uniquePlayers}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unique Brands</span>
            <span className="stat-value">{stats.uniqueBrands}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Graded Cards</span>
            <span className="stat-value">{stats.gradedCards}</span>
          </div>
        </div>

        {stats.mostValuableCard && (
          <div className="highlight-cards">
            <div className="highlight-card">
              <h4>Most Valuable Card</h4>
              <p>{stats.mostValuableCard.year} {stats.mostValuableCard.brand} {stats.mostValuableCard.player}</p>
              <p className="value">{formatCurrency(stats.mostValuableCard.currentValue)}</p>
            </div>
            {stats.oldestCard && (
              <div className="highlight-card">
                <h4>Oldest Card</h4>
                <p>{stats.oldestCard.year} {stats.oldestCard.brand} {stats.oldestCard.player}</p>
              </div>
            )}
            {stats.newestCard && (
              <div className="highlight-card">
                <h4>Newest Card</h4>
                <p>{stats.newestCard.year} {stats.newestCard.brand} {stats.newestCard.player}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="distribution-charts">
        <div className="distribution-section">
          <h4>Distribution by Category</h4>
          <div className="distribution-list">
            {Object.entries(stats.cardsByCategory).map(([category, count]) => (
              <div key={category} className="distribution-item">
                <span>{category}</span>
                <span>{count} cards</span>
              </div>
            ))}
          </div>
        </div>

        <div className="distribution-section">
          <h4>Distribution by Brand</h4>
          <div className="distribution-list">
            {Object.entries(stats.cardsByBrand)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([brand, count]) => (
                <div key={brand} className="distribution-item">
                  <span>{brand}</span>
                  <span>{count} cards</span>
                </div>
              ))}
          </div>
        </div>

        <div className="distribution-section">
          <h4>Distribution by Condition</h4>
          <div className="distribution-list">
            {Object.entries(stats.cardsByCondition).map(([condition, count]) => (
              <div key={condition} className="distribution-item">
                <span>{condition}</span>
                <span>{count} cards</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="inventory-list">
        <h3>Complete Card Inventory</h3>
        {Object.entries(groupedCards).map(([groupName, cards]) => (
          <div key={groupName} className="inventory-group">
            {groupBy !== 'none' && (
              <h4 className="group-header">
                {groupName} ({cards.length} cards - {formatCurrency(cards.reduce((sum, c) => sum + c.currentValue, 0))})
              </h4>
            )}
            
            {showDetails ? (
              <div className="inventory-table">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Year</th>
                      <th>Brand</th>
                      <th>Card #</th>
                      <th>Category</th>
                      <th>Condition</th>
                      <th>Purchase Price</th>
                      <th>Current Value</th>
                      <th>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card) => {
                      const roi = ((card.currentValue - card.purchasePrice) / card.purchasePrice * 100).toFixed(1);
                      return (
                        <tr key={card.id}>
                          <td>{card.player}</td>
                          <td>{card.year}</td>
                          <td>{card.brand}</td>
                          <td>{card.cardNumber}</td>
                          <td>{card.category}</td>
                          <td>
                            {card.gradingCompany 
                              ? `${card.gradingCompany} ${card.condition}` 
                              : card.condition}
                          </td>
                          <td>{formatCurrency(card.purchasePrice)}</td>
                          <td>{formatCurrency(card.currentValue)}</td>
                          <td className={parseFloat(roi) >= 0 ? 'positive' : 'negative'}>
                            {roi}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="inventory-summary">
                {cards.map((card) => (
                  <div key={card.id} className="summary-item">
                    <span>{card.year} {card.brand} {card.player} #{card.cardNumber}</span>
                    <span>{formatCurrency(card.currentValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryReport;