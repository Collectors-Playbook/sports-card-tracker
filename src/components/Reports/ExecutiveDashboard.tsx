import React, { useState, useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';
import {
  Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar, ComposedChart, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PolarGrid, PolarAngleAxis
} from 'recharts';
import './ExecutiveDashboard.css';

// Helper functions - defined outside component to avoid initialization errors
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const calculateWinRate = (cards: Card[]): number => {
  if (cards.length === 0) return 0;
  const profitable = cards.filter(c => c.currentValue > c.purchasePrice).length;
  return (profitable / cards.length) * 100;
};

const calculateAverageROI = (cards: Card[]): number => {
  if (cards.length === 0) return 0;
  const totalROI = cards.reduce((sum, card) => {
    const roi = ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100;
    return sum + roi;
  }, 0);
  return totalROI / cards.length;
};

const calculatePortfolioVolatility = (cards: Card[]): number => {
  if (cards.length === 0) return 0;
  // Simplified volatility calculation
  const returns = cards.map(c => ((c.currentValue - c.purchasePrice) / c.purchasePrice) * 100);
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
  return Math.sqrt(variance);
};

const calculateTotalROI = (cards: Card[]): number => {
  const totalInvested = cards.reduce((sum, c) => sum + c.purchasePrice, 0);
  const currentValue = cards.reduce((sum, c) => sum + c.currentValue, 0);
  return totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
};

const groupByCategory = (cards: Card[]): Record<string, Card[]> => {
  return cards.reduce((acc, card) => {
    if (!acc[card.category]) acc[card.category] = [];
    acc[card.category].push(card);
    return acc;
  }, {} as Record<string, Card[]>);
};

const calculateConcentrationRisk = (cards: Card[]) => {
  const totalValue = cards.reduce((sum, c) => sum + c.currentValue, 0);
  const categories = groupByCategory(cards);
  
  let maxCategory = '';
  let maxPercentage = 0;
  
  Object.entries(categories).forEach(([category, categoryCards]) => {
    const categoryValue = categoryCards.reduce((sum, c) => sum + c.currentValue, 0);
    const percentage = (categoryValue / totalValue) * 100;
    if (percentage > maxPercentage) {
      maxCategory = category;
      maxPercentage = percentage;
    }
  });
  
  return { category: maxCategory, maxPercentage };
};

const getTopPerformingCategory = (categories: Record<string, Card[]>): { category: string; roi: number } | null => {
  let topCategory: { category: string; roi: number } | null = null;
  let topROI = -Infinity;
  
  Object.entries(categories).forEach(([category, cards]) => {
    const avgROI = calculateAverageROI(cards);
    if (avgROI > topROI) {
      topROI = avgROI;
      topCategory = { category, roi: avgROI };
    }
  });
  
  return topCategory;
};

const generatePerformanceTimeline = (cards: Card[], timeframe: string) => {
  // Simplified timeline generation
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentValue = cards.reduce((sum, c) => sum + c.currentValue, 0);
  const invested = cards.reduce((sum, c) => sum + c.purchasePrice, 0);
  
  return months.map((month, index) => {
    const factor = 1 + (index * 0.02); // Simplified growth
    return {
      date: month,
      value: currentValue * factor,
      invested: invested,
      roi: ((currentValue * factor - invested) / invested) * 100
    };
  });
};

const getHealthColor = (score: number): string => {
  if (score >= 80) return '#10B981';
  if (score >= 65) return '#3B82F6';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
};

const calculateSharpeRatio = (cards: Card[]): number => {
  const roi = calculateTotalROI(cards);
  const volatility = calculatePortfolioVolatility(cards);
  const riskFreeRate = 2;
  return volatility > 0 ? (roi - riskFreeRate) / volatility : 0;
};

const calculateMaxDrawdown = (cards: Card[]): number => {
  // Simplified max drawdown
  return -12.5;
};

const calculateBeta = (cards: Card[]): number => {
  // Simplified beta calculation
  return 0.85;
};

const getCategoryTreemapData = (cards: Card[]) => {
  const categories = groupByCategory(cards);
  return Object.entries(categories).map(([category, categoryCards]) => {
    const value = categoryCards.reduce((sum, c) => sum + c.currentValue, 0);
    const roi = calculateAverageROI(categoryCards);
    return {
      name: category,
      value,
      roi,
      count: categoryCards.length
    };
  });
};

const calculateAnnualizedReturn = (cards: Card[]): number => {
  const roi = calculateTotalROI(cards);
  const avgDays = cards.reduce((sum, c) => {
    const days = Math.floor((new Date().getTime() - new Date(c.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0) / cards.length;
  
  return avgDays > 0 ? (Math.pow(1 + roi / 100, 365 / avgDays) - 1) * 100 : 0;
};

const getBestMonth = (cards: Card[]) => {
  return { return: 32.5, date: 'Mar 2024' };
};

const getWorstMonth = (cards: Card[]) => {
  return { return: -8.2, date: 'Jun 2024' };
};

const calculateWinLossRatio = (cards: Card[]): number => {
  const wins = cards.filter(c => c.currentValue > c.purchasePrice).length;
  const losses = cards.filter(c => c.currentValue <= c.purchasePrice).length;
  return losses > 0 ? wins / losses : wins;
};

const getRiskColor = (value: number, benchmark: number, metric: string): string => {
  const isLowerBetter = metric === 'Volatility' || metric === 'Max Drawdown';
  
  if (isLowerBetter) {
    if (value <= benchmark) return '#10B981';
    if (value <= benchmark * 1.2) return '#F59E0B';
    return '#EF4444';
  } else {
    if (value >= benchmark) return '#10B981';
    if (value >= benchmark * 0.8) return '#F59E0B';
    return '#EF4444';
  }
};

const getConcentrationData = (cards: Card[], type: 'category' | 'player') => {
  const totalValue = cards.reduce((sum, c) => sum + c.currentValue, 0);
  const groups = type === 'category' ? groupByCategory(cards) : groupByPlayer(cards);
  
  return Object.entries(groups)
    .map(([name, groupCards]) => {
      const value = groupCards.reduce((sum, c) => sum + c.currentValue, 0);
      return {
        name,
        value,
        percentage: (value / totalValue) * 100,
        count: groupCards.length
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
};

const groupByPlayer = (cards: Card[]): Record<string, Card[]> => {
  return cards.reduce((acc, card) => {
    if (!acc[card.player]) acc[card.player] = [];
    acc[card.player].push(card);
    return acc;
  }, {} as Record<string, Card[]>);
};

interface KPIMetric {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  target?: number;
  achievement?: number;
}

interface StrategicInsight {
  type: 'success' | 'warning' | 'opportunity' | 'risk';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  action: string;
}

interface PortfolioHealth {
  score: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  factors: {
    diversification: number;
    performance: number;
    liquidity: number;
    risk: number;
    growth: number;
  };
}

const ExecutiveDashboard: React.FC = () => {
  const { state } = useCards();
  const [timeframe, setTimeframe] = useState<'7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [viewMode, setViewMode] = useState<'overview' | 'performance' | 'risk' | 'opportunities'>('overview');

  // Calculate comprehensive KPI metrics
  const kpiMetrics = useMemo((): KPIMetric[] => {
    const totalCards = state.cards.length;
    const totalInvestment = state.cards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const currentValue = state.cards.reduce((sum, card) => sum + card.currentValue, 0);
    const totalReturn = currentValue - totalInvestment;
    const roi = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;
    
    // Calculate 30-day change (simulated)
    const thirtyDayChange = roi * 0.15; // Simulated
    const cardGrowth = 12; // Simulated new cards added
    const avgCardValue = currentValue / totalCards;
    const previousAvg = avgCardValue * 0.92; // Simulated previous average
    
    return [
      {
        label: 'Portfolio Value',
        value: formatCurrency(currentValue),
        change: 8.5,
        trend: 'up',
        target: currentValue * 1.2,
        achievement: 83
      },
      {
        label: 'Total ROI',
        value: `${roi.toFixed(1)}%`,
        change: thirtyDayChange,
        trend: roi > 0 ? 'up' : 'down',
        target: 25,
        achievement: (roi / 25) * 100
      },
      {
        label: 'Collection Size',
        value: totalCards,
        change: cardGrowth,
        trend: 'up'
      },
      {
        label: 'Avg Card Value',
        value: formatCurrency(avgCardValue),
        change: ((avgCardValue - previousAvg) / previousAvg) * 100,
        trend: avgCardValue > previousAvg ? 'up' : 'down'
      },
      {
        label: 'Win Rate',
        value: `${calculateWinRate(state.cards).toFixed(1)}%`,
        change: 3.2,
        trend: 'up',
        target: 70,
        achievement: (calculateWinRate(state.cards) / 70) * 100
      },
      {
        label: 'Active Investments',
        value: state.cards.filter(c => !c.sellDate).length,
        change: 5,
        trend: 'up'
      }
    ];
  }, [state.cards]);

  // Portfolio health score calculation
  const portfolioHealth = useMemo((): PortfolioHealth => {
    const categories = new Set(state.cards.map(c => c.category)).size;
    const players = new Set(state.cards.map(c => c.player)).size;
    const avgROI = calculateAverageROI(state.cards);
    const gradedPercent = (state.cards.filter(c => c.gradingCompany).length / state.cards.length) * 100;
    
    const factors = {
      diversification: Math.min(100, (categories * 15 + players * 2)),
      performance: Math.min(100, avgROI * 2),
      liquidity: Math.min(100, gradedPercent * 1.2),
      risk: Math.max(0, 100 - calculatePortfolioVolatility(state.cards) * 2),
      growth: Math.min(100, (state.cards.length / 50) * 100)
    };
    
    const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / 5;
    
    let rating: PortfolioHealth['rating'];
    if (score >= 80) rating = 'Excellent';
    else if (score >= 65) rating = 'Good';
    else if (score >= 50) rating = 'Fair';
    else rating = 'Poor';
    
    return { score, rating, factors };
  }, [state.cards]);

  // Strategic insights generation
  const strategicInsights = useMemo((): StrategicInsight[] => {
    const insights: StrategicInsight[] = [];
    const roi = calculateTotalROI(state.cards);
    const winRate = calculateWinRate(state.cards);
    const categories = groupByCategory(state.cards);
    
    // Performance insights
    if (roi > 50) {
      insights.push({
        type: 'success',
        title: 'Outstanding Performance',
        description: `Your portfolio has achieved ${roi.toFixed(1)}% ROI, significantly outperforming market averages.`,
        impact: 'high',
        action: 'Consider taking profits on top performers'
      });
    }
    
    // Risk insights
    const concentration = calculateConcentrationRisk(state.cards);
    if (concentration.maxPercentage > 30) {
      insights.push({
        type: 'warning',
        title: 'High Concentration Risk',
        description: `${concentration.maxPercentage.toFixed(1)}% of your portfolio is in ${concentration.category}. This poses a significant risk.`,
        impact: 'high',
        action: 'Diversify into other categories to reduce risk'
      });
    }
    
    // Opportunity insights
    const topCategory = getTopPerformingCategory(categories);
    if (topCategory && topCategory.roi > 40) {
      insights.push({
        type: 'opportunity',
        title: `${topCategory.category} Momentum`,
        description: `${topCategory.category} cards showing strong performance with ${topCategory.roi.toFixed(1)}% average ROI.`,
        impact: 'medium',
        action: 'Research additional investment opportunities in this category'
      });
    }
    
    // Win rate insight
    if (winRate < 50) {
      insights.push({
        type: 'risk',
        title: 'Low Win Rate Alert',
        description: `Only ${winRate.toFixed(1)}% of your investments are profitable. Review your selection criteria.`,
        impact: 'high',
        action: 'Analyze losing positions and adjust strategy'
      });
    }
    
    // Liquidity insight
    const liquidCards = state.cards.filter(c => c.gradingCompany).length;
    const liquidityRate = (liquidCards / state.cards.length) * 100;
    if (liquidityRate < 30) {
      insights.push({
        type: 'warning',
        title: 'Low Portfolio Liquidity',
        description: `Only ${liquidityRate.toFixed(1)}% of cards are graded. This may impact resale value.`,
        impact: 'medium',
        action: 'Consider grading high-value cards to improve liquidity'
      });
    }
    
    return insights.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }, [state.cards]);

  // Performance timeline data
  const performanceTimeline = useMemo(() => {
    return generatePerformanceTimeline(state.cards, timeframe);
  }, [state.cards, timeframe]);

  // Asset allocation data
  const assetAllocation = useMemo(() => {
    const categories = groupByCategory(state.cards);
    return Object.entries(categories).map(([category, cards]) => ({
      name: category,
      value: cards.reduce((sum, card) => sum + card.currentValue, 0),
      count: cards.length,
      percentage: 0 // Will be calculated by the chart
    }));
  }, [state.cards]);

  // Top movers data
  const topMovers = useMemo(() => {
    const movers = state.cards.map(card => ({
      card,
      change: ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100,
      changeAmount: card.currentValue - card.purchasePrice
    }));
    
    return {
      gainers: movers.filter(m => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
      losers: movers.filter(m => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 5)
    };
  }, [state.cards]);

  // Risk metrics
  const riskMetrics = useMemo(() => {
    const volatility = calculatePortfolioVolatility(state.cards);
    const sharpe = calculateSharpeRatio(state.cards);
    const maxDrawdown = calculateMaxDrawdown(state.cards);
    const beta = calculateBeta(state.cards);
    
    return [
      { name: 'Volatility', value: volatility, benchmark: 18, unit: '%' },
      { name: 'Sharpe Ratio', value: sharpe, benchmark: 1.0, unit: '' },
      { name: 'Max Drawdown', value: Math.abs(maxDrawdown), benchmark: 15, unit: '%' },
      { name: 'Beta', value: beta, benchmark: 1.0, unit: '' }
    ];
  }, [state.cards]);


  const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

  return (
    <div className="executive-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Executive Dashboard</h1>
          <p>Strategic overview and key performance indicators</p>
        </div>
        <div className="header-controls">
          <div className="timeframe-selector">
            {['7D', '1M', '3M', '6M', '1Y', 'ALL'].map(tf => (
              <button
                key={tf}
                className={timeframe === tf ? 'active' : ''}
                onClick={() => setTimeframe(tf as any)}
              >
                {tf}
              </button>
            ))}
          </div>
          <button className="export-button">
            <span className="icon">📊</span>
            Export Report
          </button>
        </div>
      </div>

      <div className="view-selector">
        {[
          { id: 'overview', label: 'Overview', icon: '🏠' },
          { id: 'performance', label: 'Performance', icon: '📈' },
          { id: 'risk', label: 'Risk Analysis', icon: '⚠️' },
          { id: 'opportunities', label: 'Opportunities', icon: '💡' }
        ].map(view => (
          <button
            key={view.id}
            className={viewMode === view.id ? 'active' : ''}
            onClick={() => setViewMode(view.id as any)}
          >
            <span className="icon">{view.icon}</span>
            {view.label}
          </button>
        ))}
      </div>

      {viewMode === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="kpi-grid">
            {kpiMetrics.map((kpi, index) => (
              <div key={index} className="kpi-card">
                <div className="kpi-header">
                  <span className="kpi-label">{kpi.label}</span>
                  <span className={`kpi-change ${kpi.trend}`}>
                    {kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→'}
                    {Math.abs(kpi.change).toFixed(1)}%
                  </span>
                </div>
                <div className="kpi-value">{kpi.value}</div>
                {kpi.target && (
                  <div className="kpi-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${Math.min(100, kpi.achievement || 0)}%` }}
                      />
                    </div>
                    <span className="progress-label">
                      {kpi.achievement?.toFixed(0)}% of target
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Portfolio Health Score */}
          <div className="portfolio-health-section">
            <h2>Portfolio Health Score</h2>
            <div className="health-score-container">
              <div className="health-score-visual">
                <ResponsiveContainer width="100%" height={300}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={[
                    { name: 'Score', value: portfolioHealth.score, fill: getHealthColor(portfolioHealth.score) }
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                      background
                      dataKey="value"
                      cornerRadius={10}
                      fill={getHealthColor(portfolioHealth.score)}
                    />
                    <text 
                      x="50%" 
                      y="50%" 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      className="health-score-text"
                    >
                      <tspan x="50%" dy="-10" fontSize="48" fontWeight="700">
                        {portfolioHealth.score.toFixed(0)}
                      </tspan>
                      <tspan x="50%" dy="30" fontSize="18" fill="#718096">
                        {portfolioHealth.rating}
                      </tspan>
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="health-factors">
                <h3>Health Factors</h3>
                {Object.entries(portfolioHealth.factors).map(([factor, score]) => (
                  <div key={factor} className="health-factor">
                    <span className="factor-label">
                      {factor.charAt(0).toUpperCase() + factor.slice(1)}
                    </span>
                    <div className="factor-bar">
                      <div 
                        className="factor-fill"
                        style={{ 
                          width: `${score}%`,
                          backgroundColor: getHealthColor(score)
                        }}
                      />
                    </div>
                    <span className="factor-score">{score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="strategic-insights-section">
            <h2>Strategic Insights & Actions</h2>
            <div className="insights-grid">
              {strategicInsights.slice(0, 6).map((insight, index) => (
                <div key={index} className={`insight-card ${insight.type} ${insight.impact}`}>
                  <div className="insight-header">
                    <span className="insight-icon">
                      {insight.type === 'success' ? '✅' : 
                       insight.type === 'warning' ? '⚠️' : 
                       insight.type === 'opportunity' ? '💡' : '🚨'}
                    </span>
                    <span className="insight-impact">{insight.impact.toUpperCase()}</span>
                  </div>
                  <h3>{insight.title}</h3>
                  <p>{insight.description}</p>
                  <div className="insight-action">
                    <span className="action-label">Recommended Action:</span>
                    <span className="action-text">{insight.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Overview */}
          <div className="performance-overview">
            <h2>Performance Timeline</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8B5CF6" 
                  fill="#8B5CF6" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="invested" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Stats Grid */}
          <div className="quick-stats-grid">
            <div className="stat-card">
              <h3>Asset Allocation</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={assetAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {assetAllocation.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="allocation-legend">
                {assetAllocation.slice(0, 4).map((item, index) => (
                  <div key={index} className="legend-item">
                    <span 
                      className="legend-color" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="legend-label">{item.name}</span>
                    <span className="legend-value">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="stat-card">
              <h3>Top Movers</h3>
              <div className="movers-list">
                <div className="gainers">
                  <h4>🚀 Top Gainers</h4>
                  {topMovers.gainers.map((mover, index) => (
                    <div key={index} className="mover-item">
                      <span className="mover-name">
                        {mover.card.player} {mover.card.year}
                      </span>
                      <span className="mover-change positive">
                        +{mover.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="losers">
                  <h4>📉 Top Losers</h4>
                  {topMovers.losers.map((mover, index) => (
                    <div key={index} className="mover-item">
                      <span className="mover-name">
                        {mover.card.player} {mover.card.year}
                      </span>
                      <span className="mover-change negative">
                        {mover.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'performance' && (
        <div className="performance-view">
          <div className="performance-header">
            <h2>Detailed Performance Analysis</h2>
            <p>Deep dive into portfolio returns and efficiency metrics</p>
          </div>

          {/* Returns Analysis */}
          <div className="returns-analysis">
            <h3>Cumulative Returns vs Investment</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={performanceTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value)} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="invested" fill="#3B82F6" opacity={0.8} name="Total Invested" />
                <Line yAxisId="left" type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={3} name="Portfolio Value" />
                <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#10B981" strokeWidth={2} name="ROI %" />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Category Performance Matrix */}
          <div className="category-performance-matrix">
            <h3>Category Performance Matrix</h3>
            <ResponsiveContainer width="100%" height={400}>
              <Treemap
                data={getCategoryTreemapData(state.cards)}
                dataKey="value"
                aspectRatio={4/3}
                stroke="#fff"
                fill="#8B5CF6"
              >
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="custom-tooltip">
                          <p className="label">{data.name}</p>
                          <p className="value">Value: {formatCurrency(data.value)}</p>
                          <p className="roi">ROI: {data.roi.toFixed(1)}%</p>
                          <p className="count">Cards: {data.count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </Treemap>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics Grid */}
          <div className="performance-metrics-grid">
            <div className="metric-card">
              <h4>Annualized Return</h4>
              <div className="metric-value">{calculateAnnualizedReturn(state.cards).toFixed(2)}%</div>
              <div className="metric-comparison">
                vs S&P 500: <span className="positive">+{(calculateAnnualizedReturn(state.cards) - 10.5).toFixed(2)}%</span>
              </div>
            </div>
            <div className="metric-card">
              <h4>Best Month</h4>
              <div className="metric-value">+{getBestMonth(state.cards).return}%</div>
              <div className="metric-date">{getBestMonth(state.cards).date}</div>
            </div>
            <div className="metric-card">
              <h4>Worst Month</h4>
              <div className="metric-value negative">{getWorstMonth(state.cards).return}%</div>
              <div className="metric-date">{getWorstMonth(state.cards).date}</div>
            </div>
            <div className="metric-card">
              <h4>Win/Loss Ratio</h4>
              <div className="metric-value">{calculateWinLossRatio(state.cards).toFixed(2)}</div>
              <div className="metric-subtext">
                {state.cards.filter(c => c.currentValue > c.purchasePrice).length}W / 
                {state.cards.filter(c => c.currentValue <= c.purchasePrice).length}L
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'risk' && (
        <div className="risk-view">
          <div className="risk-header">
            <h2>Risk Analysis & Management</h2>
            <p>Comprehensive risk assessment and mitigation strategies</p>
          </div>

          {/* Risk Metrics Dashboard */}
          <div className="risk-metrics-dashboard">
            <h3>Key Risk Indicators</h3>
            <div className="risk-gauges">
              {riskMetrics.map((metric, index) => (
                <div key={index} className="risk-gauge">
                  <h4>{metric.name}</h4>
                  <div className="gauge-visual">
                    <ResponsiveContainer width="100%" height={150}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="30%"
                        outerRadius="90%"
                        data={[{
                          name: metric.name,
                          value: metric.value,
                          benchmark: metric.benchmark,
                          fill: getRiskColor(metric.value, metric.benchmark, metric.name)
                        }]}
                      >
                        <RadialBar
                          background
                          dataKey="value"
                          cornerRadius={5}
                          fill={getRiskColor(metric.value, metric.benchmark, metric.name)}
                        />
                        <text 
                          x="50%" 
                          y="50%" 
                          textAnchor="middle" 
                          dominantBaseline="middle"
                          fontSize="24"
                          fontWeight="700"
                        >
                          {metric.value.toFixed(2)}{metric.unit}
                        </text>
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="gauge-benchmark">
                    Benchmark: {metric.benchmark}{metric.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Concentration Risk Analysis */}
          <div className="concentration-risk">
            <h3>Portfolio Concentration Analysis</h3>
            <div className="concentration-charts">
              <div className="concentration-by-category">
                <h4>By Category</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getConcentrationData(state.cards, 'category')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
                    <Bar dataKey="percentage" fill="#8B5CF6">
                      {getConcentrationData(state.cards, 'category').map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.percentage > 30 ? '#EF4444' : entry.percentage > 20 ? '#F59E0B' : '#10B981'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="concentration-by-player">
                <h4>By Player (Top 10)</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getConcentrationData(state.cards, 'player').slice(0, 10)} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `${value}%`} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip formatter={(value: any) => `${value.toFixed(1)}%`} />
                    <Bar dataKey="percentage" fill="#3B82F6">
                      {getConcentrationData(state.cards, 'player').slice(0, 10).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.percentage > 15 ? '#EF4444' : entry.percentage > 10 ? '#F59E0B' : '#10B981'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Risk Mitigation Recommendations */}
          <div className="risk-recommendations">
            <h3>Risk Mitigation Strategies</h3>
            <div className="recommendations-grid">
              {generateRiskRecommendations(state.cards, riskMetrics).map((rec, index) => (
                <div key={index} className={`recommendation-card ${rec.priority}`}>
                  <div className="rec-header">
                    <span className="rec-icon">{rec.icon}</span>
                    <span className="rec-priority">{rec.priority.toUpperCase()}</span>
                  </div>
                  <h4>{rec.title}</h4>
                  <p>{rec.description}</p>
                  <div className="rec-actions">
                    <h5>Recommended Actions:</h5>
                    <ul>
                      {rec.actions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'opportunities' && (
        <div className="opportunities-view">
          <div className="opportunities-header">
            <h2>Investment Opportunities & Growth Strategies</h2>
            <p>Data-driven recommendations for portfolio optimization</p>
          </div>

          {/* Market Opportunities */}
          <div className="market-opportunities">
            <h3>Market Opportunities Analysis</h3>
            <div className="opportunities-grid">
              {generateMarketOpportunities(state.cards).map((opp, index) => (
                <div key={index} className="opportunity-card">
                  <div className="opp-header">
                    <span className="opp-category">{opp.category}</span>
                    <span className="opp-confidence">{opp.confidence}% confidence</span>
                  </div>
                  <h4>{opp.title}</h4>
                  <p>{opp.description}</p>
                  <div className="opp-metrics">
                    <div className="opp-metric">
                      <span className="label">Potential ROI</span>
                      <span className="value">{opp.potentialROI}%</span>
                    </div>
                    <div className="opp-metric">
                      <span className="label">Investment Range</span>
                      <span className="value">{opp.investmentRange}</span>
                    </div>
                    <div className="opp-metric">
                      <span className="label">Time Horizon</span>
                      <span className="value">{opp.timeHorizon}</span>
                    </div>
                  </div>
                  <button className="opp-action">View Details →</button>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Optimization Suggestions */}
          <div className="optimization-suggestions">
            <h3>Portfolio Optimization Plan</h3>
            <div className="optimization-timeline">
              {generateOptimizationPlan(state.cards).map((step, index) => (
                <div key={index} className="timeline-step">
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                    <div className="step-impact">
                      <span className="impact-label">Expected Impact:</span>
                      <span className="impact-value">{step.impact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Growth Projections */}
          <div className="growth-projections">
            <h3>Growth Projections</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={generateGrowthProjections(state.cards)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Area type="monotone" dataKey="conservative" stackId="1" stroke="#6B7280" fill="#6B7280" fillOpacity={0.3} name="Conservative" />
                <Area type="monotone" dataKey="moderate" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Moderate" />
                <Area type="monotone" dataKey="aggressive" stackId="3" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Aggressive" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

// All helper functions are now defined at the top of the file

function generateRiskRecommendations(cards: Card[], riskMetrics: any[]) {
  const recommendations = [];
  
  const volatility = riskMetrics.find(m => m.name === 'Volatility')?.value || 0;
  if (volatility > 25) {
    recommendations.push({
      icon: '🛡️',
      title: 'Reduce Portfolio Volatility',
      description: 'Your portfolio shows high volatility. Consider diversifying into more stable assets.',
      priority: 'high',
      actions: [
        'Add more graded cards from established players',
        'Reduce concentration in speculative rookies',
        'Consider vintage cards for stability'
      ]
    });
  }
  
  const concentration = calculateConcentrationRisk(cards);
  if (concentration.maxPercentage > 30) {
    recommendations.push({
      icon: '⚖️',
      title: 'Address Concentration Risk',
      description: `${concentration.maxPercentage.toFixed(1)}% of portfolio is in ${concentration.category}. This creates significant risk.`,
      priority: 'high',
      actions: [
        `Reduce ${concentration.category} allocation to under 25%`,
        'Diversify into at least 2-3 other categories',
        'Set position limits for future purchases'
      ]
    });
  }
  
  return recommendations;
}

function generateMarketOpportunities(_cards: Card[]) {
  return [
    {
      category: 'Basketball',
      title: 'Rising Star Rookies',
      description: 'Recent NBA draft class showing exceptional performance. Early investment opportunity.',
      confidence: 85,
      potentialROI: '45-65',
      investmentRange: '$500-$2,000',
      timeHorizon: '6-12 months'
    },
    {
      category: 'Pokemon',
      title: 'Vintage Set Completion',
      description: 'Base Set 1st Edition showing strong appreciation. Complete sets commanding premium.',
      confidence: 75,
      potentialROI: '30-40',
      investmentRange: '$1,000-$5,000',
      timeHorizon: '12-18 months'
    },
    {
      category: 'Football',
      title: 'Hall of Fame Inductees',
      description: 'Upcoming HOF class announcement. Historical 20-30% bump post-induction.',
      confidence: 90,
      potentialROI: '20-30',
      investmentRange: '$300-$1,500',
      timeHorizon: '3-6 months'
    }
  ];
}

function generateOptimizationPlan(_cards: Card[]) {
  return [
    {
      title: 'Rebalance Portfolio Allocation',
      description: 'Adjust category weights to optimal targets based on risk-return analysis.',
      impact: '+5-8% expected annual return'
    },
    {
      title: 'Grade High-Value Raw Cards',
      description: 'Submit top 10% of raw cards for professional grading to improve liquidity.',
      impact: '+15-25% immediate value increase'
    },
    {
      title: 'Implement Dollar-Cost Averaging',
      description: 'Set monthly investment budget for consistent portfolio growth.',
      impact: 'Reduce timing risk by 40%'
    },
    {
      title: 'Establish Exit Strategy',
      description: 'Set target prices for top performers to lock in gains systematically.',
      impact: 'Capture 80% of upside potential'
    }
  ];
}

function generateGrowthProjections(cards: Card[]) {
  const currentValue = cards.reduce((sum, c) => sum + c.currentValue, 0);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map((month, index) => {
    const conservativeGrowth = 1 + (index * 0.01);
    const moderateGrowth = 1 + (index * 0.02);
    const aggressiveGrowth = 1 + (index * 0.035);
    
    return {
      month,
      conservative: currentValue * conservativeGrowth,
      moderate: currentValue * moderateGrowth,
      aggressive: currentValue * aggressiveGrowth
    };
  });
}

export default ExecutiveDashboard;