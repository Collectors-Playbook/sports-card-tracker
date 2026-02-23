// eBay Final Value Fees (Sports Trading Cards category)
export const EBAY_FVF_RATE = 0.129; // 12.9%
export const EBAY_PER_ORDER_FEE = 0.30; // $0.30 per order

// Promoted listing ad rates
export const PROMOTED_RATES = {
  none: 0,
  standard: 0.02, // ~2%
  advanced: 0.05, // ~5%
} as const;

export type PromotedTier = keyof typeof PROMOTED_RATES;

// Shipping costs by method
export const SHIPPING_COSTS = {
  PWE: 1.50,   // Plain white envelope
  BMWT: 5.00,  // Bubble mailer with tracking
  SLAB: 8.00,  // Graded card in slab
} as const;

export type ShippingMethod = keyof typeof SHIPPING_COSTS;

export interface BreakEvenInput {
  purchasePrice: number;
  gradingCost: number;
  shippingCost: number;
  fvfRate: number;      // default EBAY_FVF_RATE
  promotedRate: number;  // default 0
  perOrderFee: number;   // default EBAY_PER_ORDER_FEE
}

export interface BreakEvenResult {
  breakEvenPrice: number;
  totalCosts: number;
  ebayFees: number;      // FVF at break-even price
  promotedFees: number;  // promoted fees at break-even price
  perOrderFee: number;
}

export interface ProfitInput extends BreakEvenInput {
  salePrice: number;
}

export interface ProfitResult {
  netProfit: number;
  roi: number;           // percentage
  ebayFees: number;
  promotedFees: number;
  perOrderFee: number;
  totalDeductions: number;
}

/**
 * Calculate the minimum sale price needed to cover all costs.
 *
 * Formula: breakEven = (purchasePrice + gradingCost + shippingCost + perOrderFee) / (1 - fvfRate - promotedRate)
 */
export function calculateBreakEven(input: BreakEvenInput): BreakEvenResult {
  const { purchasePrice, gradingCost, shippingCost, fvfRate, promotedRate, perOrderFee } = input;

  const fixedCosts = purchasePrice + gradingCost + shippingCost + perOrderFee;
  const divisor = 1 - fvfRate - promotedRate;
  const breakEvenPrice = divisor > 0 ? fixedCosts / divisor : 0;

  return {
    breakEvenPrice: Math.round(breakEvenPrice * 100) / 100,
    totalCosts: Math.round((purchasePrice + gradingCost + shippingCost) * 100) / 100,
    ebayFees: Math.round(breakEvenPrice * fvfRate * 100) / 100,
    promotedFees: Math.round(breakEvenPrice * promotedRate * 100) / 100,
    perOrderFee,
  };
}

/**
 * Calculate net profit and ROI at a given sale price.
 */
export function calculateProfit(input: ProfitInput): ProfitResult {
  const { salePrice, purchasePrice, gradingCost, shippingCost, fvfRate, promotedRate, perOrderFee } = input;

  const ebayFees = Math.round(salePrice * fvfRate * 100) / 100;
  const promotedFees = Math.round(salePrice * promotedRate * 100) / 100;
  const totalDeductions = ebayFees + promotedFees + perOrderFee + purchasePrice + gradingCost + shippingCost;
  const netProfit = Math.round((salePrice - totalDeductions) * 100) / 100;
  const totalCosts = purchasePrice + gradingCost + shippingCost;
  const roi = totalCosts > 0 ? Math.round((netProfit / totalCosts) * 10000) / 100 : 0;

  return {
    netProfit,
    roi,
    ebayFees,
    promotedFees,
    perOrderFee,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
  };
}
