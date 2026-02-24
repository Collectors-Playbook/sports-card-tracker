import BrowserService from '../../services/browserService';

// Variables that mock factories delegate to (set up in beforeEach to survive clearMocks)
let mockPageImpl: Record<string, jest.Mock>;
let mockBrowserImpl: Record<string, jest.Mock>;
let mockLaunchImpl: jest.Mock;

jest.mock('puppeteer-extra', () => ({
  __esModule: true,
  default: {
    use: jest.fn(),
    launch: (...args: unknown[]) => mockLaunchImpl(...args),
  },
}));

jest.mock('puppeteer-extra-plugin-stealth', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

describe('BrowserService', () => {
  let service: BrowserService;

  beforeEach(() => {
    mockPageImpl = {
      setViewport: jest.fn().mockResolvedValue(undefined),
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowserImpl = {
      newPage: jest.fn().mockResolvedValue(mockPageImpl),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockLaunchImpl = jest.fn().mockResolvedValue(mockBrowserImpl);

    service = new BrowserService({ headless: true, rateLimits: { eBay: 100 } });
  });

  describe('launch/shutdown lifecycle', () => {
    it('launches browser', async () => {
      expect(service.isRunning()).toBe(false);
      await service.launch();
      expect(service.isRunning()).toBe(true);
    });

    it('launch is idempotent', async () => {
      await service.launch();
      await service.launch();
      expect(mockLaunchImpl).toHaveBeenCalledTimes(1);
    });

    it('shuts down browser', async () => {
      await service.launch();
      await service.shutdown();
      expect(service.isRunning()).toBe(false);
      expect(mockBrowserImpl.close).toHaveBeenCalledTimes(1);
    });

    it('shutdown is safe when not running', async () => {
      await service.shutdown();
      expect(mockBrowserImpl.close).not.toHaveBeenCalled();
    });
  });

  describe('newPage', () => {
    it('throws if not launched', async () => {
      await expect(service.newPage()).rejects.toThrow('BrowserService not launched');
    });

    it('creates page with viewport and user-agent', async () => {
      await service.launch();
      const page = await service.newPage();
      expect(page).toBe(mockPageImpl);
      expect(mockPageImpl.setViewport).toHaveBeenCalledWith({ width: 1920, height: 1080 });
      expect(mockPageImpl.setUserAgent).toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('does not delay on first call', async () => {
      const promise = service.throttle('eBay');
      jest.runAllTimers();
      await promise;
    });

    it('uses default 1000ms for unknown sources', async () => {
      await service.throttle('Unknown');
    });
  });

  describe('navigateWithThrottle', () => {
    it('creates page and navigates', async () => {
      await service.launch();
      const page = await service.navigateWithThrottle('eBay', 'https://example.com');
      expect(page).toBe(mockPageImpl);
      expect(mockPageImpl.goto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
        waitUntil: 'networkidle2',
        timeout: 30000,
      }));
    });

    it('closes page on navigation error', async () => {
      mockPageImpl.goto.mockRejectedValueOnce(new Error('Navigation timeout'));
      await service.launch();
      await expect(service.navigateWithThrottle('eBay', 'https://bad.com'))
        .rejects.toThrow('Navigation timeout');
      expect(mockPageImpl.close).toHaveBeenCalled();
    });
  });
});
