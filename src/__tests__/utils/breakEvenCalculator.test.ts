import {
  calculateBreakEven,
  calculateProfit,
  EBAY_FVF_RATE,
  EBAY_PER_ORDER_FEE,
  PROMOTED_RATES,
  SHIPPING_COSTS,
  BreakEvenInput,
  ProfitInput,
} from '../../utils/breakEvenCalculator';

const baseInput: BreakEvenInput = {
  purchasePrice: 10,
  gradingCost: 0,
  shippingCost: SHIPPING_COSTS.PWE,
  fvfRate: EBAY_FVF_RATE,
  promotedRate: PROMOTED_RATES.none,
  perOrderFee: EBAY_PER_ORDER_FEE,
};

describe('breakEvenCalculator', () => {
  describe('calculateBreakEven', () => {
    it('calculates break-even with zero grading cost', () => {
      const result = calculateBreakEven(baseInput);
      // (10 + 0 + 1.50 + 0.30) / (1 - 0.129) = 11.80 / 0.871 ≈ 13.55
      expect(result.breakEvenPrice).toBeCloseTo(13.55, 1);
      expect(result.totalCosts).toBe(11.5); // 10 + 0 + 1.50
      expect(result.perOrderFee).toBe(0.30);
    });

    it('calculates break-even with grading cost', () => {
      const result = calculateBreakEven({ ...baseInput, gradingCost: 20 });
      // (10 + 20 + 1.50 + 0.30) / 0.871 = 31.80 / 0.871 ≈ 36.51
      expect(result.breakEvenPrice).toBeCloseTo(36.51, 1);
      expect(result.totalCosts).toBe(31.5);
    });

    it('calculates break-even with standard promoted listing', () => {
      const result = calculateBreakEven({
        ...baseInput,
        promotedRate: PROMOTED_RATES.standard,
      });
      // (10 + 0 + 1.50 + 0.30) / (1 - 0.129 - 0.02) = 11.80 / 0.851 ≈ 13.87
      expect(result.breakEvenPrice).toBeCloseTo(13.87, 1);
      expect(result.promotedFees).toBeGreaterThan(0);
    });

    it('calculates break-even with advanced promoted listing', () => {
      const result = calculateBreakEven({
        ...baseInput,
        promotedRate: PROMOTED_RATES.advanced,
      });
      // (10 + 0 + 1.50 + 0.30) / (1 - 0.129 - 0.05) = 11.80 / 0.821 ≈ 14.37
      expect(result.breakEvenPrice).toBeCloseTo(14.37, 1);
    });

    it('calculates break-even with BMWT shipping', () => {
      const result = calculateBreakEven({
        ...baseInput,
        shippingCost: SHIPPING_COSTS.BMWT,
      });
      // (10 + 0 + 5.00 + 0.30) / 0.871 = 15.30 / 0.871 ≈ 17.57
      expect(result.breakEvenPrice).toBeCloseTo(17.57, 1);
    });

    it('calculates break-even with SLAB shipping', () => {
      const result = calculateBreakEven({
        ...baseInput,
        shippingCost: SHIPPING_COSTS.SLAB,
      });
      // (10 + 0 + 8.00 + 0.30) / 0.871 = 18.30 / 0.871 ≈ 21.01
      expect(result.breakEvenPrice).toBeCloseTo(21.01, 1);
    });

    it('handles zero purchase price', () => {
      const result = calculateBreakEven({ ...baseInput, purchasePrice: 0 });
      // (0 + 0 + 1.50 + 0.30) / 0.871 = 1.80 / 0.871 ≈ 2.07
      expect(result.breakEvenPrice).toBeCloseTo(2.07, 1);
      expect(result.totalCosts).toBe(1.5);
    });
  });

  describe('calculateProfit', () => {
    const profitBase: ProfitInput = {
      ...baseInput,
      salePrice: 20,
    };

    it('calculates positive profit above break-even', () => {
      const result = calculateProfit(profitBase);
      // eBay fees: 20 * 0.129 = 2.58
      // Deductions: 2.58 + 0 + 0.30 + 10 + 0 + 1.50 = 14.38
      // Net: 20 - 14.38 = 5.62
      expect(result.ebayFees).toBeCloseTo(2.58, 2);
      expect(result.netProfit).toBeCloseTo(5.62, 1);
      expect(result.roi).toBeGreaterThan(0);
    });

    it('calculates negative profit below break-even', () => {
      const result = calculateProfit({ ...profitBase, salePrice: 5 });
      expect(result.netProfit).toBeLessThan(0);
      expect(result.roi).toBeLessThan(0);
    });

    it('calculates ROI correctly', () => {
      const result = calculateProfit(profitBase);
      // totalCosts = 10 + 0 + 1.50 = 11.50
      // roi = netProfit / totalCosts * 100
      const expectedRoi = (result.netProfit / 11.5) * 100;
      expect(result.roi).toBeCloseTo(expectedRoi, 1);
    });

    it('includes promoted fees in deductions', () => {
      const result = calculateProfit({
        ...profitBase,
        promotedRate: PROMOTED_RATES.standard,
      });
      // Promoted: 20 * 0.02 = 0.40
      expect(result.promotedFees).toBeCloseTo(0.40, 2);
      expect(result.totalDeductions).toBeGreaterThan(
        calculateProfit(profitBase).totalDeductions
      );
    });

    it('handles zero total costs for ROI', () => {
      const result = calculateProfit({
        ...profitBase,
        purchasePrice: 0,
        gradingCost: 0,
        shippingCost: 0,
      });
      expect(result.roi).toBe(0);
    });
  });

  describe('constants', () => {
    it('exports correct eBay fee rate', () => {
      expect(EBAY_FVF_RATE).toBe(0.129);
    });

    it('exports correct per-order fee', () => {
      expect(EBAY_PER_ORDER_FEE).toBe(0.30);
    });

    it('exports shipping costs for all methods', () => {
      expect(SHIPPING_COSTS.PWE).toBe(1.50);
      expect(SHIPPING_COSTS.BMWT).toBe(5.00);
      expect(SHIPPING_COSTS.SLAB).toBe(8.00);
    });

    it('exports promoted rate tiers', () => {
      expect(PROMOTED_RATES.none).toBe(0);
      expect(PROMOTED_RATES.standard).toBe(0.02);
      expect(PROMOTED_RATES.advanced).toBe(0.05);
    });
  });
});
