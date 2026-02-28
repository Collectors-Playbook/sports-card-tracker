import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Database from '../database';
import FileService from './fileService';
import { Card, EbayExportOptions, EbayExportResult, EbayExportCardSummary, StoredCompReport } from '../types';

const EBAY_FE_HEADERS = [
  '*Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
  'Custom label (SKU)',
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

    // Batch-fetch remote URLs for image uploads
    const allImageFilenames: string[] = [];
    for (const card of inventoryCards) {
      if (card.images) {
        for (const img of card.images) {
          if (!img.endsWith('-comps.txt')) {
            allImageFilenames.push(img);
          }
        }
      }
    }
    const remoteUrlMap = await this.db.getRemoteUrlMap(allImageFilenames);

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
      const row = this.cardToRow(card, options, startPrice, remoteUrlMap);
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

  private cardToRow(card: Card, options: EbayExportOptions, startPrice: number, remoteUrlMap?: Map<string, string>): string[] {
    const picUrl = this.buildPicUrl(card, options.imageBaseUrl, remoteUrlMap);
    const buyItNowPrice = startPrice * 0.95;

    return [
      'Draft',
      this.generateSku(card),
      this.getCategoryId(card.category),
      this.generateTitle(card),
      this.generateDescription(card),
      this.getConditionId(card),
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

  private buildPicUrl(card: Card, imageBaseUrl?: string, remoteUrlMap?: Map<string, string>): string {
    if (!card.images || card.images.length === 0) return '';
    const base = imageBaseUrl || '';

    return card.images
      .filter(img => !img.endsWith('-comps.txt'))
      .map(img => {
        // Prefer remote URL if available
        const remoteUrl = remoteUrlMap?.get(img);
        if (remoteUrl) return remoteUrl;
        // Fall back to local API path
        if (!base) return '';
        return `${base}/api/files/processed/${encodeURIComponent(img)}`;
      })
      .filter(url => url !== '')
      .join('|');
  }

  private generateSku(card: Card): string {
    const lastName = card.player.split(' ').pop()?.toUpperCase() || 'UNKNOWN';
    const year = card.year.toString();
    const cardNum = card.cardNumber;

    if (card.isGraded && card.gradingCompany && card.grade) {
      const grade = card.grade.replace('.', '');
      return `${lastName}-${year}-${cardNum}-${card.gradingCompany}${grade}`;
    }

    return `${lastName}-${year}-${cardNum}-RAW`;
  }

  private generateTitle(card: Card): string {
    const parts: string[] = [];

    parts.push(`${card.year} ${card.brand}`);

    if (card.setName) {
      parts.push(card.setName);
    }

    parts.push(card.player);

    if (card.parallel) {
      parts.push(card.parallel);
    }

    parts.push(`#${card.cardNumber}`);

    if (card.gradingCompany && card.grade) {
      parts.push(`${card.gradingCompany} ${card.grade}`);
    }

    if (card.isRookie) {
      parts.push('RC');
    }

    if (card.team) {
      parts.push(card.team);
    }

    let title = parts.join(' ');
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }

    return title;
  }

  private generateDescription(card: Card): string {
    const sections: string[] = [];

    // Header line
    const setDisplay = card.setName ? ` ${card.setName}` : '';
    sections.push(`<p><b>${card.year} ${card.brand}${setDisplay} ${card.player} #${card.cardNumber}</b></p>`);

    // Grade line
    if (card.isGraded && card.gradingCompany && card.grade) {
      let gradeLine = `<p><b>Grade:</b> ${card.gradingCompany} ${card.grade}`;
      if (card.serialNumber) {
        gradeLine += `<br><b>Serial Numbered:</b> ${card.serialNumber}`;
      }
      gradeLine += '</p>';
      sections.push(gradeLine);
    } else if (card.serialNumber) {
      sections.push(`<p><b>Serial Numbered:</b> ${card.serialNumber}</p>`);
    }

    // Features line (pipe-separated)
    const features: string[] = [];
    if (card.parallel) {
      features.push(card.parallel);
    }
    if (card.isRookie) {
      features.push('Rookie Card');
    }
    if (card.isAutograph) {
      features.push('Autograph');
    }
    if (card.isRelic) {
      features.push('Game-Used Relic');
    }
    if (features.length > 0) {
      sections.push(`<p>${features.join(' | ')}</p>`);
    }

    // Team
    if (card.team) {
      sections.push(`<p>${card.team}</p>`);
    }

    // Notes
    if (card.notes) {
      sections.push(`<p>${card.notes}</p>`);
    }

    // Shipping
    if (card.isGraded && card.gradingCompany) {
      sections.push(`<p>Card ships in ${card.gradingCompany} protective case with tracking.</p>`);
    } else {
      sections.push('<p>Card shipped in protective sleeve and toploader with tracking.</p>');
    }

    return sections.join('');
  }

  private getCategoryId(category: string): string {
    if (category === 'Pokemon') {
      return '183454';
    }
    return '215';
  }

  private getConditionId(card: Card): string {
    if (card.isGraded && card.grade) {
      const grade = card.grade;
      if (grade.includes('10') || grade.includes('GEM')) {
        return '2750';
      } else if (grade.includes('9.5')) {
        return '2750';
      } else if (grade.includes('9')) {
        return '2750';
      } else if (grade.includes('8')) {
        return '2750';
      } else if (grade.includes('7')) {
        return '2750';
      }
      return '2750';
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
