import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Database from '../database';
import FileService from './fileService';
import { Card, EbayExportOptions, EbayExportResult, EbayExportCardSummary, StoredCompReport } from '../types';

const EBAY_FE_HEADERS = [
  '*Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
  '*Category',
  '*Title',
  '*Description',
  '*ConditionID',
  '*PicURL',
  'Product:UPC',
  '*Quantity',
  '*Format',
  '*StartPrice',
  'BuyItNowPrice',
  '*Duration',
  '*Location',
  'ShippingType',
  'ShippingService-1:Option',
  'ShippingService-1:Cost',
  'PaymentMethods',
  '*DispatchTimeMax',
  '*ReturnsAcceptedOption',
  'ReturnsWithinOption',
  'RefundOption',
  'ShippingCostPaidByOption',
  'PayPalEmailAddress',
  'UseTaxTable',
];

const OUTPUT_FILENAME = 'ebay-draft-upload-batch.csv';
const TEMPLATE_FILENAME = 'eBay-draft-listing-template.csv';

interface ResolvedPrice {
  price: number;
  source: string;
}

class EbayExportService {
  private db: Database;
  private fileService: FileService;

  constructor(db: Database, fileService: FileService) {
    this.db = db;
    this.fileService = fileService;
  }

  async generateCsv(
    options: EbayExportOptions,
    onProgress?: (progress: number, completedItems: number) => Promise<void>
  ): Promise<EbayExportResult> {
    // Fetch cards, always filtering out PC
    const allCards = await this.fetchCards(options.cardIds);
    const inventoryCards = allCards.filter(c => c.collectionType === 'Inventory');
    const skippedPcCards = allCards.length - inventoryCards.length;

    // Batch-fetch comp reports if comp pricing is enabled
    const useCompPricing = options.useCompPricing !== false;
    const compMaxAgeDays = options.compMaxAgeDays ?? 30;
    let compReports = new Map<string, StoredCompReport>();
    if (useCompPricing && inventoryCards.length > 0) {
      compReports = await this.db.getLatestCompReportsForCards(
        inventoryCards.map(c => c.id)
      );
    }

    const rows: string[] = [];
    rows.push(this.rowToCsvLine(EBAY_FE_HEADERS));

    let totalListingValue = 0;
    let compPricedCards = 0;
    let staleFallbackCards = 0;
    const cardSummary: EbayExportCardSummary[] = [];

    for (let i = 0; i < inventoryCards.length; i++) {
      const card = inventoryCards[i];
      const compReport = compReports.get(card.id);
      const resolved = this.resolvePrice(card, compReport, compMaxAgeDays);

      if (resolved.source.startsWith('comp-')) {
        compPricedCards++;
      } else if (resolved.source === 'stale-fallback') {
        staleFallbackCards++;
      }

      const startPrice = resolved.price * options.priceMultiplier;
      const row = this.cardToRow(card, options, startPrice);
      rows.push(this.rowToCsvLine(row));

      totalListingValue += startPrice;

      cardSummary.push({
        cardId: card.id,
        player: card.player,
        price: Math.round(startPrice * 100) / 100,
        priceSource: resolved.source,
      });

      if (onProgress) {
        await onProgress(
          ((i + 1) / inventoryCards.length) * 100,
          i + 1
        );
      }
    }

    const csvContent = rows.join('\n');
    const generatedAt = new Date().toISOString();

    // Write timestamped draft file
    const timestamp = generatedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const draftFilename = `ebay-draft-${timestamp}.csv`;
    const draftPath = path.join(this.fileService.getDataDir(), draftFilename);
    fs.writeFileSync(draftPath, csvContent, 'utf-8');

    // Also write to the standard output path for backward compatibility
    const outputPath = this.getOutputPath();
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    // Save draft record to database
    const draftId = uuidv4();
    const now = new Date().toISOString();
    await this.db.saveEbayExportDraft({
      id: draftId,
      filename: draftFilename,
      totalCards: inventoryCards.length,
      skippedPcCards,
      totalListingValue: Math.round(totalListingValue * 100) / 100,
      compPricedCards,
      options,
      cardSummary,
      generatedAt,
      createdAt: now,
    });

    return {
      filename: draftFilename,
      totalCards: inventoryCards.length,
      skippedPcCards,
      totalListingValue: Math.round(totalListingValue * 100) / 100,
      compPricedCards,
      staleFallbackCards,
      draftId,
      generatedAt,
    };
  }

  getTemplatePath(): string {
    return path.join(this.fileService.getDataDir(), TEMPLATE_FILENAME);
  }

  getOutputPath(): string {
    return path.join(this.fileService.getDataDir(), OUTPUT_FILENAME);
  }

  getDraftPath(filename: string): string {
    return path.join(this.fileService.getDataDir(), filename);
  }

  templateExists(): boolean {
    return fs.existsSync(this.getTemplatePath());
  }

  outputExists(): boolean {
    return fs.existsSync(this.getOutputPath());
  }

  draftExists(filename: string): boolean {
    return fs.existsSync(this.getDraftPath(filename));
  }

  deleteDraftFile(filename: string): void {
    const filepath = this.getDraftPath(filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }

  private resolvePrice(
    card: Card,
    compReport: StoredCompReport | undefined,
    maxAgeDays: number
  ): ResolvedPrice {
    if (!compReport) {
      return { price: card.currentValue, source: 'card-value' };
    }

    // Check freshness
    const ageMs = Date.now() - new Date(compReport.generatedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > maxAgeDays) {
      return { price: card.currentValue, source: 'stale-fallback' };
    }

    if (compReport.popAdjustedAverage != null && compReport.popAdjustedAverage > 0) {
      return { price: compReport.popAdjustedAverage, source: 'comp-pop' };
    }

    if (compReport.aggregateAverage != null && compReport.aggregateAverage > 0) {
      return { price: compReport.aggregateAverage, source: 'comp-avg' };
    }

    return { price: card.currentValue, source: 'card-value' };
  }

  private async fetchCards(cardIds?: string[]): Promise<Card[]> {
    if (cardIds && cardIds.length > 0) {
      const cards: Card[] = [];
      for (const id of cardIds) {
        const card = await this.db.getCardById(id);
        if (card) cards.push(card);
      }
      return cards;
    }
    return this.db.getAllCards({ collectionType: 'Inventory' });
  }

  private cardToRow(card: Card, options: EbayExportOptions, startPrice: number): string[] {
    const picUrl = this.buildPicUrl(card, options.imageBaseUrl);
    const buyItNowPrice = startPrice * 0.95;

    return [
      'Add',
      this.getCategoryId(card.category),
      this.generateTitle(card),
      this.generateDescription(card),
      this.getConditionId(card.condition),
      picUrl,
      '',
      '1',
      'FixedPrice',
      startPrice.toFixed(2),
      buyItNowPrice.toFixed(2),
      options.duration || 'GTC',
      options.location || 'USA',
      'Flat',
      'USPS First Class',
      options.shippingCost.toFixed(2),
      'PayPal',
      (options.dispatchTime || 1).toString(),
      'ReturnsAccepted',
      'Days_30',
      'MoneyBack',
      'Buyer',
      '',
      '1',
    ];
  }

  private buildPicUrl(card: Card, imageBaseUrl?: string): string {
    if (!card.images || card.images.length === 0) return '';
    const base = imageBaseUrl || '';
    if (!base) return '';

    return card.images
      .map(img => `${base}/api/files/processed/${encodeURIComponent(img)}`)
      .join('|');
  }

  private generateTitle(card: Card): string {
    const parts: string[] = [];

    parts.push(`${card.year} ${card.brand}`);
    parts.push(card.player);
    parts.push(`#${card.cardNumber}`);

    if (card.parallel) {
      parts.push(card.parallel);
    }

    if (card.notes?.toLowerCase().includes('rookie')) {
      parts.push('RC');
    }

    if (card.gradingCompany) {
      parts.push(`${card.gradingCompany} ${card.condition}`);
    }

    parts.push(card.category);

    let title = parts.join(' ');
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }

    return title;
  }

  private generateDescription(card: Card): string {
    const sections: string[] = [];

    sections.push(`<h2>${card.year} ${card.brand} ${card.player} #${card.cardNumber}</h2>`);

    sections.push('<table style="width:100%; border-collapse: collapse;">');
    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Year:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.year}</td></tr>`);
    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Brand:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.brand}</td></tr>`);
    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Player:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.player}</td></tr>`);
    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Team:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.team}</td></tr>`);
    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Card Number:</strong></td><td style="padding:5px; border:1px solid #ddd;">#${card.cardNumber}</td></tr>`);

    if (card.parallel) {
      sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Parallel/Variation:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.parallel}</td></tr>`);
    }

    sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Condition:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.condition}</td></tr>`);

    if (card.gradingCompany) {
      sections.push(`<tr><td style="padding:5px; border:1px solid #ddd;"><strong>Grading Company:</strong></td><td style="padding:5px; border:1px solid #ddd;">${card.gradingCompany}</td></tr>`);
    }

    sections.push('</table>');

    if (card.notes) {
      sections.push('<h3>Additional Information:</h3>');
      sections.push(`<p>${card.notes}</p>`);
    }

    sections.push('<h3>Shipping & Handling:</h3>');
    sections.push('<ul>');
    sections.push('<li>Card shipped in protective sleeve and toploader</li>');
    sections.push('<li>Bubble mailer with tracking</li>');
    sections.push('<li>Ships within 1 business day</li>');
    sections.push('</ul>');

    sections.push('<h3>Please Note:</h3>');
    sections.push('<p>See photos for exact condition. All cards are authentic and from a smoke-free environment.</p>');

    return sections.join('\n');
  }

  private getCategoryId(category: string): string {
    const categoryMap: Record<string, string> = {
      'Baseball': '261328',
      'Basketball': '261329',
      'Football': '261330',
      'Hockey': '261331',
      'Soccer': '261333',
      'Pokemon': '183454',
      'Other': '261324',
    };
    return categoryMap[category] || '261324';
  }

  private getConditionId(condition: string): string {
    if (condition.includes('10') || condition.includes('GEM')) {
      return '275000';
    } else if (condition.includes('9.5')) {
      return '275001';
    } else if (condition.includes('9')) {
      return '275002';
    } else if (condition.includes('8')) {
      return '275003';
    } else if (condition.includes('7')) {
      return '275004';
    } else if (condition === 'RAW') {
      return '3000';
    }
    return '3000';
  }

  private escapeCell(cell: string): string {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  private rowToCsvLine(row: string[]): string {
    return row.map(cell => this.escapeCell(cell)).join(',');
  }
}

export default EbayExportService;
