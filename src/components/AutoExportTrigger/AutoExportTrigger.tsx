import React, { useEffect } from 'react';
import { useCards } from '../../context/ApiCardContext';

const AutoExportTrigger: React.FC = () => {
  const { state } = useCards();

  useEffect(() => {
    // Export all unsold cards immediately
    const unsoldCards = state.cards.filter(card => !('sellDate' in card) || !card.sellDate);
    
    if (unsoldCards.length === 0) {
      console.log('No unsold cards to export');
      return;
    }

    console.log(`Auto-exporting ${unsoldCards.length} unsold cards...`);

    // Generate eBay bulk upload CSV
    const headers = [
      '*Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)',
      '*Category',
      '*Title',
      '*Description',
      '*ConditionID',
      '*PicURL',
      '*Quantity',
      '*Format',
      '*StartPrice',
      'BuyItNowPrice',
      '*Duration',
      '*Location',
      'PaymentMethods',
      '*DispatchTimeMax',
      '*ReturnsAcceptedOption',
      'ShippingType',
      'ShippingService-1:Option',
      'ShippingService-1:Cost'
    ];

    const rows = [headers];

    unsoldCards.forEach(card => {
      // Title
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

      // Description
      const desc = `${card.year} ${card.brand} ${card.player} #${card.cardNumber} ${card.team} ${card.category}. Condition: ${card.condition}. ${card.notes || ''} Ships fast with tracking!`;

      // Category
      const categoryMap: Record<string, string> = {
        'Baseball': '261328',
        'Basketball': '261329',
        'Football': '261330',
        'Hockey': '261331',
        'Soccer': '261333',
        'Pokemon': '183454'
      };

      // Condition
      let conditionId = '3000';
      if (card.condition.includes('10')) conditionId = '275000';
      else if (card.condition.includes('9')) conditionId = '275002';

      const row = [
        'Add',
        categoryMap[card.category] || '261324',
        title,
        desc,
        conditionId,
        '', // PicURL
        '1',
        'FixedPrice',
        (card.currentValue * 0.90).toFixed(2),
        (card.currentValue * 0.95).toFixed(2),
        'Days_7',
        'USA',
        'PayPal',
        '1',
        'ReturnsAccepted',
        'Flat',
        'USPSFirstClass',
        '4.99'
      ];

      rows.push(row);
    });

    // Create CSV
    const csvContent = rows.map(row => 
      row.map(cell => {
        const str = String(cell);
        return str.includes(',') || str.includes('"') 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      }).join(',')
    ).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eBay-ALL-UNSOLD-CARDS-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Exported ${unsoldCards.length} cards to ${a.download}`);
  }, [state.cards]);

  return null; // This component doesn't render anything
};

export default AutoExportTrigger;