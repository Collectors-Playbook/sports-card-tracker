import React, { useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { ReportingService } from '../../services/reportingService';
import { ReportTemplate } from '../../types/reports';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import './ReportsDashboard.css';

interface Props {
  onSelectReport: (reportType: ReportTemplate) => void;
}

const ReportsDashboard: React.FC<Props> = ({ onSelectReport }) => {
  const { state } = useCards();
  const reportingService = useMemo(() => new ReportingService(state.cards), [state.cards]);

  // Format currency helper function
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Generate key metrics for dashboard
  const metrics = useMemo(() => {
    return reportingService.calculateMetrics(state.cards);
  }, [reportingService, state.cards]);

  const portfolioData = useMemo(() => {
    return reportingService.generatePortfolioPerformance();
  }, [reportingService]);

  const analyticsData = useMemo(() => {
    return reportingService.generateCollectionAnalytics();
  }, [reportingService]);

  const marketData = useMemo(() => {
    return reportingService.generateMarketAnalysis();
  }, [reportingService]);

  // Chart data preparation
  const portfolioChartData = [
    { name: 'Total Investment', value: metrics.totalCost, color: '#8884d8' },
    { name: 'Current Value', value: metrics.totalValue, color: '#82ca9d' },
    { name: 'Profit/Loss', value: metrics.totalProfit, color: metrics.totalProfit >= 0 ? '#00C49F' : '#FF8042' }
  ];

  const categoryChartData = analyticsData.categoryDistribution.slice(0, 5).map(cat => ({
    name: cat.category,
    value: cat.totalValue,
    count: cat.count
  }));

  const performanceChartData = portfolioData.monthlyReturns.slice(-6).map(month => ({
    month: month.month,
    return: month.return,
    value: month.value
  }));

  const reportCards = [
    {
      id: 'portfolio-summary' as ReportTemplate,
      title: 'Portfolio Overview',
      icon: '📊',
      description: 'Complete portfolio performance and ROI analysis',
      keyMetric: `${metrics.roi.toFixed(1)}% ROI`,
      trend: metrics.totalProfit >= 0 ? 'up' : 'down',
      color: '#007bff'
    },
    {
      id: 'collection-analytics' as ReportTemplate,
      title: 'Collection Analytics',
      icon: '📈',
      description: 'Distribution analysis and collection insights',
      keyMetric: `${state.cards.length} Cards`,
      trend: 'up',
      color: '#28a745'
    },
    {
      id: 'market-analysis' as ReportTemplate,
      title: 'Market Analysis',
      icon: '📉',
      description: 'Market performance and comparison analysis',
      keyMetric: `${marketData.marketComparison.outperformance.toFixed(1)}% vs Market`,
      trend: marketData.marketComparison.outperformance >= 0 ? 'up' : 'down',
      color: '#dc3545'
    },
    {
      id: 'financial-performance' as ReportTemplate,
      title: 'Financial Performance',
      icon: '💰',
      description: 'Detailed financial metrics and gains analysis',
      keyMetric: formatCurrency(metrics.totalProfit),
      trend: metrics.totalProfit >= 0 ? 'up' : 'down',
      color: '#ffc107'
    },
    {
      id: 'tax-summary' as ReportTemplate,
      title: 'Tax Report',
      icon: '📋',
      description: 'Capital gains/losses for tax reporting',
      keyMetric: 'Tax Ready',
      trend: 'neutral',
      color: '#6c757d'
    },
    {
      id: 'insurance-appraisal' as ReportTemplate,
      title: 'Insurance Appraisal',
      icon: '🛡️',
      description: 'Collection valuation for insurance purposes',
      keyMetric: formatCurrency(metrics.totalValue),
      trend: 'up',
      color: '#6f42c1'
    }
  ];

  return (
    <div className="reports-dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h1>📊 Reports Dashboard</h1>
        <p>Comprehensive analytics and insights for your sports card collection</p>
      </div>

      {/* Key Metrics Overview */}
      <div className="metrics-overview">
        <div className="metric-card primary">
          <div className="metric-icon">💎</div>
          <div className="metric-content">
            <h3>Total Portfolio Value</h3>
            <div className="metric-value">{formatCurrency(metrics.totalValue)}</div>
            <div className={`metric-change ${metrics.totalProfit >= 0 ? 'positive' : 'negative'}`}>
              {metrics.totalProfit >= 0 ? '+' : ''}{formatCurrency(metrics.totalProfit)} ({metrics.roi.toFixed(1)}%)
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📦</div>
          <div className="metric-content">
            <h3>Total Cards</h3>
            <div className="metric-value">{metrics.totalCards.toLocaleString()}</div>
            <div className="metric-subtitle">Across {analyticsData.categoryDistribution.length} categories</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <h3>Average Value</h3>
            <div className="metric-value">{formatCurrency(metrics.averageValue)}</div>
            <div className="metric-subtitle">Per card in collection</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <h3>Top Performer</h3>
            <div className="metric-value">{portfolioData.bestPerformers[0]?.player || 'N/A'}</div>
            <div className="metric-subtitle">
              {portfolioData.bestPerformers[0] ? 
                formatCurrency((portfolioData.bestPerformers[0].currentValue || 0) - (portfolioData.bestPerformers[0].purchasePrice || 0)) : 
                'No data'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Quick Charts Section */}
      <div className="dashboard-charts">
        <div className="chart-section">
          <h3>Portfolio Performance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={performanceChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="value" stroke="#007bff" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Portfolio Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={portfolioChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#28a745" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-section">
          <h3>Top Categories</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={({ name, count }) => `${name} (${count})`}
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][index % 5]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="reports-grid">
        <h2>Available Reports</h2>
        <div className="report-cards">
          {reportCards.map(report => (
            <div 
              key={report.id}
              className="report-card"
              onClick={() => onSelectReport(report.id)}
              style={{ borderLeftColor: report.color }}
            >
              <div className="report-header">
                <span className="report-icon">{report.icon}</span>
                <div className="report-trend">
                  {report.trend === 'up' && <span className="trend-icon up">↗️</span>}
                  {report.trend === 'down' && <span className="trend-icon down">↘️</span>}
                  {report.trend === 'neutral' && <span className="trend-icon neutral">➡️</span>}
                </div>
              </div>
              <h3>{report.title}</h3>
              <p>{report.description}</p>
              <div className="report-metric">{report.keyMetric}</div>
              <button className="report-button">View Report →</button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="action-btn primary"
            onClick={() => onSelectReport('portfolio-summary')}
          >
            📊 Generate Portfolio Report
          </button>
          <button 
            className="action-btn"
            onClick={() => onSelectReport('tax-summary')}
          >
            📋 Tax Summary Report
          </button>
          <button 
            className="action-btn"
            onClick={() => onSelectReport('insurance-appraisal')}
          >
            🛡️ Insurance Appraisal
          </button>
          <button 
            className="action-btn"
            onClick={() => onSelectReport('collection-analytics')}
          >
            📈 Collection Analytics
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Collection Insights</h3>
        <div className="insights-list">
          <div className="insight-item">
            <span className="insight-icon">🎯</span>
            <span className="insight-text">
              Your top performing category is {analyticsData.categoryDistribution[0]?.category} with {analyticsData.categoryDistribution[0]?.count} cards
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-icon">📈</span>
            <span className="insight-text">
              Portfolio ROI of {metrics.roi.toFixed(1)}% {metrics.roi >= 0 ? 'outperforming' : 'underperforming'} the market
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-icon">💰</span>
            <span className="insight-text">
              Average card value: {formatCurrency(metrics.averageValue)} vs purchase price: {formatCurrency(metrics.averageCost)}
            </span>
          </div>
          <div className="insight-item">
            <span className="insight-icon">🏆</span>
            <span className="insight-text">
              Top performer: {portfolioData.bestPerformers[0]?.player || 'No data'} with {portfolioData.bestPerformers[0] ? 
                `${(((portfolioData.bestPerformers[0].currentValue || 0) - (portfolioData.bestPerformers[0].purchasePrice || 0)) / (portfolioData.bestPerformers[0].purchasePrice || 1) * 100).toFixed(1)}% return` : 
                'no gains data'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;