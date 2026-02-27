import React, { useState, memo, useCallback } from 'react';
import { Card } from '../../types';
import { exportDetailedCardReport } from '../../utils/pdfExport';
import { EbayListingPreview } from '../EbayListing/EbayListingPreview';
import { BreakEvenCalculator } from '../BreakEvenCalculator/BreakEvenCalculator';
import { GradingRoiAnalyzer } from '../GradingRoiAnalyzer/GradingRoiAnalyzer';
import './CardDetail.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

function cardImageUrl(filename: string): string {
  return `${API_BASE_URL}/files/processed/${encodeURIComponent(filename)}`;
}

interface CardDetailProps {
  card: Card;
  onEdit?: (card: Card) => void;
  onClose?: () => void;
}

const CardDetail: React.FC<CardDetailProps> = ({ card, onEdit, onClose }) => {
  const [imageIndex, setImageIndex] = useState(0);
  const [showEbayListing, setShowEbayListing] = useState(false);
  const [showBreakEven, setShowBreakEven] = useState(false);
  const [showGradingRoi, setShowGradingRoi] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const profit = card.currentValue - card.purchasePrice;
  const profitPercent = (profit / card.purchasePrice) * 100;
  const isSold = card.sellPrice && card.sellDate;

  const nextImage = useCallback(() => {
    if (card.images.length > 0) {
      setImageIndex((prev) => (prev + 1) % card.images.length);
    }
  }, [card.images.length]);

  const prevImage = useCallback(() => {
    if (card.images.length > 0) {
      setImageIndex((prev) => (prev - 1 + card.images.length) % card.images.length);
    }
  }, [card.images.length]);

  const handleExportPDF = useCallback(() => {
    try {
      exportDetailedCardReport(card);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    }
  }, [card]);

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail" onClick={(e) => e.stopPropagation()}>
        <div className="card-detail-header">
          <h2>{card.year} {card.brand} {card.player}</h2>
          <div className="card-detail-actions">
            <button onClick={handleExportPDF} className="export-pdf-btn" title="Export to PDF">
              📄 PDF
            </button>
            <button onClick={() => setShowEbayListing(true)} className="ebay-listing-btn" title="Generate eBay Listing">
              🛒 eBay
            </button>
            <button onClick={() => setShowBreakEven(true)} className="break-even-btn" title="Break-Even Calculator">
              Break-Even
            </button>
            {!card.isGraded && (
              <button onClick={() => setShowGradingRoi(true)} className="grading-roi-btn" title="Grading ROI Analysis">
                Grade ROI
              </button>
            )}
            {onEdit && (
              <button onClick={() => onEdit(card)} className="edit-btn">
                Edit Card
              </button>
            )}
            <button onClick={onClose} className="close-btn">
              ×
            </button>
          </div>
        </div>

        <div className="card-detail-content">
          <div className="card-detail-left">
            <div className="card-images">
              <div className="image-viewer">
                <img
                  src={card.images && card.images.length > 0 ? cardImageUrl(card.images[imageIndex]) : '/generic.png'}
                  alt={`${card.player} card ${card.images && card.images.length > 0 ? imageIndex + 1 : ''}`}
                  className="card-image"
                />
                {card.images && card.images.length > 1 && (
                  <div className="image-thumbnails">
                    {card.images.map((image, index) => (
                      <button
                        key={index}
                        className={`thumbnail ${index === imageIndex ? 'active' : ''}`}
                        onClick={() => setImageIndex(index)}
                      >
                        <img src={cardImageUrl(image)} alt={`Thumbnail ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                )}
                {card.images && card.images.length > 1 && (
                  <div className="image-controls">
                    <button onClick={prevImage} className="image-nav prev">‹</button>
                    <span className="image-counter">
                      {imageIndex + 1} of {card.images.length}
                    </span>
                    <button onClick={nextImage} className="image-nav next">›</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card-detail-right">
            <div className="card-info-section">
              <h3>Card Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Player</label>
                  <span>{card.player}</span>
                </div>
                <div className="info-item">
                  <label>Team</label>
                  <span>{card.team}</span>
                </div>
                <div className="info-item">
                  <label>Year</label>
                  <span>{card.year}</span>
                </div>
                <div className="info-item">
                  <label>Brand</label>
                  <span>{card.brand}</span>
                </div>
                <div className="info-item">
                  <label>Category</label>
                  <span>{card.category}</span>
                </div>
                <div className="info-item">
                  <label>Card Number</label>
                  <span>#{card.cardNumber}</span>
                </div>
                {card.parallel && (
                  <div className="info-item">
                    <label>Parallel</label>
                    <span>{card.parallel}</span>
                  </div>
                )}
                <div className="info-item">
                  <label>Condition</label>
                  <span>{card.condition}</span>
                </div>
                {card.gradingCompany && (
                  <div className="info-item">
                    <label>Grading Company</label>
                    <span>{card.gradingCompany}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="financial-section">
              <h3>Financial Information</h3>
              <div className="financial-grid">
                <div className="financial-item">
                  <label>Purchase Price</label>
                  <span>{formatCurrency(card.purchasePrice)}</span>
                </div>
                <div className="financial-item">
                  <label>Purchase Date</label>
                  <span>{formatDate(card.purchaseDate)}</span>
                </div>
                <div className="financial-item">
                  <label>Current Value</label>
                  <span>{formatCurrency(card.currentValue)}</span>
                </div>
                <div className="financial-item">
                  <label>Profit/Loss</label>
                  <span className={`profit-loss ${profit >= 0 ? 'profit' : 'loss'}`}>
                    {formatCurrency(profit)} ({profit > 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                  </span>
                </div>
                {isSold && (
                  <>
                    <div className="financial-item">
                      <label>Sell Price</label>
                      <span>{formatCurrency(card.sellPrice!)}</span>
                    </div>
                    <div className="financial-item">
                      <label>Sell Date</label>
                      <span>{formatDate(card.sellDate!)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {card.notes && (
              <div className="notes-section">
                <h3>Notes</h3>
                <div className="notes-content">
                  {card.notes}
                </div>
              </div>
            )}

            <div className="metadata-section">
              <h3>Metadata</h3>
              <div className="metadata-grid">
                <div className="metadata-item">
                  <label>Added</label>
                  <span>{formatDate(card.createdAt)}</span>
                </div>
                <div className="metadata-item">
                  <label>Last Updated</label>
                  <span>{formatDate(card.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showEbayListing && (
        <EbayListingPreview
          card={card}
          onClose={() => setShowEbayListing(false)}
        />
      )}
      {showBreakEven && (
        <BreakEvenCalculator
          card={card}
          onClose={() => setShowBreakEven(false)}
        />
      )}
      {showGradingRoi && (
        <GradingRoiAnalyzer
          card={card}
          onClose={() => setShowGradingRoi(false)}
        />
      )}
    </div>
  );
};

export default memo(CardDetail);