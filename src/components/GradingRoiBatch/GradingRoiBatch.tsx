import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../../types';
import {
  calculateGradingRoi,
  mapConditionToDistribution,
  DEFAULT_GRADING_SHIPPING,
  GradingRoiResult,
} from '../../utils/gradingRoiCalculator';
import { apiService } from '../../services/api';
import './GradingRoiBatch.css';

interface RankedCard {
  card: Card;
  result: GradingRoiResult;
}

type SortField = 'player' | 'year' | 'brand' | 'condition' | 'rawValue' | 'expectedValue' | 'roi' | 'recommendation';

export const GradingRoiBatch: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('roi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [minValue, setMinValue] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const fetchCards = async () => {
      setLoading(true);
      try {
        const allCards = await apiService.getAllCards();
        if (!cancelled) {
          setCards(allCards.filter((c: Card) => !c.isGraded));
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load cards. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCards();
    return () => { cancelled = true; };
  }, []);

  const rankedCards: RankedCard[] = useMemo(() => {
    let filtered = cards;

    if (categoryFilter) {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }

    const minVal = parseFloat(minValue);
    if (minVal > 0) {
      filtered = filtered.filter(c => c.currentValue >= minVal);
    }

    return filtered.map(card => ({
      card,
      result: calculateGradingRoi({
        rawValue: card.currentValue || 0,
        purchasePrice: card.purchasePrice || 0,
        condition: card.condition || 'Near Mint',
        gradingCompany: 'PSA',
        gradingTier: 'Regular',
        shippingCost: DEFAULT_GRADING_SHIPPING,
      }),
    }));
  }, [cards, categoryFilter, minValue]);

  const sortedCards = useMemo(() => {
    const sorted = [...rankedCards].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'player':
          cmp = a.card.player.localeCompare(b.card.player);
          break;
        case 'year':
          cmp = a.card.year - b.card.year;
          break;
        case 'brand':
          cmp = a.card.brand.localeCompare(b.card.brand);
          break;
        case 'condition':
          cmp = (a.card.condition || '').localeCompare(b.card.condition || '');
          break;
        case 'rawValue':
          cmp = a.card.currentValue - b.card.currentValue;
          break;
        case 'expectedValue':
          cmp = a.result.expectedValue - b.result.expectedValue;
          break;
        case 'roi':
          cmp = a.result.expectedRoi - b.result.expectedRoi;
          break;
        case 'recommendation': {
          const order = { 'Grade': 0, 'Borderline': 1, "Don't Grade": 2 };
          cmp = (order[a.result.recommendation] ?? 3) - (order[b.result.recommendation] ?? 3);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rankedCards, sortField, sortDir]);

  const categories = useMemo(() => {
    const cats = new Set(cards.map(c => c.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [cards]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (loading) {
    return (
      <div className="grading-roi-batch">
        <h2>Grading ROI Analysis</h2>
        <p className="grb-loading">Loading cards...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grading-roi-batch">
        <h2>Grading ROI Analysis</h2>
        <p className="grb-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="grading-roi-batch">
      <div className="grb-header">
        <h2>Grading ROI Analysis</h2>
        <p className="grb-subtitle">
          Ranking {sortedCards.length} raw card{sortedCards.length !== 1 ? 's' : ''} by grading potential (PSA Regular tier)
        </p>
      </div>

      <div className="grb-filters">
        <div className="grb-filter">
          <label htmlFor="grb-category">Category</label>
          <select
            id="grb-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="grb-filter">
          <label htmlFor="grb-min-value">Min Raw Value</label>
          <div className="grb-input-wrapper">
            <span className="grb-input-prefix">$</span>
            <input
              id="grb-min-value"
              type="number"
              min="0"
              step="1"
              value={minValue}
              placeholder="0"
              onChange={(e) => setMinValue(e.target.value)}
            />
          </div>
        </div>
      </div>

      {sortedCards.length === 0 ? (
        <div className="grb-empty">
          No raw cards found. Cards that are already graded are excluded.
        </div>
      ) : (
        <div className="grb-table-wrapper">
          <table className="grb-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('player')}>Player{sortIndicator('player')}</th>
                <th onClick={() => handleSort('year')}>Year{sortIndicator('year')}</th>
                <th onClick={() => handleSort('brand')}>Brand{sortIndicator('brand')}</th>
                <th onClick={() => handleSort('condition')}>Condition{sortIndicator('condition')}</th>
                <th onClick={() => handleSort('rawValue')}>Raw Value{sortIndicator('rawValue')}</th>
                <th onClick={() => handleSort('expectedValue')}>Expected Graded{sortIndicator('expectedValue')}</th>
                <th onClick={() => handleSort('roi')}>ROI %{sortIndicator('roi')}</th>
                <th onClick={() => handleSort('recommendation')}>Recommendation{sortIndicator('recommendation')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedCards.map(({ card, result }) => {
                const recClass =
                  result.recommendation === 'Grade' ? 'grade' :
                  result.recommendation === "Don't Grade" ? 'dont-grade' :
                  'borderline';

                return (
                  <tr key={card.id}>
                    <td className="grb-player">{card.player}</td>
                    <td>{card.year}</td>
                    <td>{card.brand}</td>
                    <td>{mapConditionToDistribution(card.condition || '')}</td>
                    <td>{formatCurrency(card.currentValue)}</td>
                    <td>{formatCurrency(result.expectedValue)}</td>
                    <td className={result.expectedRoi >= 0 ? 'grb-positive' : 'grb-negative'}>
                      {result.expectedRoi >= 0 ? '+' : ''}{result.expectedRoi.toFixed(1)}%
                    </td>
                    <td>
                      <span className={`grb-badge ${recClass}`}>
                        {result.recommendation}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
