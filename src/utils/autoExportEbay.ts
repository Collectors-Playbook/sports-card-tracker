import { Card } from '../types';
import { apiService } from '../services/api';

// Automatically export ALL unsold cards - no user interaction needed
export const autoExportAllUnsoldCards = async () => {
  try {
    // Get cards from API
    const cards = await apiService.getAllCards();
    
    if (!cards || cards.length === 0) {
      console.log('No cards found in database');
      return null;
    }
    
    const unsoldCards = cards.filter(card => !card.sellDate);
  
  if (unsoldCards.length === 0) {
    console.log('No unsold cards to export');
    return null;
  }

  console.log(`Exporting ${unsoldCards.length} unsold cards...`);

  // Generate CSV content
  const rows: string[][] = [];
  
  // Headers
  rows.push([
    'Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
    'ItemID',
    'Category',
    'Title',
    'Description',
    'PicURL',
    'Quantity',
    'StartPrice',
    'BuyItNowPrice',
    'Duration',
    'ImmediatePayRequired',
    'Location',
    'PayPalEmailAddress',
    'PaymentMethods',
    'ConditionID',
    'DispatchTimeMax',
    'ReturnsAcceptedOption',
    'RefundOption',
    'ReturnsWithinOption',
    'ShippingCostPaidByOption',
    'ShippingType',
    'ShippingService1Option',
    'ShippingService1Cost',
    'GalleryType',
    'BoldTitle',
    'Subtitle',
    'StoreCategory',
    'CustomLabel'
  ]);

  // Process each card
  unsoldCards.forEach((card, index) => {
    // Generate optimized title
    const titleParts = [];
    titleParts.push(card.year.toString());
    titleParts.push(card.brand);
    titleParts.push(card.player);
    titleParts.push(`#${card.cardNumber}`);
    
    if (card.parallel) {
      titleParts.push(card.parallel);
    }
    
    if (card.notes?.toLowerCase().includes('rookie') || card.notes?.toLowerCase().includes('rc')) {
      titleParts.push('ROOKIE RC');
    }
    
    if (card.gradingCompany && card.condition !== 'RAW') {
      titleParts.push(card.gradingCompany);
      titleParts.push(card.condition);
    }
    
    titleParts.push(card.category.toUpperCase());
    
    let title = titleParts.join(' ');
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }

    // Generate description
    const description = `
<div style="font-family: Arial, sans-serif;">
<h2>${card.year} ${card.brand} ${card.player}</h2>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #f5f5f5;">
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Player:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.player}</td>
</tr>
<tr>
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Team:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.team}</td>
</tr>
<tr style="background: #f5f5f5;">
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Year:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.year}</td>
</tr>
<tr>
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Brand:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.brand}</td>
</tr>
<tr style="background: #f5f5f5;">
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Card Number:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">#${card.cardNumber}</td>
</tr>
${card.parallel ? `
<tr>
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Parallel:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.parallel}</td>
</tr>
` : ''}
<tr style="background: #f5f5f5;">
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Condition:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.condition}</td>
</tr>
${card.gradingCompany ? `
<tr>
  <td style="padding: 10px; border: 1px solid #ddd;"><strong>Grading Company:</strong></td>
  <td style="padding: 10px; border: 1px solid #ddd;">${card.gradingCompany}</td>
</tr>
` : ''}
</table>

${card.notes ? `<p><strong>Additional Information:</strong><br>${card.notes}</p>` : ''}

<h3>Shipping & Handling</h3>
<ul>
<li>Ships in protective sleeve and toploader</li>
<li>Secure bubble mailer with tracking</li>
<li>Ships within 1 business day of payment</li>
<li>Combined shipping available for multiple purchases</li>
</ul>

<p style="font-size: 12px; color: #666;">
All cards are 100% authentic. Please see photos for exact condition. 
From a smoke-free environment. Thanks for looking!
</p>
</div>
`.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Calculate prices
    const startPrice = (card.currentValue * 0.85).toFixed(2);
    const binPrice = (card.currentValue * 0.95).toFixed(2);

    // Get category ID
    const categoryMap: Record<string, string> = {
      'Baseball': '261328',
      'Basketball': '261329',
      'Football': '261330',
      'Hockey': '261331',
      'Soccer': '261333',
      'Pokemon': '183454',
      'Other': '261324'
    };
    const categoryId = categoryMap[card.category] || '261324';

    // Get condition ID
    let conditionId = '3000'; // Used
    if (card.gradingCompany) {
      if (card.condition.includes('10')) conditionId = '275000';
      else if (card.condition.includes('9.5')) conditionId = '275001';
      else if (card.condition.includes('9')) conditionId = '275002';
      else if (card.condition.includes('8')) conditionId = '275003';
      else if (card.condition.includes('7')) conditionId = '275004';
    }

    // Add row
    rows.push([
      'Add', // Action
      '', // ItemID (leave blank for new listings)
      categoryId, // Category
      title, // Title
      description, // Description
      '', // PicURL
      '1', // Quantity
      startPrice, // StartPrice
      binPrice, // BuyItNowPrice
      'Days_7', // Duration
      '1', // ImmediatePayRequired
      'United States', // Location
      '', // PayPalEmailAddress
      'PayPal', // PaymentMethods
      conditionId, // ConditionID
      '1', // DispatchTimeMax
      'ReturnsAccepted', // ReturnsAcceptedOption
      'MoneyBack', // RefundOption
      'Days_30', // ReturnsWithinOption
      'Buyer', // ShippingCostPaidByOption
      'Flat', // ShippingType
      'USPSFirstClass', // ShippingService1Option
      '4.99', // ShippingService1Cost
      'Gallery', // GalleryType
      '0', // BoldTitle
      '', // Subtitle
      '', // StoreCategory
      card.id // CustomLabel
    ]);
  });

  // Convert to CSV
  const csv = rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or quotes
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',')
  ).join('\n');

  // Download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  link.href = url;
  link.download = `eBay-Listings-ALL-CARDS-${timestamp}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);

  console.log(`Successfully exported ${unsoldCards.length} cards to ${link.download}`);

  return {
    success: true,
    count: unsoldCards.length,
    totalValue: unsoldCards.reduce((sum, card) => sum + card.currentValue, 0),
    totalStartPrice: unsoldCards.reduce((sum, card) => sum + (card.currentValue * 0.85), 0),
    filename: link.download
  };
  } catch (error) {
    console.error('Error exporting cards:', error);
    return null;
  }
};

// Execute immediately when this module is imported
if (typeof window !== 'undefined') {
  // Auto-execute after a short delay to ensure DOM and RxDB are ready
  setTimeout(async () => {
    const result = await autoExportAllUnsoldCards();
    if (result) {
      console.log('Auto-export completed:', result);
    }
  }, 100);
}