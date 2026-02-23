import { Card } from '../types';

// Instant export function - exports ALL unsold cards immediately
export const instantExportAllUnsoldCards = (cards: Card[]) => {
  // Get all unsold, non-PC cards
  const unsoldCards = cards.filter(card => !card.sellDate && card.collectionType === 'Inventory');
  
  if (unsoldCards.length === 0) {
    console.log('No unsold cards to export');
    return null;
  }
  
  // Generate CSV content with eBay-compatible format
  const headers = [
    'Title',
    'Starting Price',
    'Buy It Now Price',
    'Quantity',
    'Duration',
    'Category',
    'Condition',
    'Brand',
    'Player',
    'Year',
    'Card Number',
    'Team',
    'Current Value',
    'Purchase Price',
    'Profit',
    'ROI %'
  ];
  
  const rows = unsoldCards.map(card => {
    const startPrice = (card.currentValue * 0.9).toFixed(2);
    const binPrice = (card.currentValue * 0.95).toFixed(2);
    const profit = card.currentValue - card.purchasePrice;
    const roi = ((profit / card.purchasePrice) * 100).toFixed(1);
    
    // Generate title
    const titleParts = [
      card.year,
      card.brand,
      card.player,
      `#${card.cardNumber}`
    ];
    
    if (card.parallel) titleParts.push(card.parallel);
    if (card.gradingCompany) titleParts.push(`${card.gradingCompany} ${card.condition}`);
    titleParts.push(card.category);
    
    let title = titleParts.join(' ');
    if (title.length > 80) title = title.substring(0, 77) + '...';
    
    return [
      `"${title}"`,
      startPrice,
      binPrice,
      '1',
      '7', // 7-day auction
      getCategoryName(card.category),
      card.condition,
      card.brand,
      card.player,
      card.year,
      card.cardNumber,
      card.team,
      card.currentValue.toFixed(2),
      card.purchasePrice.toFixed(2),
      profit.toFixed(2),
      roi
    ];
  });
  
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  
  link.href = url;
  link.download = `ebay-all-unsold-cards-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Return summary
  return {
    count: unsoldCards.length,
    totalValue: unsoldCards.reduce((sum, card) => sum + card.currentValue, 0),
    totalStartingPrice: unsoldCards.reduce((sum, card) => sum + (card.currentValue * 0.9), 0),
    totalProfit: unsoldCards.reduce((sum, card) => sum + (card.currentValue - card.purchasePrice), 0),
    filename: link.download
  };
};

const getCategoryName = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'Baseball': 'Baseball Cards',
    'Basketball': 'Basketball Cards',
    'Football': 'Football Cards',
    'Hockey': 'Hockey Cards',
    'Soccer': 'Soccer Cards',
    'Pokemon': 'Pokemon Cards',
    'Other': 'Sports Trading Cards'
  };
  
  return categoryMap[category] || 'Trading Cards';
};