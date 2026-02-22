import path from 'path';
import FileService from './fileService';
import AnthropicVisionService from './anthropicVisionService';
import Database from '../database';
import {
  ImageProcessingPayload,
  ImageProcessingResult,
  ImageProcessingItemResult,
  ExtractedCardData,
  CardInput,
  Card,
} from '../types';

class ImageProcessingService {
  constructor(
    private fileService: FileService,
    private db: Database,
    private visionService: AnthropicVisionService
  ) {}

  async processImages(
    payload: ImageProcessingPayload,
    onProgress?: (progress: number, completedItems: number) => Promise<void>
  ): Promise<ImageProcessingResult> {
    const { filenames, skipExisting = true, confidenceThreshold = 40 } = payload;
    const result: ImageProcessingResult = {
      totalFiles: filenames.length,
      processed: 0,
      skipped: 0,
      duplicates: 0,
      failed: 0,
      results: [],
    };

    // Group files into pairs and standalone
    const { pairs, standalone } = this.groupFiles(filenames);

    // Process paired files
    for (const [frontFile, backFile] of pairs) {
      try {
        const itemResult = await this.processPairedImages(
          frontFile, backFile, { skipExisting, confidenceThreshold }
        );
        result.results.push(itemResult);
        this.updateCounts(result, itemResult);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.results.push({
          filename: frontFile,
          status: 'failed',
          error: errorMsg,
        });
        result.failed++;
        this.logError(frontFile, errorMsg);
      }

      if (onProgress) {
        const completed = result.processed + result.skipped + result.duplicates + result.failed;
        await onProgress((completed / result.totalFiles) * 100, completed);
      }
    }

    // Process standalone files
    for (const filename of standalone) {
      try {
        const itemResult = await this.processSingleImage(filename, {
          skipExisting,
          confidenceThreshold,
        });
        result.results.push(itemResult);
        this.updateCounts(result, itemResult);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.results.push({
          filename,
          status: 'failed',
          error: errorMsg,
        });
        result.failed++;
        this.logError(filename, errorMsg);
      }

      if (onProgress) {
        const completed = result.processed + result.skipped + result.duplicates + result.failed;
        await onProgress((completed / result.totalFiles) * 100, completed);
      }
    }

    return result;
  }

  async identifyOnly(
    filename: string,
    backFile?: string
  ): Promise<ExtractedCardData> {
    const rawDir = this.fileService.getRawDir();

    if (backFile) {
      return this.visionService.identifyCardPair(
        path.join(rawDir, filename),
        path.join(rawDir, backFile)
      );
    }

    return this.visionService.identifyCard(path.join(rawDir, filename));
  }

  async confirmCard(
    filename: string,
    cardData: ExtractedCardData,
    backFile?: string
  ): Promise<ImageProcessingItemResult> {
    const rawDir = this.fileService.getRawDir();
    const processedDir = this.fileService.getProcessedDir();

    if (backFile) {
      const frontExt = path.extname(filename);
      const backExt = path.extname(backFile);
      const baseName = this.buildProcessedFilename(cardData, '');
      const processedFront = baseName + '-front' + frontExt;
      const processedBack = baseName + '-back' + backExt;

      if (this.isAlreadyProcessed(processedFront)) {
        return { filename, status: 'skipped', processedFilename: processedFront, confidence: cardData.confidence?.score };
      }

      const duplicate = await this.checkDuplicate(cardData);
      if (duplicate) {
        const error = `Duplicate of card ${duplicate.id}`;
        this.logError(filename, error);
        return { filename, status: 'duplicate', confidence: cardData.confidence?.score, error };
      }

      this.fileService.copyFile(rawDir, filename, processedDir, processedFront);
      this.fileService.copyFile(rawDir, backFile, processedDir, processedBack);

      const card = await this.db.createCard(
        this.buildCardInput(cardData, [processedFront, processedBack])
      );

      return {
        filename,
        status: 'processed',
        processedFilename: processedFront,
        cardId: card.id,
        confidence: cardData.confidence?.score,
      };
    }

    // Single image
    const ext = path.extname(filename);
    const processedFilename = this.buildProcessedFilename(cardData, ext);

    if (this.isAlreadyProcessed(processedFilename)) {
      return { filename, status: 'skipped', processedFilename, confidence: cardData.confidence?.score };
    }

    const duplicate = await this.checkDuplicate(cardData);
    if (duplicate) {
      const error = `Duplicate of card ${duplicate.id} (${duplicate.player} ${duplicate.year} ${duplicate.brand} #${duplicate.cardNumber})`;
      this.logError(filename, error);
      return { filename, status: 'duplicate', confidence: cardData.confidence?.score, error };
    }

    const copied = this.fileService.copyFile(
      rawDir, filename,
      processedDir, processedFilename
    );
    if (!copied) {
      const error = 'Failed to copy file to processed directory';
      this.logError(filename, error);
      return { filename, status: 'failed', error };
    }

    const card = await this.db.createCard(
      this.buildCardInput(cardData, [processedFilename])
    );

    return {
      filename,
      status: 'processed',
      processedFilename,
      cardId: card.id,
      confidence: cardData.confidence?.score,
    };
  }

  async processSingleImage(
    filename: string,
    options: { skipExisting?: boolean; confidenceThreshold?: number } = {}
  ): Promise<ImageProcessingItemResult> {
    const { skipExisting = true, confidenceThreshold = 40 } = options;
    const rawDir = this.fileService.getRawDir();
    const filePath = path.join(rawDir, filename);

    // Use Anthropic Vision to identify the card
    const data = await this.visionService.identifyCard(filePath);

    // Check confidence
    const confidence = data.confidence?.score ?? 0;
    if (confidence < confidenceThreshold) {
      const error = `Low confidence: ${confidence}% (threshold: ${confidenceThreshold}%)`;
      this.logError(filename, error);
      return { filename, status: 'failed', confidence, error };
    }

    // Build processed filename
    const ext = path.extname(filename);
    const processedFilename = this.buildProcessedFilename(data, ext);

    // Idempotency: skip if already processed
    if (skipExisting && this.isAlreadyProcessed(processedFilename)) {
      return { filename, status: 'skipped', processedFilename, confidence };
    }

    // Duplicate detection
    const duplicate = await this.checkDuplicate(data);
    if (duplicate) {
      const error = `Duplicate of card ${duplicate.id} (${duplicate.player} ${duplicate.year} ${duplicate.brand} #${duplicate.cardNumber})`;
      this.logError(filename, error);
      return { filename, status: 'duplicate', confidence, error };
    }

    // Copy to processed directory
    const copied = this.fileService.copyFile(
      rawDir, filename,
      this.fileService.getProcessedDir(), processedFilename
    );
    if (!copied) {
      const error = 'Failed to copy file to processed directory';
      this.logError(filename, error);
      return { filename, status: 'failed', error };
    }

    // Create card record
    const card = await this.db.createCard(
      this.buildCardInput(data, [processedFilename])
    );

    return {
      filename,
      status: 'processed',
      processedFilename,
      cardId: card.id,
      confidence,
    };
  }

  private async processPairedImages(
    frontFile: string,
    backFile: string,
    options: { skipExisting?: boolean; confidenceThreshold?: number }
  ): Promise<ImageProcessingItemResult> {
    const { skipExisting = true, confidenceThreshold = 40 } = options;
    const rawDir = this.fileService.getRawDir();

    // Use Anthropic Vision to identify the card from both images
    const data = await this.visionService.identifyCardPair(
      path.join(rawDir, frontFile),
      path.join(rawDir, backFile)
    );

    const confidence = data.confidence?.score ?? 0;

    if (confidence < confidenceThreshold) {
      const error = `Low confidence: ${confidence}% (threshold: ${confidenceThreshold}%)`;
      this.logError(frontFile, error);
      return { filename: frontFile, status: 'failed', confidence, error };
    }

    const frontExt = path.extname(frontFile);
    const backExt = path.extname(backFile);
    const baseName = this.buildProcessedFilename(data, '');
    const processedFront = baseName + '-front' + frontExt;
    const processedBack = baseName + '-back' + backExt;

    if (skipExisting && this.isAlreadyProcessed(processedFront)) {
      return { filename: frontFile, status: 'skipped', processedFilename: processedFront, confidence };
    }

    const duplicate = await this.checkDuplicate(data);
    if (duplicate) {
      const error = `Duplicate of card ${duplicate.id}`;
      this.logError(frontFile, error);
      return { filename: frontFile, status: 'duplicate', confidence, error };
    }

    const processedDir = this.fileService.getProcessedDir();
    this.fileService.copyFile(rawDir, frontFile, processedDir, processedFront);
    this.fileService.copyFile(rawDir, backFile, processedDir, processedBack);

    const card = await this.db.createCard(
      this.buildCardInput(data, [processedFront, processedBack])
    );

    return {
      filename: frontFile,
      status: 'processed',
      processedFilename: processedFront,
      cardId: card.id,
      confidence,
    };
  }

  buildProcessedFilename(data: ExtractedCardData, ext: string): string {
    const year = data.year || 'Unknown';
    const brand = (data.brand || 'Unknown').replace(/\s+/g, '-');
    const setName = data.setName ? data.setName.replace(/\s+/g, '-') : '';
    const player = (data.player || 'Unknown').replace(/\s+/g, '-');
    const cardNumber = data.cardNumber || '0';
    if (setName) {
      return `${year}-${brand}-${setName}-${player}-${cardNumber}${ext}`;
    }
    return `${year}-${brand}-${player}-${cardNumber}${ext}`;
  }

  private buildCardInput(data: ExtractedCardData, images: string[]): CardInput {
    return {
      player: data.player || 'Unknown',
      team: data.team || '',
      year: data.year ? parseInt(data.year) : 0,
      brand: data.brand || 'Unknown',
      category: data.category || 'Other',
      cardNumber: data.cardNumber || '',
      parallel: data.parallel,
      condition: data.features?.isGraded ? 'Graded' : 'Raw',
      gradingCompany: data.gradingCompany,
      setName: data.setName,
      serialNumber: data.serialNumber,
      grade: data.grade,
      isRookie: data.features?.isRookie ?? false,
      isAutograph: data.features?.isAutograph ?? false,
      isRelic: data.features?.isRelic ?? false,
      isNumbered: data.features?.isNumbered ?? false,
      isGraded: data.features?.isGraded ?? false,
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      currentValue: 0,
      images,
      notes: '',
    };
  }

  async checkDuplicate(data: ExtractedCardData): Promise<Card | null> {
    if (!data.player || !data.year || !data.brand || !data.cardNumber) {
      return null;
    }

    const allCards = await this.db.getAllCards();
    const match = allCards.find(
      card =>
        card.player.toLowerCase() === data.player!.toLowerCase() &&
        card.year === parseInt(data.year!) &&
        card.brand.toLowerCase() === data.brand!.toLowerCase() &&
        card.cardNumber === data.cardNumber
    );

    if (!match) return null;

    // Verify the duplicate's processed files actually exist.
    // If none of its images are on disk, the record is orphaned — remove it.
    const hasFiles = match.images.some(img =>
      this.fileService.fileExists(this.fileService.getProcessedDir(), img)
    );
    if (!hasFiles) {
      await this.db.deleteCard(match.id);
      return null;
    }

    return match;
  }

  isAlreadyProcessed(filename: string): boolean {
    return this.fileService.fileExists(this.fileService.getProcessedDir(), filename);
  }

  findPairFile(filename: string, rawFiles: string[]): string | null {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    let pairSuffix: string | null = null;
    let baseName: string;

    if (base.endsWith('-front')) {
      baseName = base.slice(0, -6);
      pairSuffix = '-back';
    } else if (base.endsWith('-back')) {
      baseName = base.slice(0, -5);
      pairSuffix = '-front';
    } else {
      return null;
    }

    const pairName = baseName + pairSuffix + ext;
    return rawFiles.includes(pairName) ? pairName : null;
  }

  private groupFiles(filenames: string[]): { pairs: [string, string][]; standalone: string[] } {
    const pairs: [string, string][] = [];
    const standalone: string[] = [];
    const paired = new Set<string>();

    for (const filename of filenames) {
      if (paired.has(filename)) continue;

      const pairFile = this.findPairFile(filename, filenames);
      if (pairFile && !paired.has(pairFile)) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);
        if (base.endsWith('-front')) {
          pairs.push([filename, pairFile]);
        } else {
          pairs.push([pairFile, filename]);
        }
        paired.add(filename);
        paired.add(pairFile);
      } else if (!pairFile) {
        standalone.push(filename);
      }
    }

    return { pairs, standalone };
  }

  private updateCounts(result: ImageProcessingResult, item: ImageProcessingItemResult): void {
    switch (item.status) {
      case 'processed': result.processed++; break;
      case 'skipped': result.skipped++; break;
      case 'duplicate': result.duplicates++; break;
      case 'failed': result.failed++; break;
    }
  }

  private logError(filename: string, reason: string): void {
    this.fileService.appendLog('image-error.log', {
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      filename,
      reason,
    });
  }
}

export default ImageProcessingService;
