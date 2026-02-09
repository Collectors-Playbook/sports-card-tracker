import fs from 'fs';
import path from 'path';
import os from 'os';
import FileService from '../../services/fileService';

describe('FileService', () => {
  let tempDir: string;
  let rawDir: string;
  let processedDir: string;
  let fileService: FileService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
    rawDir = path.join(tempDir, 'raw');
    processedDir = path.join(tempDir, 'processed');
    fileService = new FileService(rawDir, processedDir, tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ensureDirectories', () => {
    it('creates raw and processed directories', () => {
      expect(fs.existsSync(rawDir)).toBe(false);
      expect(fs.existsSync(processedDir)).toBe(false);

      fileService.ensureDirectories();

      expect(fs.existsSync(rawDir)).toBe(true);
      expect(fs.existsSync(processedDir)).toBe(true);
    });

    it('is idempotent', () => {
      fileService.ensureDirectories();
      fileService.ensureDirectories();
      expect(fs.existsSync(rawDir)).toBe(true);
    });
  });

  describe('directoriesExist', () => {
    it('returns false when directories missing', () => {
      expect(fileService.directoriesExist()).toBe(false);
    });

    it('returns true when directories exist', () => {
      fileService.ensureDirectories();
      expect(fileService.directoriesExist()).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('returns empty array for missing directory', () => {
      expect(fileService.listFiles(rawDir)).toEqual([]);
    });

    it('lists files with metadata', () => {
      fileService.ensureDirectories();
      fs.writeFileSync(path.join(rawDir, 'card.jpg'), 'data');

      const files = fileService.listFiles(rawDir);
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('card.jpg');
      expect(files[0].type).toBe('jpg');
      expect(files[0].size).toBeGreaterThan(0);
      expect(files[0].modified).toBeDefined();
    });

    it('excludes hidden files', () => {
      fileService.ensureDirectories();
      fs.writeFileSync(path.join(rawDir, '.DS_Store'), '');
      fs.writeFileSync(path.join(rawDir, 'visible.jpg'), 'data');

      const files = fileService.listFiles(rawDir);
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('visible.jpg');
    });
  });

  describe('getFilePath', () => {
    it('returns safe resolved path', () => {
      fileService.ensureDirectories();
      const result = fileService.getFilePath(rawDir, 'test.jpg');
      expect(result).toBe(path.resolve(rawDir, 'test.jpg'));
    });

    it('prevents directory traversal', () => {
      fileService.ensureDirectories();
      const result = fileService.getFilePath(rawDir, '../../../etc/passwd');
      // path.basename strips the traversal
      expect(result).not.toContain('..');
    });
  });

  describe('file operations', () => {
    beforeEach(() => {
      fileService.ensureDirectories();
    });

    it('fileExists returns true for existing files', () => {
      fs.writeFileSync(path.join(rawDir, 'exists.jpg'), 'data');
      expect(fileService.fileExists(rawDir, 'exists.jpg')).toBe(true);
    });

    it('fileExists returns false for missing files', () => {
      expect(fileService.fileExists(rawDir, 'nope.jpg')).toBe(false);
    });

    it('deleteFile removes a file', () => {
      fs.writeFileSync(path.join(rawDir, 'delete.jpg'), 'data');
      expect(fileService.deleteFile(rawDir, 'delete.jpg')).toBe(true);
      expect(fs.existsSync(path.join(rawDir, 'delete.jpg'))).toBe(false);
    });

    it('deleteFile returns false for missing file', () => {
      expect(fileService.deleteFile(rawDir, 'nope.jpg')).toBe(false);
    });

    it('copyFile copies between directories', () => {
      fs.writeFileSync(path.join(rawDir, 'src.jpg'), 'content');
      expect(fileService.copyFile(rawDir, 'src.jpg', processedDir, 'dest.jpg')).toBe(true);
      expect(fs.existsSync(path.join(processedDir, 'dest.jpg'))).toBe(true);
    });
  });

  describe('log operations', () => {
    it('readLog returns empty for non-existent log', () => {
      expect(fileService.readLog('missing.log')).toEqual([]);
    });

    it('appendLog and readLog round-trip', () => {
      fileService.appendLog('test.log', {
        timestamp: '2024-01-15 10:30:00',
        filename: 'card.jpg',
        reason: 'Could not identify',
      });

      const entries = fileService.readLog('test.log');
      expect(entries.length).toBe(1);
      expect(entries[0].timestamp).toBe('2024-01-15 10:30:00');
      expect(entries[0].filename).toBe('card.jpg');
      expect(entries[0].reason).toBe('Could not identify');
    });

    it('clearLog empties the file', () => {
      fileService.appendLog('clear.log', {
        timestamp: '2024-01-15',
        filename: 'test.jpg',
        reason: 'error',
      });
      fileService.clearLog('clear.log');
      const entries = fileService.readLog('clear.log');
      expect(entries).toEqual([]);
    });
  });
});
