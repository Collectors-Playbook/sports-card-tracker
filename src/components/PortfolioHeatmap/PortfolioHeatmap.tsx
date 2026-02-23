import React, { useState, useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';
import {
  buildHeatmapData,
  computeHeatmapStats,
  HeatmapCardData,
} from '../../utils/portfolioHeatmap';
import CustomTreemapContent from './CustomTreemapContent';
import './PortfolioHeatmap.css';

interface PortfolioHeatmapProps {
  onCardSelect?: (card: Card) => void;
}

type ViewMode = 'treemap' | 'grid';
type TimePeriod = '7d' | '30d' | '90d' | 'ytd' | 'all';

const PortfolioHeatmap: React.FC<PortfolioHeatmapProps> = ({ onCardSelect }) => {
  const { state } = useCards();
  const [viewMode, setViewMode] = useState<ViewMode>('treemap');
  const [timePeriod] = useState<TimePeriod>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [gradingFilter, setGradingFilter] = useState('');

  // Derive filter options from cards
  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const years = new Set<number>();
    const brands = new Set<string>();

    state.cards.forEach(card => {
      if (card.category) categories.add(card.category);
      if (card.year) years.add(card.year);
      if (card.brand) brands.add(card.brand);
    });

    return {
      categories: Array.from(categories).sort(),
      years: Array.from(years).sort((a, b) => b - a),
      brands: Array.from(brands).sort(),
    };
  }, [state.cards]);

  // Apply filters
  const filteredCards = useMemo(() => {
    let cards = state.cards;

    if (categoryFilter) {
      cards = cards.filter(c => c.category === categoryFilter);
    }
    if (yearFilter) {
      cards = cards.filter(c => c.year === parseInt(yearFilter));
    }
    if (brandFilter) {
      cards = cards.filter(c => c.brand === brandFilter);
    }
    if (gradingFilter === 'graded') {
      cards = cards.filter(c => c.isGraded);
    } else if (gradingFilter === 'raw') {
      cards = cards.filter(c => !c.isGraded);
    }

    return cards;
  }, [state.cards, categoryFilter, yearFilter, brandFilter, gradingFilter]);

  const heatmapData = useMemo(() => buildHeatmapData(filteredCards), [filteredCards]);
  const stats = useMemo(() => computeHeatmapStats(heatmapData), [heatmapData]);

  // Build treemap data format (requires 'value' key for sizing)
  const treemapData = useMemo(
    () =>
      heatmapData.map(d => ({
        ...d,
        value: Math.max(d.currentValue, 1), // Treemap needs positive values
      })),
    [heatmapData]
  );

  const handleCardClick = (id: string) => {
    const card = state.cards.find(c => c.id === id);
    if (card && onCardSelect) {
      onCardSelect(card);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatCurrencyFull = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const renderTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const data: HeatmapCardData = payload[0].payload;
    return (
      <div className="phm-tooltip">
        <div className="phm-tooltip-name">{data.name}</div>
        <div className="phm-tooltip-row">
          <span>Value:</span>
          <span>{formatCurrencyFull(data.currentValue)}</span>
        </div>
        <div className="phm-tooltip-row">
          <span>Cost:</span>
          <span>{formatCurrencyFull(data.purchasePrice)}</span>
        </div>
        <div className="phm-tooltip-row">
          <span>ROI:</span>
          <span style={{ color: data.roi >= 0 ? '#16a34a' : '#dc2626' }}>
            {data.roiPercent >= 0 ? '+' : ''}{data.roiPercent.toFixed(1)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="portfolio-heatmap">
      <div className="phm-header">
        <h2>Portfolio Heatmap</h2>
        <p className="phm-subtitle">
          Visual performance overview of {stats.totalCards} card{stats.totalCards !== 1 ? 's' : ''} — sized by value, colored by ROI
        </p>
      </div>

      {/* Stats bar */}
      <div className="phm-stats">
        <div className="phm-stat">
          <div className="phm-stat-label">Cards</div>
          <div className="phm-stat-value">{stats.totalCards}</div>
        </div>
        <div className="phm-stat">
          <div className="phm-stat-label">Total Value</div>
          <div className="phm-stat-value">{formatCurrency(stats.totalValue)}</div>
        </div>
        <div className="phm-stat">
          <div className="phm-stat-label">Winners</div>
          <div className="phm-stat-value positive">{stats.winners}</div>
        </div>
        <div className="phm-stat">
          <div className="phm-stat-label">Losers</div>
          <div className="phm-stat-value negative">{stats.losers}</div>
        </div>
        <div className="phm-stat">
          <div className="phm-stat-label">Flat</div>
          <div className="phm-stat-value">{stats.flat}</div>
        </div>
        <div className="phm-stat">
          <div className="phm-stat-label">Avg ROI</div>
          <div className={`phm-stat-value ${stats.avgRoi >= 0 ? 'positive' : 'negative'}`}>
            {stats.avgRoi >= 0 ? '+' : ''}{(stats.avgRoi * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="phm-controls">
        <div className="phm-time-periods">
          {(['7d', '30d', '90d', 'ytd', 'all'] as TimePeriod[]).map(period => (
            <div key={period} className="phm-time-btn-wrapper">
              {period !== 'all' && (
                <span className="phm-disabled-tip">Requires price history tracking</span>
              )}
              <button
                className={`phm-time-btn ${timePeriod === period ? 'active' : ''}`}
                disabled={period !== 'all'}
                title={period !== 'all' ? 'Requires price history tracking' : undefined}
              >
                {period === 'all' ? 'All Time' : period.toUpperCase()}
              </button>
            </div>
          ))}
        </div>

        <div className="phm-view-toggle">
          <button
            className={`phm-view-btn ${viewMode === 'treemap' ? 'active' : ''}`}
            onClick={() => setViewMode('treemap')}
          >
            Treemap
          </button>
          <button
            className={`phm-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="phm-filters">
        <div className="phm-filter">
          <label htmlFor="phm-category">Category</label>
          <select
            id="phm-category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {filterOptions.categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="phm-filter">
          <label htmlFor="phm-year">Year</label>
          <select
            id="phm-year"
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {filterOptions.years.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
        <div className="phm-filter">
          <label htmlFor="phm-brand">Brand</label>
          <select
            id="phm-brand"
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          >
            <option value="">All Brands</option>
            {filterOptions.brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="phm-filter">
          <label htmlFor="phm-grading">Grading</label>
          <select
            id="phm-grading"
            value={gradingFilter}
            onChange={e => setGradingFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="graded">Graded</option>
            <option value="raw">Raw</option>
          </select>
        </div>
      </div>

      {/* Color legend */}
      <div className="phm-legend">
        <span className="phm-legend-label">-50%</span>
        <div className="phm-legend-bar" />
        <span className="phm-legend-label">+50%</span>
      </div>

      {/* Content */}
      {heatmapData.length === 0 ? (
        <div className="phm-empty">
          No cards with value data to display. Add cards with purchase price and current value to see the heatmap.
        </div>
      ) : viewMode === 'treemap' ? (
        <div className="phm-treemap-container">
          <ResponsiveContainer width="100%" height={500}>
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="#fff"
              content={
                <CustomTreemapContent onCardClick={handleCardClick} />
              }
            >
              <Tooltip content={renderTooltipContent} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="phm-grid">
          {heatmapData.map(card => (
            <div
              key={card.id}
              className="phm-grid-cell"
              style={{ backgroundColor: card.color }}
              onClick={() => handleCardClick(card.id)}
              title={`${card.name}\nValue: ${formatCurrencyFull(card.currentValue)}\nROI: ${card.roiPercent >= 0 ? '+' : ''}${card.roiPercent.toFixed(1)}%`}
            >
              <div className="phm-grid-cell-name">{card.player}</div>
              <div className="phm-grid-cell-roi">
                {card.roiPercent >= 0 ? '+' : ''}{card.roiPercent.toFixed(1)}%
              </div>
              <div className="phm-grid-cell-value">{formatCurrency(card.currentValue)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortfolioHeatmap;
