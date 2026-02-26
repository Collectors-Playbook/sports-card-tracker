import path from 'path';
import { EbayEnvironment } from './types';

export interface EbayConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: EbayEnvironment;
  tokenEncryptionKey: string;
  scopes: string[];
}

export interface Config {
  port: number;
  frontendUrl: string;
  dataDir: string;
  rawDir: string;
  processedDir: string;
  dbPath: string;
  jwtSecret: string;
  jobPollInterval: number;
  puppeteerEnabled: boolean;
  puppeteerHeadless: boolean;
  compCacheTtlMs: number;
  rateLimits: Record<string, number>;
  ebay: EbayConfig;
}

export function loadConfig(): Config {
  const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../..');
  const port = parseInt(process.env.PORT || '8000', 10);

  return {
    port,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    dataDir,
    rawDir: path.join(dataDir, 'raw'),
    processedDir: path.join(dataDir, 'processed'),
    dbPath: process.env.DB_PATH || path.join(dataDir, 'server', 'database.sqlite'),
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    jobPollInterval: parseInt(process.env.JOB_POLL_INTERVAL || '5000', 10),
    puppeteerEnabled: process.env.PUPPETEER_ENABLED !== 'false',
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
    compCacheTtlMs: parseInt(process.env.COMP_CACHE_TTL_MS || '86400000', 10),
    rateLimits: {
      eBay: parseInt(process.env.RATE_LIMIT_EBAY || '2000', 10),
      SportsCardsPro: parseInt(process.env.RATE_LIMIT_SPORTSCARDSPRO || '1000', 10),
      CardLadder: parseInt(process.env.RATE_LIMIT_CARDLADDER || '1500', 10),
      MarketMovers: parseInt(process.env.RATE_LIMIT_MARKETMOVERS || '1500', 10),
      '130Point': parseInt(process.env.RATE_LIMIT_130POINT || '6000', 10),
      PSA: parseInt(process.env.RATE_LIMIT_PSA || '3000', 10),
      GemRate: parseInt(process.env.RATE_LIMIT_GEMRATE || '2000', 10),
    },
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
      redirectUri: process.env.EBAY_REDIRECT_URI || '',
      environment: (process.env.EBAY_ENVIRONMENT || 'sandbox') as EbayEnvironment,
      tokenEncryptionKey: process.env.EBAY_TOKEN_ENCRYPTION_KEY || '',
      scopes: [
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
      ],
    },
  };
}
