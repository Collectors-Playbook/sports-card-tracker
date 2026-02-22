import fs from 'fs';
import path from 'path';
import os from 'os';
import FileService from '../../services/fileService';
import ImageProcessingService from '../../services/imageProcessingService';
import Database from '../../database';
import { ExtractedCardData } from '../../types';

// Stub vision service — tests mock identifyCard per test
const mockVisionService = {
  identifyCard: jest.fn(),
  identifyCardPair: jest.fn(),
} as any;

describe('ImageProcessingService', () => {
  let tempDir: string;
  let rawDir: string;
  let processedDir: string;
  let fileService: FileService;
  let db: Database;
  let service: ImageProcessingService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgproc-test-'));
    rawDir = path.join(tempDir, 'raw');
    processedDir = path.join(tempDir, 'processed');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });

    fileService = new FileService(rawDir, processedDir, tempDir);
    db = new Database(':memory:');
    await db.waitReady();
    service = new ImageProcessingService(fileService, db, mockVisionService);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createTestFile(name: string, content: string = 'fake image data'): void {
    fs.writeFileSync(path.join(rawDir, name), content);
  }

  function mockVisionResult(overrides: Partial<ExtractedCardData> = {}): ExtractedCardData {
    return {
      player: 'Mike Trout',
      year: '2023',
      brand: 'Topps Chrome',
      team: 'Angels',
      cardNumber: '1',
      category: 'Baseball',
      confidence: { score: 85, level: 'high', detectedFields: 6 },
      ...overrides,
    };
  }

  describe('buildProcessedFilename', () => {
    it('builds filename from extracted data', () => {
      const result = service.buildProcessedFilename(
        { year: '2023', brand: 'Topps Chrome', player: 'Mike Trout', cardNumber: '1' },
        '.jpg'
      );
      expect(result).toBe('2023-Topps-Chrome-Mike-Trout-1.jpg');
    });

    it('uses Unknown for missing fields', () => {
      const result = service.buildProcessedFilename({}, '.png');
      expect(result).toBe('Unknown-Unknown-Unknown-0.png');
    });

    it('replaces spaces with hyphens', () => {
      const result = service.buildProcessedFilename(
        { year: '2023', brand: 'Upper Deck', player: 'Ken Griffey Jr.', cardNumber: '1' },
        '.jpg'
      );
      expect(result).toBe('2023-Upper-Deck-Ken-Griffey-Jr.-1.jpg');
    });
  });

  describe('checkDuplicate', () => {
    it('returns null when no duplicate exists', async () => {
      const result = await service.checkDuplicate({
        player: 'Mike Trout', year: '2023', brand: 'Topps', cardNumber: '1',
      });
      expect(result).toBeNull();
    });

    it('returns existing card when duplicate found', async () => {
      // Create a processed file so the card is not treated as orphaned
      fs.writeFileSync(path.join(processedDir, 'existing.jpg'), 'data');
      await db.createCard({
        player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps',
        category: 'Baseball', cardNumber: '1', condition: 'Raw',
        purchasePrice: 0, purchaseDate: '2023-01-01', currentValue: 0,
        images: ['existing.jpg'], notes: '',
      });

      const result = await service.checkDuplicate({
        player: 'Mike Trout', year: '2023', brand: 'Topps', cardNumber: '1',
      });
      expect(result).not.toBeNull();
      expect(result!.player).toBe('Mike Trout');
    });

    it('returns null when fields are missing', async () => {
      const result = await service.checkDuplicate({ player: 'Mike Trout' });
      expect(result).toBeNull();
    });

    it('is case-insensitive', async () => {
      fs.writeFileSync(path.join(processedDir, 'existing2.jpg'), 'data');
      await db.createCard({
        player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps',
        category: 'Baseball', cardNumber: '1', condition: 'Raw',
        purchasePrice: 0, purchaseDate: '2023-01-01', currentValue: 0,
        images: ['existing2.jpg'], notes: '',
      });

      const result = await service.checkDuplicate({
        player: 'mike trout', year: '2023', brand: 'topps', cardNumber: '1',
      });
      expect(result).not.toBeNull();
    });
  });

  describe('isAlreadyProcessed', () => {
    it('returns false when file does not exist', () => {
      expect(service.isAlreadyProcessed('2023-Topps-Trout-1.jpg')).toBe(false);
    });

    it('returns true when file exists in processed dir', () => {
      fs.writeFileSync(path.join(processedDir, '2023-Topps-Trout-1.jpg'), 'data');
      expect(service.isAlreadyProcessed('2023-Topps-Trout-1.jpg')).toBe(true);
    });
  });

  describe('findPairFile', () => {
    it('finds back file for front file', () => {
      const result = service.findPairFile('card1-front.jpg', ['card1-front.jpg', 'card1-back.jpg']);
      expect(result).toBe('card1-back.jpg');
    });

    it('finds front file for back file', () => {
      const result = service.findPairFile('card1-back.jpg', ['card1-front.jpg', 'card1-back.jpg']);
      expect(result).toBe('card1-front.jpg');
    });

    it('returns null for non-paired file', () => {
      const result = service.findPairFile('card1.jpg', ['card1.jpg', 'card2.jpg']);
      expect(result).toBeNull();
    });

    it('returns null when pair is missing', () => {
      const result = service.findPairFile('card1-front.jpg', ['card1-front.jpg']);
      expect(result).toBeNull();
    });
  });

  describe('processSingleImage', () => {
    it('processes a card image successfully', async () => {
      createTestFile('card.jpg');
      mockVisionService.identifyCard.mockResolvedValue(mockVisionResult());

      const result = await service.processSingleImage('card.jpg');
      expect(result.status).toBe('processed');
      expect(result.processedFilename).toBeDefined();
      expect(result.cardId).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('fails when confidence is below threshold', async () => {
      createTestFile('blurry.jpg');
      mockVisionService.identifyCard.mockResolvedValue(
        mockVisionResult({ confidence: { score: 20, level: 'low', detectedFields: 1 } })
      );

      const result = await service.processSingleImage('blurry.jpg', { confidenceThreshold: 50 });
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Low confidence');
    });

    it('skips already processed files', async () => {
      createTestFile('card.jpg');
      mockVisionService.identifyCard.mockResolvedValue(mockVisionResult());

      // Process once
      const first = await service.processSingleImage('card.jpg');
      expect(first.status).toBe('processed');

      // Process again -- should skip
      const second = await service.processSingleImage('card.jpg');
      expect(second.status).toBe('skipped');
    });

    it('detects duplicates', async () => {
      // Create existing card in DB with a real processed file
      fs.writeFileSync(path.join(processedDir, 'existing.jpg'), 'data');
      await db.createCard({
        player: 'Mike Trout', team: 'Angels', year: 2023, brand: 'Topps Chrome',
        category: 'Baseball', cardNumber: '1', condition: 'Raw',
        purchasePrice: 0, purchaseDate: '2023-01-01', currentValue: 0,
        images: ['existing.jpg'], notes: '',
      });

      createTestFile('card2.jpg');
      mockVisionService.identifyCard.mockResolvedValue(
        mockVisionResult({ brand: 'Topps Chrome' })
      );

      const result = await service.processSingleImage('card2.jpg', { skipExisting: false });
      expect(result.status).toBe('duplicate');
    });

    it('handles vision API error gracefully', async () => {
      createTestFile('corrupt.jpg');
      mockVisionService.identifyCard.mockRejectedValue(new Error('Vision API failure'));

      await expect(service.processSingleImage('corrupt.jpg')).rejects.toThrow('Vision API failure');
    });
  });

  describe('processImages', () => {
    it('processes a batch of images', async () => {
      createTestFile('card1.jpg');
      createTestFile('card2.jpg');
      mockVisionService.identifyCard
        .mockResolvedValueOnce(mockVisionResult())
        .mockResolvedValueOnce(mockVisionResult({ player: 'Aaron Judge', cardNumber: '99', team: 'Yankees' }));

      const result = await service.processImages({
        filenames: ['card1.jpg', 'card2.jpg'],
      });

      expect(result.totalFiles).toBe(2);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('reports progress via callback', async () => {
      createTestFile('card1.jpg');
      mockVisionService.identifyCard.mockResolvedValue(mockVisionResult());

      const progressCalls: number[] = [];
      await service.processImages(
        { filenames: ['card1.jpg'] },
        async (progress) => { progressCalls.push(progress); }
      );

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1]).toBe(100);
    });

    it('handles mixed results (success and failure)', async () => {
      createTestFile('good.jpg');
      createTestFile('bad.jpg');
      mockVisionService.identifyCard
        .mockResolvedValueOnce(mockVisionResult())
        .mockResolvedValueOnce(mockVisionResult({ confidence: { score: 10, level: 'low', detectedFields: 0 } }));

      const result = await service.processImages({
        filenames: ['good.jpg', 'bad.jpg'],
      });

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('handles front/back pairs', async () => {
      createTestFile('trout-front.jpg');
      createTestFile('trout-back.jpg');
      mockVisionService.identifyCardPair.mockResolvedValue(mockVisionResult());

      const result = await service.processImages({
        filenames: ['trout-front.jpg', 'trout-back.jpg'],
      });

      expect(result.processed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('processed');
    });

    it('ensures idempotency on re-run', async () => {
      createTestFile('card1.jpg');
      mockVisionService.identifyCard.mockResolvedValue(mockVisionResult());

      const first = await service.processImages({ filenames: ['card1.jpg'] });
      expect(first.processed).toBe(1);

      const second = await service.processImages({ filenames: ['card1.jpg'] });
      expect(second.skipped).toBe(1);
      expect(second.processed).toBe(0);
    });
  });
});
