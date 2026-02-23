type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private isDevelopment = process.env.NODE_ENV === 'development';

  private constructor() {
    // Restore logs from sessionStorage on initialization
    this.restoreLogs();
    
    // Save logs periodically
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.saveLogs());
      setInterval(() => this.saveLogs(), 5000); // Save every 5 seconds
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private restoreLogs() {
    try {
      const saved = sessionStorage.getItem('app-logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to restore logs:', error);
    }
  }

  private saveLogs() {
    try {
      // Persist only lightweight fields; data/error are for console output only
      const slim = this.logs.map(({ timestamp, level, component, message }) => ({
        timestamp, level, component, message
      }));
      sessionStorage.setItem('app-logs', JSON.stringify(slim));
    } catch {
      // If still too large, drop the oldest half and retry
      this.logs = this.logs.slice(this.logs.length >> 1);
      try {
        const slim = this.logs.map(({ timestamp, level, component, message }) => ({
          timestamp, level, component, message
        }));
        sessionStorage.setItem('app-logs', JSON.stringify(slim));
      } catch {
        // Give up persisting rather than spamming the console
        sessionStorage.removeItem('app-logs');
      }
    }
  }

  private log(level: LogLevel, component: string, message: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error
    };

    // Add to internal log buffer
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with styling
    const styles = {
      debug: 'color: #888',
      info: 'color: #2196F3',
      warn: 'color: #FF9800',
      error: 'color: #F44336; font-weight: bold'
    };

    const prefix = `[${entry.timestamp}] [${component}]`;
    
    if (this.isDevelopment || level === 'error' || level === 'warn') {
      console.log(`%c${prefix} ${message}`, styles[level]);
      
      if (data) {
        console.log('Data:', data);
      }
      
      if (error) {
        console.error('Error:', error);
        console.error('Stack:', error.stack);
      }
    }
  }

  debug(component: string, message: string, data?: any) {
    this.log('debug', component, message, data);
  }

  info(component: string, message: string, data?: any) {
    this.log('info', component, message, data);
  }

  warn(component: string, message: string, data?: any) {
    this.log('warn', component, message, data);
  }

  error(component: string, message: string, error?: Error, data?: any) {
    this.log('error', component, message, data, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter(log => log.component === component);
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  clearLogs() {
    this.logs = [];
    this.saveLogs();
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (component: string, message: string, data?: any) => 
  logger.debug(component, message, data);

export const logInfo = (component: string, message: string, data?: any) => 
  logger.info(component, message, data);

export const logWarn = (component: string, message: string, data?: any) => 
  logger.warn(component, message, data);

export const logError = (component: string, message: string, error?: Error, data?: any) => 
  logger.error(component, message, error, data);

// Add global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Global', `Unhandled error: ${event.message}`, event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Global', `Unhandled promise rejection: ${event.reason}`, undefined, {
      reason: event.reason
    });
  });
}