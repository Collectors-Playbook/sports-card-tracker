import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page, GoToOptions } from 'puppeteer';

puppeteer.use(StealthPlugin());

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface BrowserServiceOptions {
  headless?: boolean;
  rateLimits?: Record<string, number>;
}

class BrowserService {
  private browser: Browser | null = null;
  private headless: boolean;
  private rateLimits: Record<string, number>;
  private lastRequestTime: Map<string, number> = new Map();

  constructor(options: BrowserServiceOptions = {}) {
    this.headless = options.headless ?? true;
    this.rateLimits = options.rateLimits ?? {};
  }

  async launch(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  isRunning(): boolean {
    return this.browser !== null;
  }

  async newPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('BrowserService not launched. Call launch() first.');
    }

    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(DEFAULT_USER_AGENT);
    return page;
  }

  async throttle(source: string): Promise<void> {
    const delayMs = this.rateLimits[source] ?? 1000;
    const lastTime = this.lastRequestTime.get(source) ?? 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < delayMs) {
      await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
    }

    this.lastRequestTime.set(source, Date.now());
  }

  async navigateWithThrottle(
    source: string,
    url: string,
    options?: GoToOptions
  ): Promise<Page> {
    await this.throttle(source);

    const page = await this.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
        ...options,
      });
      return page;
    } catch (err) {
      await page.close();
      throw err;
    }
  }
}

export default BrowserService;
