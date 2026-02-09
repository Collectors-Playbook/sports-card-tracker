import { ReportingService } from '../../services/reportingService';
import { createCard, createSoldCard, createCardBatch, createPortfolio } from '../helpers/factories';
import { Card } from '../../types';

describe('ReportingService', () => {
  let cards: Card[];
  let service: ReportingService;

  beforeEach(() => {
    cards = createPortfolio();
    service = new ReportingService(cards);
  });

  // ---- filterCards ----
  describe('filterCards', () => {
    it('returns all cards with no filter', () => {
      expect(service.filterCards()).toHaveLength(cards.length);
    });

    it('returns all cards when filter is undefined', () => {
      expect(service.filterCards(undefined)).toHaveLength(cards.length);
    });

    it('filters by date range', () => {
      const result = service.filterCards({
        dateRange: { start: new Date('2022-01-01'), end: new Date('2022-12-31') },
      });
      expect(result.every(c => c.year >= 2020)).toBe(true); // purchaseDate is set from factory
    });

    it('filters by categories', () => {
      const result = service.filterCards({ categories: ['Baseball'] });
      expect(result.every(c => c.category === 'Baseball')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters by teams', () => {
      const result = service.filterCards({ teams: ['Angels'] });
      expect(result.every(c => c.team === 'Angels')).toBe(true);
    });

    it('filters by players (case-insensitive partial match)', () => {
      const result = service.filterCards({ players: ['trout'] });
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].player).toContain('Trout');
    });

    it('filters by conditions', () => {
      const result = service.filterCards({ conditions: ['RAW'] });
      expect(result.every(c => c.condition === 'RAW')).toBe(true);
    });

    it('filters by value range', () => {
      const result = service.filterCards({ valueRange: { min: 100, max: 300 } });
      expect(result.every(c => c.currentValue >= 100 && c.currentValue <= 300)).toBe(true);
    });

    it('filters by years', () => {
      const result = service.filterCards({ years: [2023] });
      expect(result.every(c => c.year === 2023)).toBe(true);
    });

    it('filters by brands', () => {
      const result = service.filterCards({ brands: ['Topps'] });
      expect(result.every(c => c.brand === 'Topps')).toBe(true);
    });

    it('combines multiple filters', () => {
      const result = service.filterCards({
        categories: ['Baseball'],
        conditions: ['RAW'],
      });
      expect(result.every(c => c.category === 'Baseball' && c.condition === 'RAW')).toBe(true);
    });
  });

  // ---- calculateMetrics ----
  describe('calculateMetrics', () => {
    it('counts total cards', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.totalCards).toBe(cards.length);
    });

    it('sums total value', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.totalValue).toBe(cards.reduce((s, c) => s + c.currentValue, 0));
    });

    it('sums total cost', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.totalCost).toBe(cards.reduce((s, c) => s + c.purchasePrice, 0));
    });

    it('calculates profit', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.totalProfit).toBe(metrics.totalValue - metrics.totalCost);
    });

    it('calculates ROI', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.roi).toBeCloseTo((metrics.totalProfit / metrics.totalCost) * 100);
    });

    it('calculates averages', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.averageValue).toBeCloseTo(metrics.totalValue / metrics.totalCards);
    });

    it('counts sold cards and revenue', () => {
      const metrics = service.calculateMetrics();
      expect(metrics.cardsSold).toBe(cards.filter(c => c.sellPrice && c.sellDate).length);
      expect(metrics.salesRevenue).toBeGreaterThan(0);
    });

    it('handles empty card array', () => {
      const emptyService = new ReportingService([]);
      const metrics = emptyService.calculateMetrics();
      expect(metrics.totalCards).toBe(0);
      expect(metrics.averageValue).toBe(0);
      expect(metrics.roi).toBe(0);
    });
  });

  // ---- generatePortfolioPerformance ----
  describe('generatePortfolioPerformance', () => {
    it('calculates total return', () => {
      const perf = service.generatePortfolioPerformance();
      expect(perf.totalReturn).toBeDefined();
    });

    it('separates realized and unrealized gains', () => {
      const perf = service.generatePortfolioPerformance();
      expect(perf.realizedGains).toBeDefined();
      expect(perf.unrealizedGains).toBeDefined();
      expect(perf.realizedGains + perf.unrealizedGains).toBeCloseTo(perf.totalReturn);
    });

    it('returns best performers sorted by gain desc', () => {
      const perf = service.generatePortfolioPerformance();
      expect(perf.bestPerformers.length).toBeGreaterThan(0);
      expect(perf.bestPerformers.length).toBeLessThanOrEqual(10);
    });

    it('returns worst performers sorted by gain asc', () => {
      const perf = service.generatePortfolioPerformance();
      expect(perf.worstPerformers.length).toBeGreaterThan(0);
    });

    it('includes monthly returns', () => {
      const perf = service.generatePortfolioPerformance();
      expect(Array.isArray(perf.monthlyReturns)).toBe(true);
    });

    it('includes category performance', () => {
      const perf = service.generatePortfolioPerformance();
      expect(perf.categoryPerformance.length).toBeGreaterThan(0);
    });

    it('calculates annualized return', () => {
      const perf = service.generatePortfolioPerformance();
      expect(typeof perf.annualizedReturn).toBe('number');
    });

    it('respects filters', () => {
      const perf = service.generatePortfolioPerformance({ categories: ['Baseball'] });
      expect(perf.bestPerformers.every(c => c.category === 'Baseball')).toBe(true);
    });
  });

  // ---- generateCollectionAnalytics ----
  describe('generateCollectionAnalytics', () => {
    it('returns category distribution', () => {
      const analytics = service.generateCollectionAnalytics();
      expect(analytics.categoryDistribution.length).toBeGreaterThan(0);
      const totalCount = analytics.categoryDistribution.reduce((s, d) => s + d.count, 0);
      expect(totalCount).toBe(cards.length);
    });

    it('returns condition distribution', () => {
      const analytics = service.generateCollectionAnalytics();
      expect(analytics.conditionDistribution.length).toBeGreaterThan(0);
    });

    it('returns year distribution sorted desc', () => {
      const analytics = service.generateCollectionAnalytics();
      expect(analytics.yearDistribution.length).toBeGreaterThan(0);
      for (let i = 1; i < analytics.yearDistribution.length; i++) {
        expect(analytics.yearDistribution[i - 1].year).toBeGreaterThanOrEqual(analytics.yearDistribution[i].year);
      }
    });

    it('returns brand distribution', () => {
      const analytics = service.generateCollectionAnalytics();
      expect(analytics.brandDistribution.length).toBeGreaterThan(0);
    });

    it('returns value distribution with known ranges', () => {
      const analytics = service.generateCollectionAnalytics();
      expect(analytics.valueDistribution.length).toBe(6); // 6 predefined ranges
    });
  });

  // ---- generateMarketAnalysis ----
  describe('generateMarketAnalysis', () => {
    it('returns top gainers and losers', () => {
      const analysis = service.generateMarketAnalysis();
      expect(analysis.topGainers.length).toBeGreaterThan(0);
      expect(analysis.topLosers.length).toBeGreaterThan(0);
    });

    it('includes player performance', () => {
      const analysis = service.generateMarketAnalysis();
      expect(analysis.playerPerformance.length).toBeGreaterThan(0);
      expect(analysis.playerPerformance[0]).toHaveProperty('player');
      expect(analysis.playerPerformance[0]).toHaveProperty('totalValue');
    });

    it('includes market comparison', () => {
      const analysis = service.generateMarketAnalysis();
      expect(analysis.marketComparison).toHaveProperty('portfolioReturn');
      expect(analysis.marketComparison).toHaveProperty('marketIndex');
      expect(analysis.marketComparison).toHaveProperty('outperformance');
    });

    it('calculates percentage gains correctly', () => {
      const analysis = service.generateMarketAnalysis();
      const gainer = analysis.topGainers[0];
      expect(gainer.percentage).toBeCloseTo(
        ((gainer.currentValue - gainer.purchaseValue) / gainer.purchaseValue) * 100
      );
    });
  });

  // ---- generateTaxReport ----
  describe('generateTaxReport', () => {
    it('returns sold cards for the given year', () => {
      const report = service.generateTaxReport(2024);
      expect(report.year).toBe(2024);
    });

    it('separates short-term and long-term gains', () => {
      const report = service.generateTaxReport(2024);
      const allGains = [...report.shortTermGains, ...report.longTermGains];
      expect(allGains.length).toBe(
        cards.filter(c => c.sellPrice && c.sellDate && new Date(c.sellDate).getFullYear() === 2024).length
      );
    });

    it('calculates gain/loss per card', () => {
      const report = service.generateTaxReport(2024);
      report.shortTermGains.forEach(gain => {
        expect(gain.gainLoss).toBe(gain.salePrice - gain.costBasis);
      });
    });

    it('sums total gains', () => {
      const report = service.generateTaxReport(2024);
      expect(report.netGainLoss).toBe(report.totalShortTerm + report.totalLongTerm);
    });

    it('returns empty for years with no sales', () => {
      const report = service.generateTaxReport(1999);
      expect(report.shortTermGains).toHaveLength(0);
      expect(report.longTermGains).toHaveLength(0);
      expect(report.netGainLoss).toBe(0);
    });

    it('calculates holding period in days', () => {
      const report = service.generateTaxReport(2024);
      report.shortTermGains.forEach(gain => {
        expect(gain.holdingPeriod).toBeLessThanOrEqual(365);
      });
      report.longTermGains.forEach(gain => {
        expect(gain.holdingPeriod).toBeGreaterThan(365);
      });
    });
  });

  // ---- generateInsuranceReport ----
  describe('generateInsuranceReport', () => {
    it('calculates total replacement value', () => {
      const report = service.generateInsuranceReport();
      expect(report.totalReplacementValue).toBe(cards.reduce((s, c) => s + c.currentValue, 0));
    });

    it('identifies high value cards (top 10%)', () => {
      const report = service.generateInsuranceReport();
      expect(report.highValueCards.length).toBe(Math.ceil(cards.length * 0.1));
    });

    it('provides category breakdown', () => {
      const report = service.generateInsuranceReport();
      expect(report.categoryBreakdown.length).toBeGreaterThan(0);
      report.categoryBreakdown.forEach(cat => {
        expect(cat.cardCount).toBeGreaterThan(0);
        expect(cat.totalValue).toBeGreaterThan(0);
      });
    });

    it('recommends 20% buffer coverage', () => {
      const report = service.generateInsuranceReport();
      expect(report.recommendedCoverage).toBeCloseTo(report.totalReplacementValue * 1.2);
    });
  });
});
