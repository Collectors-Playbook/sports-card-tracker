describe('Logger', () => {
  const loadLogger = () => {
    let mod: typeof import('../../utils/logger');
    jest.isolateModules(() => {
      mod = require('../../utils/logger');
    });
    return mod!;
  };

  // ---- basic logging ----
  describe('basic logging', () => {
    it('logs debug messages', () => {
      const { logger } = loadLogger();
      logger.debug('TestComponent', 'debug message');
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[logs.length - 1].level).toBe('debug');
      expect(logs[logs.length - 1].message).toBe('debug message');
    });

    it('logs info messages', () => {
      const { logInfo, logger } = loadLogger();
      logInfo('Test', 'info msg');
      const logs = logger.getLogs();
      expect(logs.some(l => l.level === 'info' && l.message === 'info msg')).toBe(true);
    });

    it('logs warn messages', () => {
      const { logWarn, logger } = loadLogger();
      logWarn('Test', 'warn msg');
      expect(logger.getLogs().some(l => l.level === 'warn')).toBe(true);
    });

    it('logs error messages with optional Error object', () => {
      const { logError, logger } = loadLogger();
      logError('Test', 'error msg', new Error('boom'));
      const errorLog = logger.getLogs().find(l => l.level === 'error');
      expect(errorLog).toBeTruthy();
      expect(errorLog!.message).toBe('error msg');
    });
  });

  // ---- log management ----
  describe('log management', () => {
    it('getLogsByComponent filters by component', () => {
      const { logger } = loadLogger();
      logger.info('CompA', 'msg1');
      logger.info('CompB', 'msg2');
      logger.info('CompA', 'msg3');
      expect(logger.getLogsByComponent('CompA').length).toBe(2);
    });

    it('getLogsByLevel filters by level', () => {
      const { logger } = loadLogger();
      logger.debug('A', 'debug');
      logger.info('A', 'info');
      logger.error('A', 'error');
      expect(logger.getLogsByLevel('debug').length).toBeGreaterThanOrEqual(1);
      expect(logger.getLogsByLevel('info').length).toBeGreaterThanOrEqual(1);
    });

    it('clearLogs empties the log buffer', () => {
      const { logger } = loadLogger();
      logger.info('A', 'msg');
      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  // ---- persistence ----
  describe('persistence', () => {
    it('exportLogs returns JSON string', () => {
      const { logger } = loadLogger();
      logger.info('A', 'msg');
      const exported = logger.exportLogs();
      expect(JSON.parse(exported)).toBeInstanceOf(Array);
    });

    it('getLogs returns a copy (not reference)', () => {
      const { logger } = loadLogger();
      logger.info('A', 'msg');
      const logs1 = logger.getLogs();
      const logs2 = logger.getLogs();
      expect(logs1).not.toBe(logs2);
      expect(logs1).toEqual(logs2);
    });
  });

  // ---- max limit ----
  describe('max limit', () => {
    it('keeps only maxLogs entries', () => {
      const { logger } = loadLogger();
      // Logger has maxLogs = 1000
      for (let i = 0; i < 1010; i++) {
        logger.debug('Test', `msg ${i}`);
      }
      expect(logger.getLogs().length).toBeLessThanOrEqual(1000);
    });
  });
});
