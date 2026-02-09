import { Card } from '../types';
import { generateEbayFileExchange, EbayExportOptions } from './ebayExport';

// Quick export all unsold cards with optimized settings
export const quickExportAllUnsoldCards = (cards: Card[], userEmail?: string) => {
  // Filter only unsold, non-PC cards
  const unsoldCards = cards.filter(card => !card.sellDate && card.collectionType !== 'PC');
  
  if (unsoldCards.length === 0) {
    alert('No unsold cards to export!');
    return;
  }
  
  // Use optimized default settings
  const exportOptions: EbayExportOptions = {
    priceMultiplier: 0.9, // Start at 90% of current value
    shippingCost: 4.99,   // Standard shipping
    duration: '7',        // 7-day auction
    location: 'United States',
    paypalEmail: userEmail || 'update@youremail.com',
    dispatchTime: 1      // Ships next business day
  };
  
  // Generate the eBay File Exchange format
  const fileContent = generateEbayFileExchange(unsoldCards, exportOptions);
  
  // Create filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `ebay-all-unsold-cards-${timestamp}.csv`;
  
  // Download the file
  const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Show success message with stats
  const totalValue = unsoldCards.reduce((sum, card) => sum + (card.currentValue * 0.9), 0);
  const avgPrice = totalValue / unsoldCards.length;
  
  alert(`Successfully exported ${unsoldCards.length} unsold cards!\n\nTotal listing value: $${totalValue.toFixed(2)}\nAverage price: $${avgPrice.toFixed(2)}\n\nFile saved as: ${filename}`);
  
  // Log summary to console
  console.log('eBay Export Summary:', {
    totalCards: unsoldCards.length,
    totalValue: totalValue.toFixed(2),
    averagePrice: avgPrice.toFixed(2),
    filename: filename,
    exportedAt: new Date().toISOString()
  });
  
  return {
    success: true,
    count: unsoldCards.length,
    totalValue,
    filename
  };
};

// Generate a detailed summary report
export const generateExportSummary = (cards: Card[]) => {
  const unsoldCards = cards.filter(card => !card.sellDate && card.collectionType !== 'PC');
  
  const summary = {
    totalUnsoldCards: unsoldCards.length,
    byCategory: {} as Record<string, number>,
    byYear: {} as Record<string, number>,
    byCondition: {} as Record<string, number>,
    totalValue: 0,
    averageValue: 0,
    highestValue: null as Card | null,
    lowestValue: null as Card | null,
    gradedCards: 0,
    rawCards: 0
  };
  
  unsoldCards.forEach(card => {
    // By category
    summary.byCategory[card.category] = (summary.byCategory[card.category] || 0) + 1;
    
    // By year
    summary.byYear[card.year] = (summary.byYear[card.year] || 0) + 1;
    
    // By condition
    summary.byCondition[card.condition] = (summary.byCondition[card.condition] || 0) + 1;
    
    // Value calculations
    summary.totalValue += card.currentValue;
    
    // Track highest/lowest
    if (!summary.highestValue || card.currentValue > summary.highestValue.currentValue) {
      summary.highestValue = card;
    }
    if (!summary.lowestValue || card.currentValue < summary.lowestValue.currentValue) {
      summary.lowestValue = card;
    }
    
    // Graded vs raw
    if (card.gradingCompany) {
      summary.gradedCards++;
    } else {
      summary.rawCards++;
    }
  });
  
  summary.averageValue = summary.totalValue / unsoldCards.length;
  
  return summary;
};