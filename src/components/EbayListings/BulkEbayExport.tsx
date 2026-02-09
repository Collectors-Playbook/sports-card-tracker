import React, { useState } from 'react';
import { Card } from '../../types';
import { generateEbayFileExchange, generateSimpleListings } from '../../utils/ebayExport';
import apiService from '../../services/api';
import './BulkEbayExport.css';

interface EbayListing {
  card: Card;
  title: string;
  description: string;
  startingPrice: number;
  buyItNowPrice: number;
  category: string;
  condition: string;
  quantity: number;
  duration: string;
  shippingCost: number;
  returnPolicy: string;
  paymentMethods: string[];
}

interface Props {
  cards: Card[];
  onClose: () => void;
}

const BulkEbayExport: React.FC<Props> = ({ cards, onClose }) => {
  const [includeUnsold, setIncludeUnsold] = useState(true);
  const [includeSold, setIncludeSold] = useState(false);
  const [priceMultiplier, setPriceMultiplier] = useState(0.9);
  const [shippingCost, setShippingCost] = useState(4.99);
  const [duration, setDuration] = useState('7');
  const [exportFormat, setExportFormat] = useState<'csv' | 'txt' | 'ebay'>('ebay');
  const [location, setLocation] = useState('USA');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [autoExportAll, setAutoExportAll] = useState(false);
  const [useBackend, setUseBackend] = useState(false);
  const [serverExporting, setServerExporting] = useState(false);

  const generateEbayTitle = (card: Card): string => {
    const parts = [];
    
    // Year and brand
    parts.push(`${card.year} ${card.brand}`);
    
    // Player name
    parts.push(card.player);
    
    // Card number
    parts.push(`#${card.cardNumber}`);
    
    // Parallel/variation
    if (card.parallel) {
      parts.push(card.parallel);
    }
    
    // Rookie indicator
    if (card.notes?.toLowerCase().includes('rookie')) {
      parts.push('RC ROOKIE');
    }
    
    // Grading info
    if (card.gradingCompany) {
      parts.push(`${card.gradingCompany} ${card.condition}`);
    }
    
    // Category
    parts.push(card.category);
    
    // Limit to 80 characters (eBay limit)
    let title = parts.join(' ');
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
    
    return title;
  };

  const generateDescription = (card: Card): string => {
    const lines = [];
    
    lines.push(`${card.year} ${card.brand} ${card.player} #${card.cardNumber}`);
    
    if (card.parallel) {
      lines.push(`Parallel/Variation: ${card.parallel}`);
    }
    
    lines.push('');
    lines.push(`Condition: ${card.condition}`);
    
    if (card.gradingCompany) {
      lines.push(`Professionally graded by ${card.gradingCompany}`);
      lines.push(`Grade: ${card.condition}`);
    }
    
    lines.push('');
    lines.push(`Sport: ${card.category}`);
    lines.push(`Team: ${card.team}`);
    
    if (card.notes) {
      lines.push('');
      lines.push('Additional Information:');
      lines.push(card.notes);
    }
    
    lines.push('');
    lines.push('SHIPPING & HANDLING:');
    lines.push('- Card will be shipped in protective sleeve and toploader');
    lines.push('- Bubble mailer with tracking included');
    lines.push('- Ships within 1 business day of payment');
    
    lines.push('');
    lines.push('CONDITION:');
    lines.push('- Please see photos for exact condition');
    lines.push('- All cards are authentic');
    lines.push('- Smoke-free environment');
    
    lines.push('');
    lines.push('RETURNS:');
    lines.push('- 30-day return policy');
    lines.push('- Buyer pays return shipping');
    
    return lines.join('\n');
  };

  const determineEbayCategory = (card: Card): string => {
    const categoryMap: Record<string, string> = {
      'Baseball': '261328', // Baseball Cards
      'Basketball': '261329', // Basketball Cards
      'Football': '261330', // Football Cards
      'Hockey': '261331', // Hockey Cards
      'Soccer': '261333', // Soccer Cards
      'Pokemon': '183454', // Pokémon Individual Cards
      'Other': '261324' // Other Sports Trading Cards
    };
    
    return categoryMap[card.category] || categoryMap['Other'];
  };

  const createListings = (): EbayListing[] => {
    // Always exclude PC cards from eBay exports
    let filteredCards = cards.filter(card => card.collectionType !== 'PC');

    if (!includeUnsold) {
      filteredCards = filteredCards.filter(card => card.sellDate);
    }

    if (!includeSold) {
      filteredCards = filteredCards.filter(card => !card.sellDate);
    }
    
    return filteredCards.map(card => ({
      card,
      title: generateEbayTitle(card),
      description: generateDescription(card),
      startingPrice: Math.round(card.currentValue * priceMultiplier * 100) / 100,
      buyItNowPrice: Math.round(card.currentValue * 0.95 * 100) / 100,
      category: determineEbayCategory(card),
      condition: card.gradingCompany ? 'Used' : 'Used',
      quantity: 1,
      duration: duration,
      shippingCost: shippingCost,
      returnPolicy: '30 Day Returns',
      paymentMethods: ['PayPal', 'Credit Card']
    }));
  };

  const exportAsCSV = (listings: EbayListing[]) => {
    const headers = [
      'Title',
      'Description',
      'Starting Price',
      'Buy It Now Price',
      'Category ID',
      'Condition',
      'Quantity',
      'Duration',
      'Shipping Cost',
      'Return Policy',
      'Payment Methods',
      'Card ID',
      'Player',
      'Year',
      'Brand'
    ];
    
    const rows = listings.map(listing => [
      `"${listing.title}"`,
      `"${listing.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      listing.startingPrice.toFixed(2),
      listing.buyItNowPrice.toFixed(2),
      listing.category,
      listing.condition,
      listing.quantity,
      listing.duration,
      listing.shippingCost.toFixed(2),
      listing.returnPolicy,
      listing.paymentMethods.join(';'),
      listing.card.id,
      listing.card.player,
      listing.card.year,
      listing.card.brand
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ebay-listings-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsEbayFE = (listings: EbayListing[]) => {
    const fileContent = generateEbayFileExchange(
      listings.map(l => l.card),
      {
        priceMultiplier,
        shippingCost,
        duration,
        location,
        paypalEmail: paypalEmail || 'yourpaypal@email.com',
        dispatchTime: 1
      }
    );
    
    const blob = new Blob([fileContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ebay-file-exchange-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsTxt = (listings: EbayListing[]) => {
    const content = listings.map((listing, index) => {
      return `
========================================
LISTING ${index + 1} of ${listings.length}
========================================

TITLE: ${listing.title}

STARTING PRICE: $${listing.startingPrice.toFixed(2)}
BUY IT NOW: $${listing.buyItNowPrice.toFixed(2)}
CATEGORY ID: ${listing.category}
DURATION: ${listing.duration} days
SHIPPING: $${listing.shippingCost.toFixed(2)}

DESCRIPTION:
${listing.description}

========================================
`;
    }).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ebay-listings-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleServerExport = async () => {
    setServerExporting(true);
    try {
      const result = await apiService.generateEbayCsv({
        priceMultiplier,
        shippingCost,
        duration,
        location,
        dispatchTime: 1,
      });

      const blob = await apiService.downloadEbayCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(
        `Server generated ${result.totalCards} listings (${result.skippedPcCards} PC cards excluded). Total value: $${result.totalListingValue.toFixed(2)}`
      );
    } catch (err) {
      alert(`Server export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setServerExporting(false);
    }
  };

  const handleExport = () => {
    if (useBackend) {
      handleServerExport();
      return;
    }

    const listings = createListings();

    if (listings.length === 0) {
      alert('No cards match the selected criteria');
      return;
    }

    if (exportFormat === 'csv') {
      exportAsCSV(listings);
    } else if (exportFormat === 'txt') {
      exportAsTxt(listings);
    } else if (exportFormat === 'ebay') {
      exportAsEbayFE(listings);
    }

    alert(`Successfully exported ${listings.length} eBay listings!`);
  };

  const previewListings = createListings();
  const totalValue = previewListings.reduce((sum, listing) => sum + listing.startingPrice, 0);
  const avgPrice = previewListings.length > 0 ? totalValue / previewListings.length : 0;

  return (
    <div className="bulk-export-modal">
      <div className="bulk-export-content">
        <div className="bulk-export-header">
          <h2>Bulk eBay Listing Export</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="export-options">
          <div className="option-group">
            <h3>Cards to Include</h3>
            <label>
              <input
                type="checkbox"
                checked={includeUnsold}
                onChange={(e) => setIncludeUnsold(e.target.checked)}
              />
              Unsold Cards
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeSold}
                onChange={(e) => setIncludeSold(e.target.checked)}
              />
              Sold Cards (for reference)
            </label>
          </div>

          <div className="option-group">
            <h3>Pricing Settings</h3>
            <label>
              Starting Price Multiplier
              <input
                type="number"
                value={priceMultiplier}
                onChange={(e) => setPriceMultiplier(Number(e.target.value))}
                min="0.5"
                max="1.0"
                step="0.05"
              />
              <span className="hint">{(priceMultiplier * 100).toFixed(0)}% of current value</span>
            </label>
            
            <label>
              Shipping Cost
              <input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                min="0"
                step="0.01"
              />
            </label>
          </div>

          <div className="option-group">
            <h3>Listing Settings</h3>
            <label>
              <input
                type="checkbox"
                checked={useBackend}
                onChange={(e) => setUseBackend(e.target.checked)}
              />
              Generate on server
            </label>
            <label>
              Duration
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="3">3 days</option>
                <option value="5">5 days</option>
                <option value="7">7 days</option>
                <option value="10">10 days</option>
                <option value="30">30 days (Buy It Now)</option>
              </select>
            </label>
            
            <label>
              Export Format
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'csv' | 'txt' | 'ebay')}>
                <option value="csv">CSV (Basic Format)</option>
                <option value="txt">Text (Copy/Paste)</option>
                <option value="ebay">eBay File Exchange</option>
              </select>
            </label>
            
            {exportFormat === 'ebay' && (
              <>
                <label>
                  Location
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., New York, NY"
                  />
                </label>
                
                <label>
                  PayPal Email
                  <input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        <div className="export-preview">
          <h3>Preview</h3>
          <div className="preview-stats">
            <div className="stat">
              <span className="label">Total Listings:</span>
              <span className="value">{previewListings.length}</span>
            </div>
            <div className="stat">
              <span className="label">Total Value:</span>
              <span className="value">${totalValue.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="label">Average Price:</span>
              <span className="value">${avgPrice.toFixed(2)}</span>
            </div>
          </div>
          
          {previewListings.length > 0 && (
            <div className="preview-sample">
              <h4>Sample Listing:</h4>
              <div className="sample-listing">
                <p><strong>Title:</strong> {previewListings[0].title}</p>
                <p><strong>Price:</strong> ${previewListings[0].startingPrice.toFixed(2)} / BIN: ${previewListings[0].buyItNowPrice.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="export-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleExport} disabled={serverExporting}>
            {serverExporting ? 'Generating...' : `Export ${previewListings.length} Listings`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEbayExport;