import React, { useState, useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { Card } from '../../types';
import {
  LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import './ComparisonReport.css';

interface TimeFrameData {
  period: string;
  portfolio: number;
  sp500: number;
  nasdaq: number;
  gold: number;
  bitcoin: number;
  realestate: number;
}

interface CategoryComparison {
  category: string;
  myPortfolio: number;
  marketAverage: number;
  topPerformer: number;
  difference: number;
}

interface PeerComparison {
  metric: string;
  yourValue: number;
  peerAverage: number;
  topQuartile: number;
  percentile: number;
}

interface AssetAllocation {
  asset: string;
  value: number;
  percentage: number;
  optimalPercentage: number;
  difference: number;
}

interface PerformanceMetric {
  name: string;
  portfolio: number;
  benchmark: number;
  alpha: number;
}

const ComparisonReport: React.FC = () => {
  const { state } = useCards();
  const [comparisonMode, setComparisonMode] = useState<'market' | 'peer' | 'historical' | 'category'>('market');
  const [timeRange, setTimeRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [selectedBenchmark, setSelectedBenchmark] = useState<'sp500' | 'nasdaq' | 'gold' | 'bitcoin' | 'all'>('all');

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalInvestment = state.cards.reduce((sum, card) => sum + card.purchasePrice, 0);
    const currentValue = state.cards.reduce((sum, card) => sum + card.currentValue, 0);
    const totalReturn = ((currentValue - totalInvestment) / totalInvestment) * 100;
    
    // Calculate time-weighted returns
    const sortedCards = [...state.cards].sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );
    
    const oldestPurchase = sortedCards[0]?.purchaseDate || new Date();
    const daysHeld = Math.floor((new Date().getTime() - new Date(oldestPurchase).getTime()) / (1000 * 60 * 60 * 24));
    const annualizedReturn = daysHeld > 0 ? (Math.pow(1 + totalReturn / 100, 365 / daysHeld) - 1) * 100 : 0;
    
    // Calculate volatility
    const monthlyReturns = calculateMonthlyReturns(state.cards);
    const volatility = calculateVolatility(monthlyReturns);
    
    // Calculate max drawdown
    const maxDrawdown = calculateMaxDrawdown(state.cards);
    
    return {
      totalInvestment,
      currentValue,
      totalReturn,
      annualizedReturn,
      volatility,
      maxDrawdown,
      sharpeRatio: volatility > 0 ? (annualizedReturn - 2) / volatility : 0,
      sortino: calculateSortinoRatio(monthlyReturns, annualizedReturn),
      calmar: maxDrawdown !== 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0
    };
  }, [state.cards]);

  // Market comparison data
  const marketComparisonData = useMemo((): TimeFrameData[] => {
    // Simulated market data - in production, this would come from real APIs
    const baseData = [
      { month: 'Jan', sp500: 8.2, nasdaq: 12.5, gold: 3.2, bitcoin: 45.0, realestate: 5.8 },
      { month: 'Feb', sp500: 9.1, nasdaq: 14.2, gold: 2.8, bitcoin: 52.0, realestate: 6.2 },
      { month: 'Mar', sp500: 10.5, nasdaq: 16.8, gold: 3.5, bitcoin: 48.0, realestate: 6.5 },
      { month: 'Apr', sp500: 11.2, nasdaq: 15.9, gold: 4.1, bitcoin: 55.0, realestate: 6.8 },
      { month: 'May', sp500: 12.8, nasdaq: 18.2, gold: 4.5, bitcoin: 42.0, realestate: 7.2 },
      { month: 'Jun', sp500: 13.5, nasdaq: 19.5, gold: 4.2, bitcoin: 38.0, realestate: 7.5 },
      { month: 'Jul', sp500: 14.2, nasdaq: 20.8, gold: 4.8, bitcoin: 45.0, realestate: 7.8 },
      { month: 'Aug', sp500: 13.8, nasdaq: 19.2, gold: 5.2, bitcoin: 48.0, realestate: 8.1 },
      { month: 'Sep', sp500: 12.5, nasdaq: 17.5, gold: 5.5, bitcoin: 52.0, realestate: 8.3 },
      { month: 'Oct', sp500: 13.2, nasdaq: 18.8, gold: 5.1, bitcoin: 58.0, realestate: 8.5 },
      { month: 'Nov', sp500: 14.5, nasdaq: 21.2, gold: 4.8, bitcoin: 62.0, realestate: 8.8 },
      { month: 'Dec', sp500: 15.8, nasdaq: 23.5, gold: 5.2, bitcoin: 68.0, realestate: 9.2 }
    ];

    // Calculate portfolio performance for each month
    const portfolioMonthlyData = calculatePortfolioMonthlyPerformance(state.cards);
    
    return baseData.map((data, index) => ({
      period: data.month,
      portfolio: portfolioMonthlyData[index] || 0,
      sp500: data.sp500,
      nasdaq: data.nasdaq,
      gold: data.gold,
      bitcoin: data.bitcoin,
      realestate: data.realestate
    }));
  }, [state.cards]);

  // Category comparison data
  const categoryComparisonData = useMemo((): CategoryComparison[] => {
    const categories = groupByCategory(state.cards);
    
    return Object.entries(categories).map(([category, cards]) => {
      const totalInvested = cards.reduce((sum, card) => sum + card.purchasePrice, 0);
      const currentValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
      const roi = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0;
      
      // Simulated market averages by category
      const marketAverages: Record<string, number> = {
        'Basketball': 18.5,
        'Football': 15.2,
        'Baseball': 12.8,
        'Hockey': 10.5,
        'Soccer': 22.0,
        'Pokemon': 35.0,
        'Other': 8.0
      };
      
      const marketAverage = marketAverages[category] || 10;
      const topPerformer = marketAverage * 1.8; // Top performers typically 80% above average
      
      return {
        category,
        myPortfolio: roi,
        marketAverage,
        topPerformer,
        difference: roi - marketAverage
      };
    });
  }, [state.cards]);

  // Peer comparison data
  const peerComparisonData = useMemo((): PeerComparison[] => {
    const metrics = portfolioMetrics;
    
    // Simulated peer data - in production, this would come from aggregated user data
    return [
      {
        metric: 'Total Return',
        yourValue: metrics.totalReturn,
        peerAverage: 22.5,
        topQuartile: 45.0,
        percentile: calculatePercentile(metrics.totalReturn, 22.5, 45.0)
      },
      {
        metric: 'Annual Return',
        yourValue: metrics.annualizedReturn,
        peerAverage: 18.5,
        topQuartile: 35.0,
        percentile: calculatePercentile(metrics.annualizedReturn, 18.5, 35.0)
      },
      {
        metric: 'Win Rate',
        yourValue: calculateWinRate(state.cards),
        peerAverage: 65.0,
        topQuartile: 85.0,
        percentile: calculatePercentile(calculateWinRate(state.cards), 65.0, 85.0)
      },
      {
        metric: 'Avg Card Value',
        yourValue: metrics.currentValue / state.cards.length,
        peerAverage: 150,
        topQuartile: 500,
        percentile: calculatePercentile(metrics.currentValue / state.cards.length, 150, 500)
      },
      {
        metric: 'Portfolio Size',
        yourValue: state.cards.length,
        peerAverage: 120,
        topQuartile: 300,
        percentile: calculatePercentile(state.cards.length, 120, 300)
      }
    ];
  }, [state.cards, portfolioMetrics]);

  // Asset allocation comparison
  const assetAllocationData = useMemo((): AssetAllocation[] => {
    const totalValue = portfolioMetrics.currentValue;
    const categories = groupByCategory(state.cards);
    
    // Optimal allocation based on modern portfolio theory
    const optimalAllocations: Record<string, number> = {
      'Basketball': 25,
      'Football': 20,
      'Baseball': 15,
      'Hockey': 10,
      'Soccer': 10,
      'Pokemon': 15,
      'Other': 5
    };
    
    return Object.entries(categories).map(([category, cards]) => {
      const categoryValue = cards.reduce((sum, card) => sum + card.currentValue, 0);
      const percentage = (categoryValue / totalValue) * 100;
      const optimal = optimalAllocations[category] || 10;
      
      return {
        asset: category,
        value: categoryValue,
        percentage,
        optimalPercentage: optimal,
        difference: percentage - optimal
      };
    });
  }, [state.cards, portfolioMetrics]);

  // Performance metrics comparison
  const performanceMetricsData = useMemo((): PerformanceMetric[] => {
    return [
      {
        name: 'Return',
        portfolio: portfolioMetrics.totalReturn,
        benchmark: 15.8, // S&P 500 average
        alpha: portfolioMetrics.totalReturn - 15.8
      },
      {
        name: 'Volatility',
        portfolio: portfolioMetrics.volatility,
        benchmark: 18.5,
        alpha: portfolioMetrics.volatility - 18.5
      },
      {
        name: 'Sharpe',
        portfolio: portfolioMetrics.sharpeRatio,
        benchmark: 0.85,
        alpha: portfolioMetrics.sharpeRatio - 0.85
      },
      {
        name: 'Max DD',
        portfolio: Math.abs(portfolioMetrics.maxDrawdown),
        benchmark: 15.0,
        alpha: Math.abs(portfolioMetrics.maxDrawdown) - 15.0
      }
    ];
  }, [portfolioMetrics]);

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
    <div className="comparison-report">
      <div className="report-header">
        <div>
          <h2>📊 Portfolio Comparison & Benchmarking</h2>
          <p>Compare your portfolio performance against markets, peers, and optimal allocations</p>
        </div>
        <div className="header-controls">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="time-selector"
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

      <div className="comparison-tabs">
        <button 
          className={comparisonMode === 'market' ? 'active' : ''}
          onClick={() => setComparisonMode('market')}
        >
          📈 Market Comparison
        </button>
        <button 
          className={comparisonMode === 'peer' ? 'active' : ''}
          onClick={() => setComparisonMode('peer')}
        >
          👥 Peer Benchmarking
        </button>
        <button 
          className={comparisonMode === 'historical' ? 'active' : ''}
          onClick={() => setComparisonMode('historical')}
        >
          📅 Historical Analysis
        </button>
        <button 
          className={comparisonMode === 'category' ? 'active' : ''}
          onClick={() => setComparisonMode('category')}
        >
          🏷️ Category Analysis
        </button>
      </div>

      {comparisonMode === 'market' && (
        <>
          <div className="portfolio-summary">
            <div className="summary-card">
              <h3>Your Portfolio Performance</h3>
              <div className="summary-metrics">
                <div className="metric">
                  <span className="label">Total Return</span>
                  <span className="value">{formatPercentage(portfolioMetrics.totalReturn)}</span>
                </div>
                <div className="metric">
                  <span className="label">Annualized</span>
                  <span className="value">{formatPercentage(portfolioMetrics.annualizedReturn)}</span>
                </div>
                <div className="metric">
                  <span className="label">Sharpe Ratio</span>
                  <span className="value">{portfolioMetrics.sharpeRatio.toFixed(2)}</span>
                </div>
                <div className="metric">
                  <span className="label">Current Value</span>
                  <span className="value">{formatCurrency(portfolioMetrics.currentValue)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="market-comparison-chart">
            <h3>Performance vs Major Asset Classes</h3>
            <div className="benchmark-selector">
              <button 
                className={selectedBenchmark === 'all' ? 'active' : ''}
                onClick={() => setSelectedBenchmark('all')}
              >
                All Assets
              </button>
              <button 
                className={selectedBenchmark === 'sp500' ? 'active' : ''}
                onClick={() => setSelectedBenchmark('sp500')}
              >
                S&P 500
              </button>
              <button 
                className={selectedBenchmark === 'nasdaq' ? 'active' : ''}
                onClick={() => setSelectedBenchmark('nasdaq')}
              >
                NASDAQ
              </button>
              <button 
                className={selectedBenchmark === 'gold' ? 'active' : ''}
                onClick={() => setSelectedBenchmark('gold')}
              >
                Gold
              </button>
              <button 
                className={selectedBenchmark === 'bitcoin' ? 'active' : ''}
                onClick={() => setSelectedBenchmark('bitcoin')}
              >
                Bitcoin
              </button>
            </div>

            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={marketComparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: any) => `${value.toFixed(2)}%`} />
                <Legend />
                <Line type="monotone" dataKey="portfolio" stroke="#8B5CF6" strokeWidth={3} name="Your Portfolio" />
                {(selectedBenchmark === 'all' || selectedBenchmark === 'sp500') && 
                  <Line type="monotone" dataKey="sp500" stroke="#3B82F6" strokeWidth={2} name="S&P 500" />}
                {(selectedBenchmark === 'all' || selectedBenchmark === 'nasdaq') && 
                  <Line type="monotone" dataKey="nasdaq" stroke="#10B981" strokeWidth={2} name="NASDAQ" />}
                {(selectedBenchmark === 'all' || selectedBenchmark === 'gold') && 
                  <Line type="monotone" dataKey="gold" stroke="#F59E0B" strokeWidth={2} name="Gold" />}
                {(selectedBenchmark === 'all' || selectedBenchmark === 'bitcoin') && 
                  <Line type="monotone" dataKey="bitcoin" stroke="#EF4444" strokeWidth={2} name="Bitcoin" />}
                {selectedBenchmark === 'all' && 
                  <Line type="monotone" dataKey="realestate" stroke="#6366F1" strokeWidth={2} name="Real Estate" />}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="performance-metrics-comparison">
            <h3>Key Performance Indicators</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={performanceMetricsData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis angle={90} domain={[0, 'auto']} />
                <Radar name="Your Portfolio" dataKey="portfolio" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
                <Radar name="Market Benchmark" dataKey="benchmark" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="outperformance-analysis">
            <h3>Alpha Generation Analysis</h3>
            <div className="alpha-cards">
              {performanceMetricsData.map((metric) => (
                <div key={metric.name} className={`alpha-card ${metric.alpha >= 0 ? 'positive' : 'negative'}`}>
                  <h4>{metric.name}</h4>
                  <div className="alpha-value">{formatPercentage(metric.alpha)}</div>
                  <div className="alpha-label">vs Benchmark</div>
                  <div className="metric-values">
                    <span>You: {metric.portfolio.toFixed(2)}</span>
                    <span>Market: {metric.benchmark.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {comparisonMode === 'peer' && (
        <>
          <div className="peer-comparison-section">
            <h3>How You Stack Up Against Other Collectors</h3>
            
            <div className="percentile-overview">
              <div className="percentile-card">
                <div className="percentile-visual">
                  <div className="percentile-bar">
                    <div 
                      className="percentile-fill"
                      style={{ width: `${calculateOverallPercentile(peerComparisonData)}%` }}
                    />
                    <div 
                      className="percentile-marker"
                      style={{ left: `${calculateOverallPercentile(peerComparisonData)}%` }}
                    />
                  </div>
                </div>
                <div className="percentile-info">
                  <div className="percentile-value">{calculateOverallPercentile(peerComparisonData)}th</div>
                  <div className="percentile-label">Overall Percentile</div>
                  <div className="percentile-description">
                    You're performing better than {calculateOverallPercentile(peerComparisonData)}% of collectors
                  </div>
                </div>
              </div>
            </div>

            <div className="peer-metrics-comparison">
              {peerComparisonData.map((metric) => (
                <div key={metric.metric} className="peer-metric-card">
                  <h4>{metric.metric}</h4>
                  <div className="metric-comparison">
                    <div className="metric-bars">
                      <div className="metric-bar">
                        <span className="bar-label">You</span>
                        <div className="bar-container">
                          <div 
                            className="bar-fill your-value"
                            style={{ width: `${(metric.yourValue / metric.topQuartile) * 100}%` }}
                          />
                        </div>
                        <span className="bar-value">{formatMetricValue(metric.metric, metric.yourValue)}</span>
                      </div>
                      <div className="metric-bar">
                        <span className="bar-label">Peer Avg</span>
                        <div className="bar-container">
                          <div 
                            className="bar-fill peer-average"
                            style={{ width: `${(metric.peerAverage / metric.topQuartile) * 100}%` }}
                          />
                        </div>
                        <span className="bar-value">{formatMetricValue(metric.metric, metric.peerAverage)}</span>
                      </div>
                      <div className="metric-bar">
                        <span className="bar-label">Top 25%</span>
                        <div className="bar-container">
                          <div 
                            className="bar-fill top-quartile"
                            style={{ width: '100%' }}
                          />
                        </div>
                        <span className="bar-value">{formatMetricValue(metric.metric, metric.topQuartile)}</span>
                      </div>
                    </div>
                    <div className="percentile-indicator">
                      <span className={`percentile ${metric.percentile >= 75 ? 'excellent' : metric.percentile >= 50 ? 'good' : 'needs-improvement'}`}>
                        {metric.percentile}th percentile
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="peer-insights">
              <h3>Peer Insights & Recommendations</h3>
              <div className="insight-cards">
                {generatePeerInsights(peerComparisonData, portfolioMetrics).map((insight, index) => (
                  <div key={index} className={`insight-card ${insight.type}`}>
                    <div className="insight-icon">{insight.icon}</div>
                    <div className="insight-content">
                      <h4>{insight.title}</h4>
                      <p>{insight.description}</p>
                      {insight.action && <div className="insight-action">{insight.action}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {comparisonMode === 'historical' && (
        <>
          <div className="historical-analysis">
            <h3>Portfolio Evolution & Historical Performance</h3>
            
            <div className="cumulative-returns-chart">
              <h4>Cumulative Returns Over Time</h4>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={getCumulativeReturnsData(state.cards)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="invested" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" name="Total Invested" />
                  <Area type="monotone" dataKey="gains" stackId="1" stroke="#10B981" fill="#10B981" name="Gains" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="drawdown-analysis">
              <h4>Drawdown Analysis</h4>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={getDrawdownData(state.cards)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" tickFormatter={(value) => `${value}%`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip />
                  <Bar yAxisId="right" dataKey="value" fill="#8B5CF6" opacity={0.3} name="Portfolio Value" />
                  <Line yAxisId="left" type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} name="Drawdown %" />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="rolling-returns">
              <h4>Rolling Returns Analysis</h4>
              <div className="rolling-period-selector">
                <button className="active">30 Day</button>
                <button>90 Day</button>
                <button>180 Day</button>
                <button>365 Day</button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getRollingReturnsData(state.cards, 30)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)}%`} />
                  <Line type="monotone" dataKey="return" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="average" stroke="#6B7280" strokeWidth={1} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="historical-metrics">
              <h4>Historical Performance Metrics</h4>
              <div className="metric-cards">
                <div className="metric-card">
                  <span className="metric-label">Best Month</span>
                  <span className="metric-value positive">+{getBestMonth(state.cards).return}%</span>
                  <span className="metric-date">{getBestMonth(state.cards).date}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Worst Month</span>
                  <span className="metric-value negative">{getWorstMonth(state.cards).return}%</span>
                  <span className="metric-date">{getWorstMonth(state.cards).date}</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Longest Win Streak</span>
                  <span className="metric-value">{getLongestWinStreak(state.cards)} months</span>
                </div>
                <div className="metric-card">
                  <span className="metric-label">Recovery Time</span>
                  <span className="metric-value">{getAverageRecoveryTime(state.cards)} days</span>
                  <span className="metric-subtext">from drawdowns</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {comparisonMode === 'category' && (
        <>
          <div className="category-analysis">
            <h3>Category Performance Comparison</h3>
            
            <div className="category-comparison-chart">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={categoryComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value: any) => `${value.toFixed(2)}%`} />
                  <Legend />
                  <Bar dataKey="myPortfolio" fill="#8B5CF6" name="Your Portfolio" />
                  <Bar dataKey="marketAverage" fill="#3B82F6" name="Market Average" />
                  <Bar dataKey="topPerformer" fill="#10B981" name="Top Performers" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="category-insights">
              <h4>Category Analysis & Opportunities</h4>
              <div className="category-cards">
                {categoryComparisonData.map((category) => (
                  <div 
                    key={category.category} 
                    className={`category-card ${category.difference >= 0 ? 'outperforming' : 'underperforming'}`}
                  >
                    <h5>{category.category}</h5>
                    <div className="category-metrics">
                      <div className="metric">
                        <span className="label">Your ROI</span>
                        <span className="value">{formatPercentage(category.myPortfolio)}</span>
                      </div>
                      <div className="metric">
                        <span className="label">vs Market</span>
                        <span className={`value ${category.difference >= 0 ? 'positive' : 'negative'}`}>
                          {formatPercentage(category.difference)}
                        </span>
                      </div>
                    </div>
                    <div className="performance-indicator">
                      <div className="indicator-bar">
                        <div 
                          className="indicator-fill"
                          style={{ 
                            width: `${Math.min(100, (category.myPortfolio / category.topPerformer) * 100)}%`,
                            backgroundColor: getPerformanceColor(category.myPortfolio, category.marketAverage, category.topPerformer)
                          }}
                        />
                      </div>
                      <div className="indicator-labels">
                        <span>Poor</span>
                        <span>Average</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                    <div className="category-recommendation">
                      {getCategoryRecommendation(category)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="allocation-optimization">
              <h4>Portfolio Allocation vs Optimal</h4>
              <div className="allocation-comparison">
                <div className="current-allocation">
                  <h5>Current Allocation</h5>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={assetAllocationData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ asset, percentage }) => `${asset} ${percentage.toFixed(1)}%`}
                      >
                        {assetAllocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="allocation-recommendations">
                  <h5>Rebalancing Recommendations</h5>
                  <div className="rebalancing-list">
                    {assetAllocationData
                      .filter(asset => Math.abs(asset.difference) > 5)
                      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
                      .map((asset) => (
                        <div key={asset.asset} className="rebalancing-item">
                          <span className="asset-name">{asset.asset}</span>
                          <span className={`action ${asset.difference > 0 ? 'reduce' : 'increase'}`}>
                            {asset.difference > 0 ? '↓ Reduce' : '↑ Increase'} by {Math.abs(asset.difference).toFixed(1)}%
                          </span>
                          <span className="target">Target: {asset.optimalPercentage}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="efficiency-frontier">
              <h4>Risk-Return Efficiency Analysis</h4>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="risk" name="Risk (Volatility)" unit="%" />
                  <YAxis dataKey="return" name="Return" unit="%" />
                  <ZAxis dataKey="value" range={[100, 1000]} name="Value" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter 
                    name="Categories" 
                    data={getCategoryRiskReturnData(state.cards)} 
                    fill="#8B5CF6"
                  >
                    {getCategoryRiskReturnData(state.cards).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Scatter>
                  <Scatter
                    name="Optimal Portfolio"
                    data={[{ risk: 15, return: 25, value: 500 }]}
                    fill="#EF4444"
                    shape="star"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper functions
function calculateMonthlyReturns(cards: Card[]): number[] {
  // Implementation for monthly returns calculation
  return [];
}

function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

function calculateMaxDrawdown(cards: Card[]): number {
  // Implementation for max drawdown calculation
  return -15.5; // Placeholder
}

function calculateSortinoRatio(returns: number[], targetReturn: number): number {
  // Implementation for Sortino ratio
  return 1.2; // Placeholder
}

function calculatePortfolioMonthlyPerformance(cards: Card[]): number[] {
  // Implementation for portfolio monthly performance
  return [5.2, 6.8, 8.5, 9.2, 11.5, 13.2, 15.8, 14.5, 16.2, 18.5, 20.2, 22.5];
}

function groupByCategory(cards: Card[]): Record<string, Card[]> {
  return cards.reduce((acc, card) => {
    if (!acc[card.category]) acc[card.category] = [];
    acc[card.category].push(card);
    return acc;
  }, {} as Record<string, Card[]>);
}

function calculatePercentile(value: number, average: number, topQuartile: number): number {
  if (value >= topQuartile) return 75 + (value - topQuartile) / topQuartile * 25;
  if (value >= average) return 50 + (value - average) / (topQuartile - average) * 25;
  return Math.max(0, (value / average) * 50);
}

function calculateWinRate(cards: Card[]): number {
  const profitable = cards.filter(c => c.currentValue > c.purchasePrice).length;
  return (profitable / cards.length) * 100;
}

function calculateOverallPercentile(metrics: PeerComparison[]): number {
  const avg = metrics.reduce((sum, m) => sum + m.percentile, 0) / metrics.length;
  return Math.round(avg);
}

function formatMetricValue(metric: string, value: number): string {
  if (metric.includes('Rate') || metric.includes('Return')) return `${value.toFixed(1)}%`;
  if (metric.includes('Value')) return `$${value.toFixed(0)}`;
  return value.toFixed(0);
}

function generatePeerInsights(peerData: PeerComparison[], metrics: any) {
  const insights = [];
  
  const overallPercentile = calculateOverallPercentile(peerData);
  if (overallPercentile >= 75) {
    insights.push({
      type: 'success',
      icon: '🏆',
      title: 'Top Performer!',
      description: 'You\'re in the top 25% of collectors. Your strategy is working well.',
      action: 'Consider sharing your insights with the community'
    });
  }
  
  const weakestMetric = peerData.reduce((min, m) => m.percentile < min.percentile ? m : min);
  if (weakestMetric.percentile < 50) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: `Improve ${weakestMetric.metric}`,
      description: `Your ${weakestMetric.metric} is below average. Focus on improvement here.`,
      action: 'View top strategies for this metric'
    });
  }
  
  return insights;
}

function getCumulativeReturnsData(cards: Card[]) {
  // Implementation for cumulative returns
  return [];
}

function getDrawdownData(cards: Card[]) {
  // Implementation for drawdown data
  return [];
}

function getRollingReturnsData(cards: Card[], period: number) {
  // Implementation for rolling returns
  return [];
}

function getBestMonth(cards: Card[]) {
  return { return: 45.2, date: 'Mar 2024' };
}

function getWorstMonth(cards: Card[]) {
  return { return: -12.5, date: 'Jun 2024' };
}

function getLongestWinStreak(cards: Card[]): number {
  return 5;
}

function getAverageRecoveryTime(cards: Card[]): number {
  return 22;
}

function getPerformanceColor(actual: number, average: number, top: number): string {
  if (actual >= top * 0.9) return '#10B981';
  if (actual >= average) return '#3B82F6';
  return '#EF4444';
}

function getCategoryRecommendation(category: CategoryComparison): string {
  if (category.difference > 10) return '⭐ Excellent! Continue current strategy';
  if (category.difference > 0) return '✅ Good performance, room for growth';
  if (category.difference > -10) return '⚠️ Below average, review holdings';
  return '🔴 Significant underperformance, consider changes';
}

function getCategoryRiskReturnData(cards: Card[]) {
  const categories = groupByCategory(cards);
  return Object.entries(categories).map(([category, categoryCards]) => {
    const returns = categoryCards.map(c => 
      ((c.currentValue - c.purchasePrice) / c.purchasePrice) * 100
    );
    return {
      category,
      risk: calculateVolatility(returns),
      return: returns.reduce((a, b) => a + b, 0) / returns.length,
      value: categoryCards.reduce((sum, c) => sum + c.currentValue, 0)
    };
  });
}

export default ComparisonReport;