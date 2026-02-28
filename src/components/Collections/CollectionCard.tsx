import React, { useState, useEffect, useRef } from 'react';
import { Collection, CollectionStats } from '../../types/collection';
import './CollectionCard.css';

interface CollectionCardProps {
  collection: Collection;
  stats: CollectionStats;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetAsDefault: () => void;
  isSelected?: boolean;
  isBulkDeleteMode?: boolean;
}

const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  stats,
  onSelect,
  onEdit,
  onDelete,
  onSetAsDefault,
  isSelected = false,
  isBulkDeleteMode = false
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const profitLoss = stats.totalValue - stats.totalCost;
  const profitLossPercent = stats.totalCost > 0 
    ? ((profitLoss / stats.totalCost) * 100).toFixed(1)
    : '0';

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const canBeDeleted = !collection.isDefault && stats.cardCount === 0;
  const showSelectionCheckbox = isBulkDeleteMode && canBeDeleted;

  // Handle clicking outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div 
      className={`collection-card ${isSelected ? 'selected' : ''} ${showSelectionCheckbox ? 'selectable' : ''} ${isBulkDeleteMode && !showSelectionCheckbox ? 'disabled' : ''}`}
      style={{ 
        borderColor: collection.color,
        backgroundColor: collection.color + '10'
      }}
    >
      {showSelectionCheckbox && (
        <div className="selection-checkbox">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          />
        </div>
      )}
      
      {collection.isDefault && (
        <div className="default-badge">Default</div>
      )}

      <div className="collection-header">
        <div className="collection-icon" style={{ backgroundColor: collection.color + '30' }}>
          {collection.icon || (collection.name === 'eBay' ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120" width="48" height="20">
              <text x="0" y="95" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold" fontSize="105">
                <tspan fill="#E53238">e</tspan>
                <tspan fill="#0064D2">b</tspan>
                <tspan fill="#F5AF02">a</tspan>
                <tspan fill="#86B817">y</tspan>
              </text>
            </svg>
          ) : null)}
        </div>
        {!isBulkDeleteMode && (
          <div className="collection-actions" ref={menuRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }} 
              className="action-btn menu-btn" 
              title="Actions"
            >
              ⋮
            </button>
            {showMenu && (
              <div className="action-menu">
                <button onClick={(e) => { e.stopPropagation(); onEdit(); setShowMenu(false); }} className="menu-item">
                  ✏️ Edit
                </button>
                {!collection.isDefault && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onSetAsDefault(); 
                      setShowMenu(false); 
                    }} 
                    className="menu-item"
                  >
                    ⭐ Set as Default
                  </button>
                )}
                {!collection.isDefault && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onDelete(); 
                      setShowMenu(false); 
                    }} 
                    className="menu-item delete"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="collection-body" onClick={onSelect}>
        <h3>{collection.name}</h3>
        {collection.description && (
          <p className="collection-description">{collection.description}</p>
        )}

        <div className="collection-stats">
          <div className="stat-item">
            <span className="stat-label">Cards</span>
            <span className="stat-value">{stats.cardCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Value</span>
            <span className="stat-value">{formatCurrency(stats.totalValue)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">P/L</span>
            <span className={`stat-value ${profitLoss >= 0 ? 'positive' : 'negative'}`}>
              {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
              <small>({profitLossPercent}%)</small>
            </span>
          </div>
        </div>

        {stats.cardCount === 0 && !collection.isDefault && (
          <div className="empty-collection-notice">
            <span className="empty-icon">📭</span>
            <span className="empty-text">Empty Collection</span>
          </div>
        )}

        {Object.keys(stats.categoryBreakdown).length > 0 && (
          <div className="category-breakdown">
            {Object.entries(stats.categoryBreakdown)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([category, count]) => (
                <span key={category} className="category-chip">
                  {category}: {count}
                </span>
              ))}
          </div>
        )}

        {collection.tags && collection.tags.length > 0 && (
          <div className="collection-tags">
            {collection.tags.map(tag => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="collection-footer">
        <button onClick={onSelect} className="view-collection-btn">
          View Collection →
        </button>
      </div>
    </div>
  );
};

export default CollectionCard;