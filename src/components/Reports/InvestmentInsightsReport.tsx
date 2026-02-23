import React, { useState, useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, Treemap
} from 'recharts';
import './InvestmentInsightsReport.css';

interface InvestmentMetrics {
  totalInvestment: number;
  currentPortfolioValue: number;
  totalReturn: number;
  returnPercentage: number;
  annualizedReturn: number;
  averageHoldingPeriod: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  sharpeRatio: number;
  volatility: number;
  bestInvestmentPeriod: string;
  worstInvestmentPeriod: string;
}

interface CategoryInsight {
  category: string;
  roi: number;
  winRate: number;
  averageHoldingDays: number;
  totalCards: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Reduce' | 'Sell';
  trend: 'up' | 'down' | 'stable';
}

interface PlayerInsight {
  player: string;
  totalInvested: number;
  currentValue: number;
  roi: number;
  cardCount: number;
  averageCardValue: number;
  momentum: number;
  recommendation: string;
}

interface RiskMetrics {
  portfolioRisk: 'Low' | 'Medium' | 'High';
  diversificationScore: number;
  concentrationRisk: Array<{ type: string; name: string; percentage: number }>;
  liquidityScore: number;
}

const InvestmentInsightsReport: React.FC = () => {
  const { state } = useCards();
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'overview' | 'opportunities' | 'risk' | 'forecast'>('overview');

  const metrics = useMemo((): InvestmentMetrics => {
    const cards = state.cards;
    const totalInvestment = cards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const currentPortfolioValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
    const totalReturn = currentPortfolioValue - totalInvestment;
    const returnPercentage = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;

    // Calculate average holding period
    const averageHoldingPeriod = cards.reduce((sum, card) => {
      const days = Math.floor((new Date().getTime() - new Date(card.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0) / cards.length;

    // Calculate win rate
    const profitableCards = cards.filter(card => card.currentValue > card.purchasePrice);
    const winRate = (profitableCards.length / cards.length) * 100;

    // Calculate average win/loss
    const wins = profitableCards.map(card => ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100);
    const losses = cards.filter(card => card.currentValue <= card.purchasePrice)
      .map(card => ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100);

    const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

    // Calculate annualized return
    const yearsHeld = averageHoldingPeriod / 365;
    const annualizedReturn = yearsHeld > 0 ? (Math.pow(1 + returnPercentage / 100, 1 / yearsHeld) - 1) * 100 : 0;

    // Calculate volatility (simplified)
    const returns = cards.map(card => ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);

    // Calculate Sharpe Ratio (simplified - assuming risk-free rate of 2%)
    const riskFreeRate = 2;
    const sharpeRatio = volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;

    // Find best and worst investment periods
    const monthlyData = getMonthlyInvestmentData(cards);
    const bestMonth = monthlyData.reduce((best, month) => 
      month.roi > best.roi ? month : best, monthlyData[0] || { month: 'N/A', roi: 0 });
    const worstMonth = monthlyData.reduce((worst, month) => 
      month.roi < worst.roi ? month : worst, monthlyData[0] || { month: 'N/A', roi: 0 });

    return {
      totalInvestment,
      currentPortfolioValue,
      totalReturn,
      returnPercentage,
      annualizedReturn,
      averageHoldingPeriod,
      winRate,
      averageWin,
      averageLoss,
      sharpeRatio,
      volatility,
      bestInvestmentPeriod: bestMonth.month,
      worstInvestmentPeriod: worstMonth.month
    };
  }, [state.cards]);

  const categoryInsights = useMemo((): CategoryInsight[] => {
    const categories = groupByCategory(state.cards);
    
    return Object.entries(categories).map(([category, cards]) => {
      const totalInvested = cards.reduce((sum, card) => sum + card.purchasePrice, 0);
      const currentValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
      const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
      
      const profitableCards = cards.filter(card => card.currentValue > card.purchasePrice);
      const winRate = (profitableCards.length / cards.length) * 100;
      
      const averageHoldingDays = cards.reduce((sum, card) => {
        const days = Math.floor((new Date().getTime() - new Date(card.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / cards.length;

      // Calculate momentum (simplified - based on recent performance)
      const recentCards = cards.filter(card => {
        const daysSincePurchase = Math.floor((new Date().getTime() - new Date(card.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
        return daysSincePurchase <= 90;
      });
      const recentROI = recentCards.length > 0 ? calculateAverageROI(recentCards) : roi;
      const momentum = recentROI - roi;

      // Determine recommendation
      let recommendation: CategoryInsight['recommendation'];
      if (roi > 50 && winRate > 70 && momentum > 0) recommendation = 'Strong Buy';
      else if (roi > 20 && winRate > 60) recommendation = 'Buy';
      else if (roi > 0 && winRate > 50) recommendation = 'Hold';
      else if (roi < -10 || winRate < 40) recommendation = 'Sell';
      else recommendation = 'Reduce';

      const trend: 'up' | 'down' | 'stable' = momentum > 5 ? 'up' : momentum < -5 ? 'down' : 'stable';

      return {
        category,
        roi,
        winRate,
        averageHoldingDays,
        totalCards: cards.length,
        recommendation,
        trend
      };
    }).sort((a, b) => b.roi - a.roi);
  }, [state.cards]);

  const playerInsights = useMemo((): PlayerInsight[] => {
    const players = groupByPlayer(state.cards);
    
    return Object.entries(players)
      .map(([player, cards]) => {
        const totalInvested = cards.reduce((sum, card) => sum + card.purchasePrice, 0);
        const currentValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
        const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
        
        // Calculate momentum
        const valueChanges = cards.map(card => {
          const holdingDays = Math.floor((new Date().getTime() - new Date(card.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
          const dailyReturn = holdingDays > 0 ? ((card.currentValue - card.purchasePrice) / card.purchasePrice) / holdingDays : 0;
          return dailyReturn;
        });
        const momentum = valueChanges.reduce((a, b) => a + b, 0) / valueChanges.length * 100;

        let recommendation = '';
        if (roi > 50 && momentum > 0.1) recommendation = '🔥 Hot Investment';
        else if (roi > 20) recommendation = '📈 Strong Performer';
        else if (roi > 0) recommendation = '✅ Positive Returns';
        else if (roi > -10) recommendation = '⚠️ Monitor Closely';
        else recommendation = '📉 Consider Selling';

        return {
          player,
          totalInvested,
          currentValue,
          roi,
          cardCount: cards.length,
          averageCardValue: currentValue / cards.length,
          momentum,
          recommendation
        };
      })
      .filter(insight => insight.cardCount >= 2) // Only show players with multiple cards
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 20); // Top 20 players
  }, [state.cards]);

  const riskMetrics = useMemo((): RiskMetrics => {
    // Calculate portfolio risk based on volatility and concentration
    const volatility = metrics.volatility;
    const portfolioRisk = volatility < 20 ? 'Low' : volatility < 40 ? 'Medium' : 'High';

    // Calculate diversification score (0-100)
    const categories = groupByCategory(state.cards);
    const categoryCount = Object.keys(categories).length;
    const playerCount = new Set(state.cards.map(c => c.player)).size;
    const brandCount = new Set(state.cards.map(c => c.brand)).size;
    
    const diversificationScore = Math.min(100, (categoryCount * 10 + playerCount * 2 + brandCount * 3));

    // Identify concentration risks
    const totalValue = state.cards.reduce((sum, card) => sum + card.currentValue, 0);
    const concentrationRisk: RiskMetrics['concentrationRisk'] = [];

    // Check category concentration
    Object.entries(categories).forEach(([category, cards]) => {
      const categoryValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
      const percentage = (categoryValue / totalValue) * 100;
      if (percentage > 40) {
        concentrationRisk.push({ type: 'Category', name: category, percentage });
      }
    });

    // Check player concentration
    const players = groupByPlayer(state.cards);
    Object.entries(players).forEach(([player, cards]) => {
      const playerValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
      const percentage = (playerValue / totalValue) * 100;
      if (percentage > 25) {
        concentrationRisk.push({ type: 'Player', name: player, percentage });
      }
    });

    // Calculate liquidity score (based on graded cards and popular categories)
    const gradedCards = state.cards.filter(c => c.gradingCompany).length;
    const popularCategories = state.cards.filter(c => 
      ['Basketball', 'Football', 'Baseball'].includes(c.category)
    ).length;
    const liquidityScore = Math.min(100, 
      (gradedCards / state.cards.length) * 50 + 
      (popularCategories / state.cards.length) * 50
    );

    return {
      portfolioRisk,
      diversificationScore,
      concentrationRisk,
      liquidityScore
    };
  }, [state.cards, metrics.volatility]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="investment-insights-report">
      <div className="report-header">
        <div>
          <h2>Investment Insights & Analysis</h2>
          <p>Advanced analytics and recommendations for your card portfolio</p>
        </div>
        <div className="header-controls">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="timeframe-selector"
          >
            <option value="1M">1 Month</option>
            <option value="3M">3 Months</option>
            <option value="6M">6 Months</option>
            <option value="1Y">1 Year</option>
            <option value="ALL">All Time</option>
          </select>
          <button className="export-button">Export Report</button>
        </div>
      </div>

      <div className="view-tabs">
        <button 
          className={viewMode === 'overview' ? 'active' : ''}
          onClick={() => setViewMode('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={viewMode === 'opportunities' ? 'active' : ''}
          onClick={() => setViewMode('opportunities')}
        >
          💡 Opportunities
        </button>
        <button 
          className={viewMode === 'risk' ? 'active' : ''}
          onClick={() => setViewMode('risk')}
        >
          ⚠️ Risk Analysis
        </button>
        <button 
          className={viewMode === 'forecast' ? 'active' : ''}
          onClick={() => setViewMode('forecast')}
        >
          🔮 Forecast
        </button>
      </div>

      {viewMode === 'overview' && (
        <>
          <div className="key-metrics">
            <div className="metric-card highlight">
              <h4>Portfolio Value</h4>
              <div className="metric-value">{formatCurrency(metrics.currentPortfolioValue)}</div>
              <div className="metric-change positive">
                {formatPercentage(metrics.returnPercentage)}
              </div>
            </div>
            <div className="metric-card">
              <h4>Total Return</h4>
              <div className="metric-value">{formatCurrency(metrics.totalReturn)}</div>
              <div className="metric-subtext">on {formatCurrency(metrics.totalInvestment)} invested</div>
            </div>
            <div className="metric-card">
              <h4>Annualized Return</h4>
              <div className="metric-value">{formatPercentage(metrics.annualizedReturn)}</div>
              <div className="metric-subtext">vs S&P 500: +8.5%</div>
            </div>
            <div className="metric-card">
              <h4>Win Rate</h4>
              <div className="metric-value">{metrics.winRate.toFixed(1)}%</div>
              <div className="metric-subtext">
                Avg Win: {formatPercentage(metrics.averageWin)} | 
                Avg Loss: {formatPercentage(metrics.averageLoss)}
              </div>
            </div>
            <div className="metric-card">
              <h4>Sharpe Ratio</h4>
              <div className="metric-value">{metrics.sharpeRatio.toFixed(2)}</div>
              <div className="metric-subtext">Risk-adjusted returns</div>
            </div>
            <div className="metric-card">
              <h4>Portfolio Risk</h4>
              <div className={`metric-value risk-${riskMetrics.portfolioRisk.toLowerCase()}`}>
                {riskMetrics.portfolioRisk}
              </div>
              <div className="metric-subtext">Volatility: {metrics.volatility.toFixed(1)}%</div>
            </div>
          </div>

          <div className="performance-chart">
            <h3>Portfolio Performance Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getPerformanceData(state.cards)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="invested" stroke="#8884d8" name="Total Invested" />
                <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Portfolio Value" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="category-performance">
            <h3>Category Performance Analysis</h3>
            <div className="category-cards">
              {categoryInsights.map((insight) => (
                <div key={insight.category} className="category-insight-card">
                  <div className="category-header">
                    <h4>{insight.category}</h4>
                    <span className={`trend-indicator ${insight.trend}`}>
                      {insight.trend === 'up' ? '📈' : insight.trend === 'down' ? '📉' : '➡️'}
                    </span>
                  </div>
                  <div className="category-metrics">
                    <div className="category-metric">
                      <span>ROI</span>
                      <span className={insight.roi >= 0 ? 'positive' : 'negative'}>
                        {formatPercentage(insight.roi)}
                      </span>
                    </div>
                    <div className="category-metric">
                      <span>Win Rate</span>
                      <span>{insight.winRate.toFixed(1)}%</span>
                    </div>
                    <div className="category-metric">
                      <span>Cards</span>
                      <span>{insight.totalCards}</span>
                    </div>
                  </div>
                  <div className={`recommendation ${insight.recommendation.toLowerCase().replace(' ', '-')}`}>
                    {insight.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {viewMode === 'opportunities' && (
        <>
          <div className="investment-opportunities">
            <div className="opportunity-section">
              <h3>🔥 Hot Players to Watch</h3>
              <div className="player-insights">
                {playerInsights.slice(0, 10).map((player) => (
                  <div key={player.player} className="player-card">
                    <div className="player-header">
                      <h4>{player.player}</h4>
                      <span className="player-recommendation">{player.recommendation}</span>
                    </div>
                    <div className="player-metrics">
                      <div className="player-metric">
                        <span>ROI</span>
                        <span className={player.roi >= 0 ? 'positive' : 'negative'}>
                          {formatPercentage(player.roi)}
                        </span>
                      </div>
                      <div className="player-metric">
                        <span>Total Value</span>
                        <span>{formatCurrency(player.currentValue)}</span>
                      </div>
                      <div className="player-metric">
                        <span>Cards</span>
                        <span>{player.cardCount}</span>
                      </div>
                      <div className="player-metric">
                        <span>Momentum</span>
                        <span className={player.momentum >= 0 ? 'positive' : 'negative'}>
                          {player.momentum >= 0 ? '↑' : '↓'} {Math.abs(player.momentum).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="opportunity-section">
              <h3>💰 Value Opportunities</h3>
              <div className="value-chart">
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="holdingDays" name="Days Held" />
                    <YAxis dataKey="roi" name="ROI %" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter 
                      name="Cards" 
                      data={getScatterData(state.cards)} 
                      fill="#8884d8"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="opportunity-section">
              <h3>📊 Category Recommendations</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={getCategoryRadarData(categoryInsights)}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="ROI Score" dataKey="roiScore" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  <Radar name="Win Rate" dataKey="winRate" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {viewMode === 'risk' && (
        <>
          <div className="risk-analysis">
            <div className="risk-overview">
              <div className="risk-score-card">
                <h3>Portfolio Risk Assessment</h3>
                <div className={`risk-level ${riskMetrics.portfolioRisk.toLowerCase()}`}>
                  {riskMetrics.portfolioRisk} Risk
                </div>
                <div className="risk-metrics">
                  <div className="risk-metric">
                    <span>Diversification Score</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${riskMetrics.diversificationScore}%` }}
                      />
                    </div>
                    <span>{riskMetrics.diversificationScore}/100</span>
                  </div>
                  <div className="risk-metric">
                    <span>Liquidity Score</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${riskMetrics.liquidityScore}%` }}
                      />
                    </div>
                    <span>{riskMetrics.liquidityScore}/100</span>
                  </div>
                </div>
              </div>
            </div>

            {riskMetrics.concentrationRisk.length > 0 && (
              <div className="concentration-risks">
                <h3>⚠️ Concentration Risks Detected</h3>
                <div className="risk-alerts">
                  {riskMetrics.concentrationRisk.map((risk, index) => (
                    <div key={index} className="risk-alert">
                      <strong>{risk.type}: {risk.name}</strong>
                      <span>{risk.percentage.toFixed(1)}% of portfolio</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="portfolio-allocation">
              <h3>Portfolio Allocation</h3>
              <div className="allocation-charts">
                <div className="pie-chart-container">
                  <h4>By Category</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getCategoryPieData(state.cards)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {getCategoryPieData(state.cards).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="treemap-container">
                  <h4>Value Distribution</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <Treemap
                      data={getTreemapData(state.cards)}
                      dataKey="value"
                      aspectRatio={4 / 3}
                      stroke="#fff"
                      fill="#8884d8"
                    />
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {viewMode === 'forecast' && (
        <>
          <div className="forecast-section">
            <h3>🔮 Portfolio Forecast & Projections</h3>
            <div className="forecast-disclaimer">
              <p>⚠️ These projections are based on historical performance and should not be considered financial advice.</p>
            </div>

            <div className="projection-cards">
              <div className="projection-card">
                <h4>6 Month Projection</h4>
                <div className="projection-value">
                  {formatCurrency(metrics.currentPortfolioValue * (1 + metrics.annualizedReturn / 200))}
                </div>
                <div className="projection-range">
                  <span>Low: {formatCurrency(metrics.currentPortfolioValue * 0.95)}</span>
                  <span>High: {formatCurrency(metrics.currentPortfolioValue * 1.15)}</span>
                </div>
              </div>
              <div className="projection-card">
                <h4>1 Year Projection</h4>
                <div className="projection-value">
                  {formatCurrency(metrics.currentPortfolioValue * (1 + metrics.annualizedReturn / 100))}
                </div>
                <div className="projection-range">
                  <span>Low: {formatCurrency(metrics.currentPortfolioValue * 0.90)}</span>
                  <span>High: {formatCurrency(metrics.currentPortfolioValue * 1.30)}</span>
                </div>
              </div>
              <div className="projection-card">
                <h4>Best Case (1Y)</h4>
                <div className="projection-value">
                  {formatCurrency(metrics.currentPortfolioValue * 1.5)}
                </div>
                <div className="projection-subtext">
                  If trends continue at peak performance
                </div>
              </div>
            </div>

            <div className="scenario-analysis">
              <h3>Scenario Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getScenarioData(metrics)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="current" stroke="#8884d8" name="Current Trajectory" />
                  <Line type="monotone" dataKey="optimistic" stroke="#82ca9d" name="Optimistic" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="pessimistic" stroke="#ff7300" name="Pessimistic" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="recommendations">
              <h3>💡 Strategic Recommendations</h3>
              <div className="recommendation-cards">
                {generateRecommendations(metrics, categoryInsights, riskMetrics).map((rec, index) => (
                  <div key={index} className={`recommendation-card ${rec.priority}`}>
                    <div className="rec-icon">{rec.icon}</div>
                    <div className="rec-content">
                      <h4>{rec.title}</h4>
                      <p>{rec.description}</p>
                      <div className="rec-action">{rec.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper functions
function groupByCategory(cards: Card[]): Record<string, Card[]> {
  return cards.reduce((acc, card) => {
    if (!acc[card.category]) acc[card.category] = [];
    acc[card.category].push(card);
    return acc;
  }, {} as Record<string, Card[]>);
}

function groupByPlayer(cards: Card[]): Record<string, Card[]> {
  return cards.reduce((acc, card) => {
    if (!acc[card.player]) acc[card.player] = [];
    acc[card.player].push(card);
    return acc;
  }, {} as Record<string, Card[]>);
}

function calculateAverageROI(cards: Card[]): number {
  const totalROI = cards.reduce((sum, card) => {
    const roi = card.purchasePrice > 0 ? ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100 : 0;
    return sum + roi;
  }, 0);
  return totalROI / cards.length;
}

function getMonthlyInvestmentData(cards: Card[]): Array<{ month: string; roi: number }> {
  const monthlyData: Record<string, { invested: number; value: number }> = {};
  
  cards.forEach(card => {
    const month = new Date(card.purchaseDate).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { invested: 0, value: 0 };
    }
    monthlyData[month].invested += card.purchasePrice;
    monthlyData[month].value += card.currentValue;
  });

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    roi: data.invested > 0 ? ((data.value - data.invested) / data.invested) * 100 : 0
  }));
}

function getPerformanceData(cards: Card[]) {
  const monthlyData: Record<string, { invested: number; value: number }> = {};
  
  cards.forEach(card => {
    const purchaseMonth = new Date(card.purchaseDate).toISOString().slice(0, 7);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // Add to purchase month and all subsequent months
    let month = purchaseMonth;
    while (month <= currentMonth) {
      if (!monthlyData[month]) {
        monthlyData[month] = { invested: 0, value: 0 };
      }
      monthlyData[month].invested += card.purchasePrice;
      monthlyData[month].value += card.currentValue;
      
      // Increment month
      const [year, monthNum] = month.split('-').map(Number);
      if (monthNum === 12) {
        month = `${year + 1}-01`;
      } else {
        month = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
      }
    }
  });

  return Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      invested: data.invested,
      value: data.value
    }));
}

function getScatterData(cards: Card[]) {
  return cards.map(card => {
    const holdingDays = Math.floor((new Date().getTime() - new Date(card.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    const roi = card.purchasePrice > 0 ? ((card.currentValue - card.purchasePrice) / card.purchasePrice) * 100 : 0;
    return { holdingDays, roi, player: card.player };
  });
}

function getCategoryRadarData(insights: CategoryInsight[]) {
  return insights.map(insight => ({
    category: insight.category,
    roiScore: Math.min(100, Math.max(0, insight.roi + 50)), // Normalize ROI to 0-100
    winRate: insight.winRate
  }));
}

function getCategoryPieData(cards: Card[]) {
  const categories = groupByCategory(cards);
  return Object.entries(categories).map(([category, categoryCards]) => ({
    name: category,
    value: categoryCards.reduce((sum, card) => sum + card.currentValue, 0)
  }));
}

function getTreemapData(cards: Card[]) {
  const categories = groupByCategory(cards);
  return Object.entries(categories).map(([category, categoryCards]) => ({
    name: category,
    children: categoryCards.map(card => ({
      name: `${card.player} ${card.year}`,
      value: card.currentValue
    }))
  }));
}

function getScenarioData(metrics: InvestmentMetrics) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentValue = metrics.currentPortfolioValue;
  const monthlyGrowth = metrics.annualizedReturn / 12 / 100;
  
  return months.map((month, index) => ({
    month,
    current: currentValue * Math.pow(1 + monthlyGrowth, index),
    optimistic: currentValue * Math.pow(1 + monthlyGrowth * 1.5, index),
    pessimistic: currentValue * Math.pow(1 + monthlyGrowth * 0.5, index)
  }));
}

function generateRecommendations(
  metrics: InvestmentMetrics, 
  categoryInsights: CategoryInsight[], 
  riskMetrics: RiskMetrics
) {
  const recommendations = [];

  // Diversification recommendation
  if (riskMetrics.diversificationScore < 50) {
    recommendations.push({
      icon: '🎯',
      title: 'Improve Diversification',
      description: 'Your portfolio is too concentrated. Consider adding cards from different categories and players.',
      action: 'Add 5-10 cards from underrepresented categories',
      priority: 'high'
    });
  }

  // Performance-based recommendations
  const topCategory = categoryInsights[0];
  if (topCategory && topCategory.roi > 50) {
    recommendations.push({
      icon: '🚀',
      title: `Double Down on ${topCategory.category}`,
      description: `${topCategory.category} cards are performing exceptionally well with ${topCategory.roi.toFixed(1)}% ROI.`,
      action: `Allocate 20-30% more budget to ${topCategory.category}`,
      priority: 'medium'
    });
  }

  // Risk-based recommendations
  if (metrics.volatility > 40) {
    recommendations.push({
      icon: '⚖️',
      title: 'Reduce Portfolio Volatility',
      description: 'High volatility detected. Consider adding more stable, graded cards from established players.',
      action: 'Focus on PSA/BGS 9+ cards',
      priority: 'medium'
    });
  }

  // Win rate recommendation
  if (metrics.winRate < 50) {
    recommendations.push({
      icon: '📚',
      title: 'Improve Selection Criteria',
      description: `Your win rate is only ${metrics.winRate.toFixed(1)}%. Review your buying strategy.`,
      action: 'Focus on rookie cards and first editions',
      priority: 'high'
    });
  }

  // Liquidity recommendation
  if (riskMetrics.liquidityScore < 50) {
    recommendations.push({
      icon: '💧',
      title: 'Increase Portfolio Liquidity',
      description: 'Many cards may be hard to sell quickly. Consider more liquid investments.',
      action: 'Add more graded cards from popular sports',
      priority: 'low'
    });
  }

  return recommendations.slice(0, 4); // Return top 4 recommendations
}

export default InvestmentInsightsReport;