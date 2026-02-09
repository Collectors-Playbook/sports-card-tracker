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
  };
}
