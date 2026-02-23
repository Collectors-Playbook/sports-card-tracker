import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCards } from '../../context/ApiCardContext';
import { exportCardsAsJSON, exportCardsAsCSV } from '../../utils/exportUtils';
import { exportCardsToPDF } from '../../utils/pdfExport';
import './Layout.css';

type View = 'dashboard' | 'inventory' | 'add-card' | 'holding-pen' | 'processed' | 'admin' | 'profile' | 'reports' | 'ebay' | 'backup' | 'users' | 'collections' | 'about' | 'audit-log' | 'grading' | 'grading-roi' | 'heatmap';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
}

const NavGroup: React.FC<{
  label: string;
  items: { view: View; label: string }[];
  currentView: View;
  onViewChange: (view: View) => void;
  onCloseMobile: () => void;
}> = ({ label, items, currentView, onViewChange, onCloseMobile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isActive = items.some(item => item.view === currentView);

  return (
    <div ref={ref} className={`nav-group ${isOpen ? 'open' : ''} ${isActive ? 'active' : ''}`}>
      <button
        className={`nav-item nav-group-trigger ${isActive ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
        <svg className="nav-group-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="nav-group-dropdown">
          <div className="nav-group-dropdown-inner">
            {items.map(item => (
              <button
                key={item.view}
                className={`nav-group-item ${currentView === item.view ? 'active' : ''}`}
                onClick={() => {
                  onViewChange(item.view);
                  setIsOpen(false);
                  onCloseMobile();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { state: authState, logout } = useAuth();
  const { state, getPortfolioStats } = useCards();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  const ingestionRef = useRef<HTMLDivElement>(null);
  const [showStats, setShowStats] = useState(true);

  useEffect(() => {
    if (!isIngestionOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ingestionRef.current && !ingestionRef.current.contains(e.target as Node)) {
        setIsIngestionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isIngestionOpen]);
  const stats = getPortfolioStats();
  
  // Debug logging for stats
  console.log('Portfolio Stats:', {
    totalCards: stats.totalCards,
    totalCurrentValue: stats.totalCurrentValue,
    totalProfit: stats.totalProfit,
    cardsLength: state.cards.length
  });
  
  const isLoading = state.loading;
  const hasError = !!state.error;

  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    try {
      if (format === 'pdf') {
        exportCardsToPDF(state.cards, {
          includeStats: true,
          groupBy: 'none',
          sortBy: 'player'
        });
        return;
      }

      const filename = `sports-cards-${new Date().toISOString().split('T')[0]}`;
      const data = format === 'json' 
        ? exportCardsAsJSON(state.cards)
        : exportCardsAsCSV(state.cards);
      
      const blob = new Blob([data], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h2 className="app-title">
              <img src="/logo.png" alt="App Icon" className="app-icon" />
              <span className="title-text">Collectors Playbook</span>
            </h2>
            {hasError && (
              <div className="api-status error">
                ⚠️ {state.error}
              </div>
            )}
            {isLoading && (
              <div className="api-status loading">
                🔄 Loading...
              </div>
            )}
            <div className="stats-container">
              <button 
                className="stats-toggle"
                onClick={() => setShowStats(!showStats)}
                aria-label="Toggle statistics"
              >
                <span className="stats-label">Stats</span>
              </button>
              <div className={`quick-stats ${showStats ? 'show' : ''}`}>
                <span className="stat">
                  <span>{stats.totalCards} cards</span>
                </span>
                <span className="stat">
                  <span>{formatCurrency(stats.totalCurrentValue)}</span>
                </span>
                <span className={`stat profit-loss ${stats.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                  <span>{stats.totalProfit >= 0 ? '+' : ''}{formatCurrency(stats.totalProfit)}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            <div className="user-info" onClick={() => onViewChange('profile')}>
              {authState.user?.profilePhoto ? (
                <img src={authState.user.profilePhoto} alt="Profile" className="profile-photo-small" />
              ) : (
                <div className="default-avatar-small">
                  <span>{authState.user?.username?.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <span className="username">
                {authState.user?.username}
                {authState.user?.role === 'admin' && <span className="admin-badge">Admin</span>}
              </span>
            </div>
            
            <div className="export-menu">
              <button className="export-btn">
                Export
              </button>
              <div className="export-dropdown">
                <button onClick={() => handleExport('pdf')}>
                  📄 Export as PDF
                </button>
                <button onClick={() => handleExport('json')}>
                  📋 Export as JSON
                </button>
                <button onClick={() => handleExport('csv')}>
                  📊 Export as CSV
                </button>
              </div>
            </div>
            
            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
            
            <button 
              className="mobile-menu-btn"
              onClick={toggleMobileMenu}
              aria-label="Toggle navigation menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <nav className={`navigation ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="nav-content">
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              onViewChange('dashboard');
              setIsMobileMenuOpen(false);
            }}
          >
            Dashboard
          </button>

          <NavGroup
            label="Collection"
            items={[
              { view: 'inventory', label: 'Inventory' },
              { view: 'collections', label: 'Collections' },
              { view: 'add-card', label: 'Add Card' },
            ]}
            currentView={currentView}
            onViewChange={onViewChange}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <div ref={ingestionRef} className={`nav-group ${isIngestionOpen ? 'open' : ''} ${currentView === 'holding-pen' || currentView === 'processed' ? 'active' : ''}`}>
            <button
              className={`nav-item nav-group-trigger ${currentView === 'holding-pen' || currentView === 'processed' ? 'active' : ''}`}
              onClick={() => setIsIngestionOpen(!isIngestionOpen)}
            >
              Ingestion
              <svg className="nav-group-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 1l4 4 4-4" />
              </svg>
            </button>
            {isIngestionOpen && (
              <div className="nav-group-dropdown">
                <div className="nav-group-dropdown-inner">
                  <button
                    className={`nav-group-item ${currentView === 'holding-pen' ? 'active' : ''}`}
                    onClick={() => {
                      onViewChange('holding-pen');
                      setIsIngestionOpen(false);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Holding Pen
                  </button>
                  <button
                    className={`nav-group-item ${currentView === 'processed' ? 'active' : ''}`}
                    onClick={() => {
                      onViewChange('processed');
                      setIsIngestionOpen(false);
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Processed
                  </button>
                </div>
              </div>
            )}
          </div>

          <NavGroup
            label="Analytics"
            items={[
              { view: 'heatmap', label: 'Heatmap' },
              { view: 'reports', label: 'Reports' },
            ]}
            currentView={currentView}
            onViewChange={onViewChange}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <button
            className={`nav-item ${currentView === 'ebay' ? 'active' : ''}`}
            onClick={() => {
              onViewChange('ebay');
              setIsMobileMenuOpen(false);
            }}
          >
            eBay Listings
          </button>

          <NavGroup
            label="Grading"
            items={[
              { view: 'grading', label: 'Grading Tracker' },
              { view: 'grading-roi', label: 'Grade ROI' },
            ]}
            currentView={currentView}
            onViewChange={onViewChange}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <NavGroup
            label="Account"
            items={[
              { view: 'profile', label: 'Profile' },
              { view: 'backup', label: 'Backup' },
              { view: 'about', label: 'About' },
            ]}
            currentView={currentView}
            onViewChange={onViewChange}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          {authState.user?.role === 'admin' && (
            <NavGroup
              label="Admin"
              items={[
                { view: 'admin', label: 'Admin' },
                { view: 'users', label: 'Users' },
                { view: 'audit-log', label: 'Audit Log' },
              ]}
              currentView={currentView}
              onViewChange={onViewChange}
              onCloseMobile={() => setIsMobileMenuOpen(false)}
            />
          )}
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <img src="/logo.png" alt="Collectors Playbook" className="footer-logo-img" />
                <span className="footer-logo-text">Collectors Playbook</span>
              </div>
              <p className="footer-tagline">Track, manage, and sell your sports card collection.</p>
              <div className="footer-social">
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="X (Twitter)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="Discord">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>
                </a>
                <a href="https://ebay.com" target="_blank" rel="noopener noreferrer" className="social-link" aria-label="eBay Store">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M5.869 8.596c-2.458 0-4.062 1.166-4.062 3.37 0 1.806 1.042 3.074 3.997 3.074 1.264 0 2.163-.19 2.927-.618V15.8H5.738c-2.094 0-2.677-.825-2.677-1.737h5.67v-.793c0-2.785-1.834-4.674-2.862-4.674zM3.06 11.642c.12-1.122.862-1.906 2.172-1.906 1.376 0 2.13.83 2.13 1.906H3.06zm8.29-3.046c-1.326 0-2.2.336-2.835.758V3.6h-2.88v11.282h2.7v-.584c.618.498 1.458.77 2.514.77 2.34 0 3.858-1.65 3.858-3.866 0-2.292-1.392-3.606-3.357-3.606zm-.354 5.52c-.852 0-1.572-.384-1.938-.756v-2.556c.36-.372 1.086-.756 1.938-.756 1.176 0 1.914.84 1.914 2.034 0 1.194-.738 2.034-1.914 2.034zm11.88-.342c-.18.078-.456.114-.756.114-.588 0-.816-.27-.816-.87v-3.204h1.572V8.596h-1.572V6.354l-2.88.618V8.596h-1.284v1.218h1.284v3.534c0 1.53.876 2.292 2.676 2.292.564 0 1.11-.096 1.536-.264l.24-1.602z"/></svg>
                </a>
              </div>
            </div>
            <div className="footer-links">
              <h4 className="footer-heading">Quick Links</h4>
              <button className="footer-link" onClick={() => onViewChange('dashboard')}>Dashboard</button>
              <button className="footer-link" onClick={() => onViewChange('inventory')}>Inventory</button>
              <button className="footer-link" onClick={() => onViewChange('collections')}>Collections</button>
              <button className="footer-link" onClick={() => onViewChange('reports')}>Reports</button>
              <button className="footer-link" onClick={() => onViewChange('ebay')}>eBay Listings</button>
            </div>
            <div className="footer-links">
              <h4 className="footer-heading">Account</h4>
              <button className="footer-link" onClick={() => onViewChange('profile')}>Profile</button>
              <button className="footer-link" onClick={() => onViewChange('backup')}>Backup & Restore</button>
              <button className="footer-link" onClick={() => onViewChange('about')}>About</button>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Collectors Playbook. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;