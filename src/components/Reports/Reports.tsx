import React, { useState, useMemo } from 'react';
import { useCards } from '../../context/ApiCardContext';
import { ReportingService } from '../../services/reportingService';
import { ReportFilter, ReportTemplate } from '../../types/reports';
import ReportsDashboard from './ReportsDashboard';
import PortfolioPerformanceReport from './PortfolioPerformanceReport';
import CollectionAnalyticsReport from './CollectionAnalyticsReport';
import MarketAnalysisReport from './MarketAnalysisReport';
import TaxReport from './TaxReport';
import InsuranceReport from './InsuranceReport';
import InventoryReport from './InventoryReport';
import ComparisonReport from './ComparisonReport';
import ExecutiveDashboard from './ExecutiveDashboard';
import ReportFilters from './ReportFilters';
import ReportExport from './ReportExport';
import './Reports.css';

const Reports: React.FC = () => {
  const { state } = useCards();
  const [activeReport, setActiveReport] = useState<ReportTemplate | 'dashboard'>('dashboard');
  const [filters, setFilters] = useState<ReportFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  const reportingService = useMemo(() => 
    new ReportingService(state.cards), 
    [state.cards]
  );

  const reportTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'portfolio-summary', label: 'Portfolio Overview', icon: '📊' },
    { id: 'financial-performance', label: 'Financial Performance', icon: '💰' },
    { id: 'collection-analytics', label: 'Collection Analytics', icon: '📈' },
    { id: 'market-analysis', label: 'Market Analysis', icon: '📉' },
    { id: 'tax-summary', label: 'Tax Reports', icon: '📋' },
    { id: 'insurance-appraisal', label: 'Insurance Reports', icon: '🛡️' },
    { id: 'investment-insights', label: 'Investment Insights', icon: '🔍' },
    { id: 'detailed-inventory', label: 'Detailed Inventory', icon: '📦' },
    { id: 'comparison-analysis', label: 'Comparisons', icon: '⚖️' },
    { id: 'executive-dashboard', label: 'Executive Dashboard', icon: '🎯' }
  ] as const;

  const handleSelectReport = (reportType: ReportTemplate) => {
    setActiveReport(reportType);
    setShowFilters(false);
  };

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'dashboard':
        return <ReportsDashboard onSelectReport={handleSelectReport} />;
      
      case 'portfolio-summary':
      case 'financial-performance':
        return (
          <PortfolioPerformanceReport 
            reportingService={reportingService} 
            filters={filters}
            detailed={activeReport === 'financial-performance'}
          />
        );
      
      case 'collection-analytics':
        return (
          <CollectionAnalyticsReport 
            reportingService={reportingService} 
            filters={filters}
          />
        );
      
      case 'market-analysis':
      case 'investment-insights':
        return (
          <MarketAnalysisReport 
            reportingService={reportingService} 
            filters={filters}
            detailed={activeReport === 'investment-insights'}
          />
        );
      
      case 'tax-summary':
        return (
          <TaxReport 
            reportingService={reportingService} 
            filters={filters}
          />
        );
      
      case 'insurance-appraisal':
        return (
          <InsuranceReport 
            reportingService={reportingService} 
            filters={filters}
          />
        );
      
      case 'detailed-inventory':
        return <InventoryReport />;
      
      case 'comparison-analysis':
        return <ComparisonReport />;
      
      case 'executive-dashboard':
        return <ExecutiveDashboard />;
      
      default:
        return <div>Report not found</div>;
    }
  };

  if (state.loading) {
    return (
      <div className="reports-loading">
        <div className="loading-spinner"></div>
        <p>Loading report data...</p>
      </div>
    );
  }

  if (state.cards.length === 0) {
    return (
      <div className="reports-empty">
        <div className="empty-icon">📊</div>
        <h2>No Data for Reports</h2>
        <p>Add some cards to your collection to generate comprehensive reports.</p>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div className="reports-title">
          <h1>📊 Advanced Reports & Analytics</h1>
          <p>Comprehensive insights into your sports card portfolio</p>
        </div>
        
        <div className="reports-actions">
          {activeReport !== 'dashboard' && (
            <>
              <button 
                className={`filter-toggle ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                🔍 Filters
              </button>
              
              <ReportExport 
                reportingService={reportingService}
                activeReport={activeReport as ReportTemplate}
                filters={filters}
              />
            </>
          )}
        </div>
      </div>

      {showFilters && activeReport !== 'dashboard' && (
        <ReportFilters 
          filters={filters}
          onFiltersChange={setFilters}
          cards={state.cards}
        />
      )}

      <div className="reports-tabs">
        {reportTabs.map(tab => (
          <button
            key={tab.id}
            className={`report-tab ${activeReport === tab.id ? 'active' : ''}`}
            onClick={() => setActiveReport(tab.id as ReportTemplate | 'dashboard')}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="reports-content">
        {renderActiveReport()}
      </div>
    </div>
  );
};

export default Reports;