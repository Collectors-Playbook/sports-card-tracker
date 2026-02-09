// eBay Listing Service - Generates professional eBay listings for cards
import { Card } from '../types';

export interface EbayListingOptions {
  includeImages: boolean;
  listingFormat: 'auction' | 'buyItNow' | 'both';
  duration: 3 | 5 | 7 | 10 | 30;
  shippingType: 'standard' | 'expedited' | 'express';
  returnPolicy: boolean;
  watermarkImages: boolean;
  includeGradingDetails: boolean;
  includeMarketData: boolean;
}

export interface EbayListing {
  title: string;
  description: string;
  category: string;
  categoryId: number;
  condition: string;
  conditionId: number;
  startingPrice?: number;
  buyItNowPrice?: number;
  shippingCost: number;
  handlingTime: number;
  returnPeriod?: number;
  images: string[];
  itemSpecifics: Record<string, string>;
  searchKeywords: string[];
}

// eBay category mappings for sports cards
const EBAY_CATEGORIES = {
  'Baseball': { name: 'Baseball Cards', id: 213 },
  'Basketball': { name: 'Basketball Cards', id: 214 },
  'Football': { name: 'Football Cards', id: 215 },
  'Hockey': { name: 'Hockey Cards', id: 216 },
  'Soccer': { name: 'Soccer Cards', id: 183435 },
  'Pokemon': { name: 'Pokémon Individual Cards', id: 183454 },
  'Other': { name: 'Other Sports Trading Cards', id: 212 }
};

// Condition mappings
const CONDITION_MAP: Record<string, { name: string; id: number }> = {
  'Mint': { name: 'Near Mint or Better', id: 4000 },
  'Near Mint': { name: 'Near Mint or Better', id: 4000 },
  'Excellent': { name: 'Excellent', id: 3000 },
  'Very Good': { name: 'Very Good', id: 2000 },
  'Good': { name: 'Good', id: 1000 },
  'Fair': { name: 'Acceptable', id: 500 },
  'Poor': { name: 'Acceptable', id: 500 }
};

export class EbayListingService {
  /**
   * Generates a complete eBay listing for a card
   */
  generateListing(card: Card, options: EbayListingOptions): EbayListing {
    const title = this.generateTitle(card);
    const description = this.generateDescription(card, options);
    const category = this.getCategory(card);
    const condition = this.getCondition(card);
    const itemSpecifics = this.generateItemSpecifics(card);
    const searchKeywords = this.generateSearchKeywords(card);
    const prices = this.suggestPricing(card, options);
    
    return {
      title,
      description,
      category: category.name,
      categoryId: category.id,
      condition: condition.name,
      conditionId: condition.id,
      startingPrice: prices.startingPrice,
      buyItNowPrice: prices.buyItNowPrice,
      shippingCost: this.calculateShipping(card, options.shippingType),
      handlingTime: 1,
      returnPeriod: options.returnPolicy ? 30 : undefined,
      images: options.includeImages ? this.prepareImages(card, options.watermarkImages) : [],
      itemSpecifics,
      searchKeywords
    };
  }

  /**
   * Generates an optimized eBay title (80 character limit)
   */
  private generateTitle(card: Card): string {
    const parts: string[] = [];
    
    // Add year
    if (card.year) {
      parts.push(card.year.toString());
    }
    
    // Add brand/manufacturer
    if (card.brand) {
      parts.push(card.brand);
    }
    
    // Add player name
    parts.push(card.player);
    
    // Add card number
    if (card.cardNumber) {
      parts.push(`#${card.cardNumber}`);
    }
    
    // Add special features
    const features: string[] = [];
    // Check for rookie cards based on card characteristics
    if (this.isLikelyRookie(card)) features.push('ROOKIE');
    if (card.parallel?.toLowerCase().includes('auto')) features.push('AUTO');
    if (card.parallel?.match(/\d+\/\d+/)) features.push(`#'d`);
    if (card.gradingCompany) features.push(`${card.gradingCompany}`);
    
    // Combine parts
    let title = parts.join(' ');
    if (features.length > 0) {
      title += ' ' + features.join(' ');
    }
    
    // Add parallel/variation
    if (card.parallel && title.length + card.parallel.length + 1 <= 80) {
      title += ' ' + card.parallel;
    }
    
    // Ensure title doesn't exceed 80 characters
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }
    
    return title;
  }

  /**
   * Generates a comprehensive HTML description
   */
  private generateDescription(card: Card, options: EbayListingOptions): string {
    const sections: string[] = [];
    
    // Header with title
    sections.push(`<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
<h1 style="color: #333; border-bottom: 3px solid #0654ba; padding-bottom: 10px;">
  ${this.generateTitle(card)}
</h1>`);

    // Card details section
    sections.push(this.generateDetailsSection(card));
    
    // Condition section
    sections.push(this.generateConditionSection(card));
    
    // Features section
    if (this.hasSpecialFeatures(card)) {
      sections.push(this.generateFeaturesSection(card));
    }
    
    // Grading section
    if (card.gradingCompany && options.includeGradingDetails) {
      sections.push(this.generateGradingSection(card));
    }
    
    // Market data section
    if (options.includeMarketData && card.purchasePrice) {
      sections.push(this.generateMarketSection(card));
    }
    
    // Shipping section
    sections.push(this.generateShippingSection(options));
    
    // Returns section
    if (options.returnPolicy) {
      sections.push(this.generateReturnsSection());
    }
    
    // Footer
    sections.push(this.generateFooter());
    
    sections.push('</div>');
    
    return sections.join('\n\n');
  }

  /**
   * Generates the details section
   */
  private generateDetailsSection(card: Card): string {
    return `
<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Card Details</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Year:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.year || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Brand:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.brand || 'N/A'}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Player:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.player}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Team:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.team || 'N/A'}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Card #:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.cardNumber || 'N/A'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Category:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${card.category}</td>
    </tr>
    ${card.parallel ? `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Parallel:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;" colspan="3">${card.parallel}</td>
    </tr>` : ''}
    ${card.parallel?.match(/\d+\/\d+/) ? `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Serial #:</strong></td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;" colspan="3">${card.parallel.match(/\d+\/\d+/)?.[0]}</td>
    </tr>` : ''}
  </table>
</div>`;
  }

  /**
   * Generates the condition section
   */
  private generateConditionSection(card: Card): string {
    const conditionDescriptions: Record<string, string> = {
      'Mint': 'Card is in perfect condition with no visible flaws.',
      'Near Mint': 'Card shows minimal wear with sharp corners and clean surfaces.',
      'Excellent': 'Card has light wear but remains in excellent collectible condition.',
      'Very Good': 'Card shows moderate wear but no major damage.',
      'Good': 'Card has visible wear but all elements are intact.',
      'Fair': 'Card shows significant wear but is complete.',
      'Poor': 'Card has heavy wear or damage.'
    };

    return `
<div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Condition: ${card.condition}</h2>
  <p style="margin: 10px 0;">${conditionDescriptions[card.condition] || 'See photos for condition details.'}</p>
  ${card.notes ? `<p style="margin: 10px 0;"><strong>Additional Notes:</strong> ${card.notes}</p>` : ''}
</div>`;
  }

  /**
   * Generates the features section
   */
  private generateFeaturesSection(card: Card): string {
    const features: string[] = [];
    
    if (this.isLikelyRookie(card)) features.push('🏆 Rookie Card');
    if (card.parallel?.toLowerCase().includes('auto')) features.push('✍️ Autographed');
    if (card.parallel?.match(/\d+\/\d+/)) features.push('🔢 Numbered');
    if (card.gradingCompany) features.push('💎 Professionally Graded');
    if (card.parallel?.toLowerCase().includes('refractor')) features.push('✨ Refractor');
    if (card.parallel?.toLowerCase().includes('patch')) features.push('🎯 Patch Card');
    if (card.parallel?.toLowerCase().includes('relic') || card.parallel?.toLowerCase().includes('memorabilia')) features.push('👕 Relic/Memorabilia');
    
    return `
<div style="background: #fff4e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Special Features</h2>
  <ul style="list-style: none; padding: 0;">
    ${features.map(f => `<li style="padding: 5px 0; font-size: 16px;">${f}</li>`).join('\n    ')}
  </ul>
</div>`;
  }

  /**
   * Generates the grading section
   */
  private generateGradingSection(card: Card): string {
    return `
<div style="background: #f0f0ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Professional Grading</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px;"><strong>Company:</strong></td>
      <td style="padding: 8px;">${card.gradingCompany}</td>
    </tr>
    <tr>
      <td style="padding: 8px;"><strong>Grade:</strong></td>
      <td style="padding: 8px; font-size: 20px; font-weight: bold; color: #0654ba;">${this.extractGradeFromCondition(card.condition) || 'N/A'}</td>
    </tr>
  </table>
  <p style="margin-top: 15px;">
    <em>Grade is guaranteed authentic. Verify on ${card.gradingCompany}'s website using the cert number.</em>
  </p>
</div>`;
  }

  /**
   * Generates market data section
   */
  private generateMarketSection(card: Card): string {
    const marketValue = card.currentValue || card.purchasePrice || 0;
    
    return `
<div style="background: #f0fff0; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Market Information</h2>
  <p>Recent comparable sales suggest a market value of approximately <strong>$${marketValue.toFixed(2)}</strong>.</p>
  <p style="font-size: 14px; color: #666;">
    <em>Market values are estimates based on recent sales of similar cards.</em>
  </p>
</div>`;
  }

  /**
   * Generates shipping section
   */
  private generateShippingSection(options: EbayListingOptions): string {
    const shippingInfo: Record<string, string> = {
      'standard': 'USPS First Class Mail with tracking (3-5 business days)',
      'expedited': 'USPS Priority Mail (1-3 business days)',
      'express': 'USPS Priority Mail Express (1-2 business days)'
    };

    return `
<div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Shipping Information</h2>
  <p><strong>Method:</strong> ${shippingInfo[options.shippingType]}</p>
  <p><strong>Handling Time:</strong> Ships within 1 business day</p>
  <p><strong>Packaging:</strong> Card will be carefully packaged in a penny sleeve, top loader, and team bag, then shipped in a bubble mailer for maximum protection.</p>
  <p style="color: #0654ba;"><strong>Combined Shipping Available!</strong> Save on shipping when you buy multiple cards.</p>
</div>`;
  }

  /**
   * Generates returns section
   */
  private generateReturnsSection(): string {
    return `
<div style="background: #e8f8e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <h2 style="color: #333; margin-top: 0;">Returns Accepted</h2>
  <p>30-day return policy. If you're not completely satisfied with your purchase, return it for a full refund.</p>
  <p><strong>Return shipping paid by:</strong> Buyer</p>
</div>`;
  }

  /**
   * Generates footer
   */
  private generateFooter(): string {
    return `
<div style="text-align: center; margin-top: 40px; padding: 20px; border-top: 1px solid #ddd;">
  <p style="color: #666;">Thank you for viewing this listing!</p>
  <p style="color: #666;">Check out our other cards for combined shipping discounts.</p>
  <p style="font-size: 12px; color: #999; margin-top: 20px;">
    All cards are authentic. We've been collecting and selling cards for over 10 years with 100% positive feedback.
  </p>
</div>`;
  }

  /**
   * Gets the appropriate eBay category
   */
  private getCategory(card: Card): { name: string; id: number } {
    // Map card category to eBay category
    const categoryMap: Record<string, keyof typeof EBAY_CATEGORIES> = {
      'Baseball': 'Baseball',
      'Basketball': 'Basketball',
      'Football': 'Football',
      'Hockey': 'Hockey',
      'Soccer': 'Soccer',
      'Pokemon': 'Pokemon',
      'TCG': 'Pokemon'
    };
    
    const ebayCategory = categoryMap[card.category] || 'Other';
    return EBAY_CATEGORIES[ebayCategory];
  }

  /**
   * Gets the condition mapping
   */
  private getCondition(card: Card): { name: string; id: number } {
    // Extract grade from condition or grading company info
    const grade = this.extractGradeFromCondition(card.condition);
    const gradeCondition = this.getConditionFromGrade(grade || undefined);
    const simpleCondition = this.mapComplexCondition(card.condition);
    return CONDITION_MAP[gradeCondition || simpleCondition] || CONDITION_MAP['Good'];
  }

  /**
   * Maps grade to condition
   */
  private getConditionFromGrade(grade?: string): string | null {
    if (!grade) return null;
    
    const numericGrade = parseFloat(grade);
    if (numericGrade >= 9.5) return 'Mint';
    if (numericGrade >= 8.5) return 'Near Mint';
    if (numericGrade >= 7.5) return 'Excellent';
    if (numericGrade >= 6.5) return 'Very Good';
    if (numericGrade >= 5.5) return 'Good';
    return 'Fair';
  }

  /**
   * Generates item specifics for eBay
   */
  private generateItemSpecifics(card: Card): Record<string, string> {
    const specifics: Record<string, string> = {
      'Player': card.player,
      'Year': card.year?.toString() || 'Unknown',
      'Brand': card.brand || 'Unknown',
      'Sport': card.category
    };

    if (card.team) specifics['Team'] = card.team;
    if (card.cardNumber) specifics['Card Number'] = card.cardNumber;
    if (card.parallel) specifics['Parallel/Variety'] = card.parallel;
    if (this.isLikelyRookie(card)) specifics['Rookie Card'] = 'Yes';
    if (card.parallel?.toLowerCase().includes('auto')) specifics['Autographed'] = 'Yes';
    if (card.gradingCompany) {
      specifics['Professional Grader'] = card.gradingCompany;
      const grade = this.extractGradeFromCondition(card.condition);
      if (grade) specifics['Grade'] = grade;
    }
    if (card.parallel?.match(/\d+\/\d+/)) specifics['Serial Numbered'] = 'Yes';
    
    return specifics;
  }

  /**
   * Generates search keywords
   */
  private generateSearchKeywords(card: Card): string[] {
    const keywords: string[] = [
      card.player,
      card.category,
      card.year?.toString() || '',
      card.brand || '',
      card.team || ''
    ];

    if (this.isLikelyRookie(card)) keywords.push('rookie', 'rc');
    if (card.parallel?.toLowerCase().includes('auto')) keywords.push('auto', 'autograph', 'signed');
    if (card.parallel) keywords.push(card.parallel);
    if (card.gradingCompany) keywords.push(card.gradingCompany, 'graded');
    if (card.parallel?.match(/\d+\/\d+/)) keywords.push('numbered', 'serial');
    
    // Add common misspellings or variations
    if (card.player.includes('Jr.')) {
      keywords.push(card.player.replace('Jr.', 'Junior'));
    }
    
    return [...new Set(keywords.filter(k => k))]; // Remove duplicates and empty strings
  }

  /**
   * Suggests pricing based on card attributes
   */
  private suggestPricing(card: Card, options: EbayListingOptions): { startingPrice?: number; buyItNowPrice?: number } {
    const baseValue = card.currentValue || card.purchasePrice || 10;
    
    if (options.listingFormat === 'auction') {
      return {
        startingPrice: Math.max(0.99, baseValue * 0.5),
        buyItNowPrice: undefined
      };
    } else if (options.listingFormat === 'buyItNow') {
      return {
        startingPrice: undefined,
        buyItNowPrice: baseValue * 1.2
      };
    } else {
      // Both
      return {
        startingPrice: Math.max(0.99, baseValue * 0.5),
        buyItNowPrice: baseValue * 1.3
      };
    }
  }

  /**
   * Calculates shipping cost
   */
  private calculateShipping(card: Card, shippingType: string): number {
    const shippingCosts: Record<string, number> = {
      'standard': 4.99,
      'expedited': 8.99,
      'express': 14.99
    };

    // Add extra for graded cards (larger package)
    const extra = card.gradingCompany ? 2 : 0;
    
    return shippingCosts[shippingType] + extra;
  }

  /**
   * Prepares images for listing
   */
  private prepareImages(card: Card, watermark: boolean): string[] {
    const images: string[] = [];
    
    // Use the images array from the Card type
    if (card.images && card.images.length > 0) {
      images.push(...card.images);
    }
    
    // In production, apply watermark if requested
    if (watermark) {
      // This would apply watermark to images
      return images.map(img => this.applyWatermark(img));
    }
    
    return images;
  }

  /**
   * Applies watermark to image (placeholder)
   */
  private applyWatermark(imageUrl: string): string {
    // In production, this would actually apply a watermark
    return imageUrl;
  }

  /**
   * Checks if card has special features
   */
  private hasSpecialFeatures(card: Card): boolean {
    return !!(this.isLikelyRookie(card) || 
             card.parallel?.toLowerCase().includes('auto') || 
             card.parallel?.match(/\d+\/\d+/) || 
             card.gradingCompany ||
             card.parallel?.toLowerCase().match(/refractor|patch|relic|memorabilia/));
  }

  /**
   * Exports listing to various formats
   */
  exportListing(listing: EbayListing, format: 'html' | 'csv' | 'json'): string {
    switch (format) {
      case 'html':
        return listing.description;
      
      case 'csv':
        return this.exportToCSV([listing]);
      
      case 'json':
        return JSON.stringify(listing, null, 2);
      
      default:
        return listing.description;
    }
  }

  /**
   * Exports multiple listings to CSV
   */
  exportToCSV(listings: EbayListing[]): string {
    const infoRows = [
      '#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,',
      '#INFO Action and Category ID are required fields. 1) Set Action to Draft 2) Please find the category ID for your listings here: https://pages.ebay.com/sellerinformation/news/categorychanges.html,,,,,,,,,,',
      '"#INFO After you\'ve successfully uploaded your draft from the Seller Hub Reports tab, complete your drafts to active listings here: https://www.ebay.com/sh/lst/drafts",,,,,,,,,,',
      '#INFO,,,,,,,,,,',
      'Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8),Custom label (SKU),Category ID,Title,UPC,Price,Quantity,Item photo URL,Condition ID,Description,Format',
    ];

    const rows = listings.map(listing => {
      const sku = listing.itemSpecifics?.['Player']
        ? `${listing.itemSpecifics['Player'].split(' ').pop()?.toUpperCase()}-${listing.itemSpecifics['Year'] || '0000'}-${listing.itemSpecifics['Card Number'] || '0'}`
        : '';
      const price = listing.buyItNowPrice?.toFixed(2) || listing.startingPrice?.toFixed(2) || '0.00';
      const photoUrl = listing.images.length > 0 ? listing.images[0] : '';
      const desc = listing.description.includes(',') || listing.description.includes('"')
        ? `"${listing.description.replace(/"/g, '""')}"`
        : listing.description;

      return [
        'Draft',
        sku,
        listing.categoryId.toString(),
        listing.title,
        '',
        price,
        '1',
        photoUrl,
        listing.conditionId.toString(),
        desc,
        'FixedPrice',
      ].join(',');
    });

    return [...infoRows, ...rows].join('\n') + '\n';
  }

  /**
   * Generates bulk listings for multiple cards
   */
  generateBulkListings(cards: Card[], options: EbayListingOptions): EbayListing[] {
    return cards.map(card => this.generateListing(card, options));
  }

  /**
   * Determines if a card is likely a rookie
   */
  private isLikelyRookie(card: Card): boolean {
    const rookieKeywords = ['rookie', 'rc', 'first year', 'debut', '1st'];
    const searchText = `${card.brand} ${card.parallel || ''} ${card.notes || ''}`.toLowerCase();
    return rookieKeywords.some(keyword => searchText.includes(keyword));
  }

  /**
   * Extracts grade from condition string
   */
  private extractGradeFromCondition(condition: string): string | null {
    // Check if condition contains a grade number
    const gradeMatch = condition.match(/(\d+(?:\.\d+)?)/); 
    return gradeMatch ? gradeMatch[1] : null;
  }

  /**
   * Maps complex condition strings to simple ones
   */
  private mapComplexCondition(condition: string): string {
    const conditionMap: Record<string, string> = {
      'RAW': 'Near Mint',
      '10: GEM MINT': 'Mint',
      '9.5: MINT+': 'Mint',
      '9: MINT': 'Mint',
      '8.5: NEAR MINT-MINT+': 'Near Mint',
      '8: NEAR MINT-MINT': 'Near Mint',
      '7.5: NEAR MINT+': 'Near Mint',
      '7: NEAR MINT': 'Near Mint',
      '6.5: EXCELLENT-MINT+': 'Excellent',
      '6: EXCELLENT-MINT': 'Excellent',
      '5.5: EXCELLENT+': 'Excellent',
      '5: EXCELLENT': 'Excellent',
      '4.5: VERY GOOD-EXCELLENT+': 'Very Good',
      '4: VERY GOOD-EXCELLENT': 'Very Good',
      '3.5: VERY GOOD+': 'Very Good',
      '3: VERY GOOD': 'Very Good',
      '2.5: GOOD+': 'Good',
      '2: GOOD': 'Good',
      '1.5: POOR+': 'Poor',
      '1: POOR': 'Poor'
    };
    
    return conditionMap[condition] || condition;
  }
}

// Export singleton instance
export const ebayListingService = new EbayListingService();