import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'ssh2';
import Database from '../database';
import FileService from './fileService';
import { Config } from '../config';
import { ScpUploadResult } from '../types';

class ScpUploadService {
  private db: Database;
  private fileService: FileService;
  private config: Config;

  constructor(db: Database, fileService: FileService, config: Config) {
    this.db = db;
    this.fileService = fileService;
    this.config = config;
  }

  isConfigured(): boolean {
    return !!this.config.gcpScpHost;
  }

  async uploadCardImages(
    cardIds: string[] | undefined,
    onProgress?: (progress: number, completedItems: number) => Promise<void>,
    force?: boolean
  ): Promise<ScpUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('GCP SCP is not configured. Set GCP_SCP_HOST in .env');
    }

    // Fetch target cards
    const cards = cardIds && cardIds.length > 0
      ? await Promise.all(cardIds.map(id => this.db.getCardById(id))).then(arr => arr.filter(Boolean))
      : await this.db.getAllCards();

    // Collect all image filenames with their cardId
    const imageEntries: { cardId: string; filename: string }[] = [];
    for (const card of cards) {
      if (!card || !card.images) continue;
      for (const img of card.images) {
        if (!img.endsWith('-comps.txt')) {
          imageEntries.push({ cardId: card.id, filename: img });
        }
      }
    }

    const result: ScpUploadResult = { uploaded: 0, skipped: 0, failed: 0, errors: [] };

    for (let i = 0; i < imageEntries.length; i++) {
      const { cardId, filename } = imageEntries[i];
      const localPath = path.join(this.fileService.getProcessedDir(), filename);

      try {
        if (!fs.existsSync(localPath)) {
          result.failed++;
          result.errors.push(`File not found: ${filename}`);
          continue;
        }

        // Compute MD5 hash
        const fileHash = await this.computeFileHash(localPath);

        // Check if already uploaded with same hash (skip only when not forced)
        if (!force) {
          const existingUploads = await this.db.getImageUploadsByCardIds([cardId]);
          const existing = existingUploads.get(cardId)?.find(u => u.filename === filename);
          if (existing && existing.fileHash === fileHash) {
            result.skipped++;
            if (onProgress) {
              await onProgress(((i + 1) / imageEntries.length) * 100, i + 1);
            }
            continue;
          }
        }

        // Upload via SFTP
        const remotePath = `${this.config.gcpScpRemoteDir}/${filename}`;
        await this.sftpUpload(localPath, remotePath);

        // Build remote URL
        const baseUrl = this.config.gcpImageBaseUrl.replace(/\/$/, '');
        const remoteUrl = `${baseUrl}/${encodeURIComponent(filename)}`;

        // Save to DB
        await this.db.saveImageUpload({ cardId, filename, remoteUrl, fileHash });
        result.uploaded++;
      } catch (err: unknown) {
        result.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${filename}: ${msg}`);
      }

      if (onProgress) {
        await onProgress(((i + 1) / imageEntries.length) * 100, i + 1);
      }
    }

    return result;
  }

  private computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private sftpUpload(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          sftp.fastPut(localPath, remotePath, (err) => {
            conn.end();
            if (err) return reject(err);
            resolve();
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      const connectConfig: Record<string, unknown> = {
        host: this.config.gcpScpHost,
        port: this.config.gcpScpPort,
        username: this.config.gcpScpUser,
      };

      if (this.config.gcpScpKeyPath) {
        const keyPath = this.config.gcpScpKeyPath.replace(/^~/, process.env.HOME || '');
        connectConfig.privateKey = fs.readFileSync(keyPath);
      }

      conn.connect(connectConfig);
    });
  }
}

export default ScpUploadService;
