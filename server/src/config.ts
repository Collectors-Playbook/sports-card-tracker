import path from 'path';

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
    },
  };
}
