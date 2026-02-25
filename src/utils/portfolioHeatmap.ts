import { Card } from '../types';
import { HeatmapApiCard } from '../services/api';

export interface HeatmapCardData {
  id: string;
  name: string;
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  isGraded: boolean;
  currentValue: number;
  purchasePrice: number;
  roi: number;
  roiPercent: number;
  color: string;
}

export interface HeatmapStats {
  totalCards: number;
  totalValue: number;
  winners: number;
  losers: number;
  flat: number;
  avgRoi: number;
}

// Color stops for ROI gradient: deep red → red → yellow → green → deep green
const COLOR_STOPS: { roi: number; r: number; g: number; b: number }[] = [
  { roi: -0.5, r: 220, g: 38, b: 38 },
  { roi: -0.25, r: 239, g: 68, b: 68 },
  { roi: 0, r: 234, g: 179, b: 8 },
  { roi: 0.25, r: 34, g: 197, b: 94 },
  { roi: 0.5, r: 22, g: 163, b: 74 },
];

export function calculateCardRoi(card: Card): number {
  if (!card.purchasePrice || card.purchasePrice <= 0) {
    return 0;
  }
  return (card.currentValue - card.purchasePrice) / card.purchasePrice;
}

export function roiToColor(roi: number): string {
  // Clamp ROI to [-0.5, 0.5]
  const clamped = Math.max(-0.5, Math.min(0.5, roi));

  // Find the two color stops to interpolate between
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lower = COLOR_STOPS[i];
    const upper = COLOR_STOPS[i + 1];
    if (clamped >= lower.roi && clamped <= upper.roi) {
      const t = (clamped - lower.roi) / (upper.roi - lower.roi);
      const r = Math.round(lower.r + t * (upper.r - lower.r));
      const g = Math.round(lower.g + t * (upper.g - lower.g));
      const b = Math.round(lower.b + t * (upper.b - lower.b));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  // Fallback to last stop
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  return `rgb(${last.r}, ${last.g}, ${last.b})`;
}

export function buildHeatmapData(cards: Card[]): HeatmapCardData[] {
  return cards
    .filter(card => !card.sellDate && card.currentValue > 0)
    .map(card => {
      const roi = calculateCardRoi(card);
      return {
        id: card.id,
        name: `${card.year} ${card.brand} ${card.player} #${card.cardNumber}`,
        player: card.player,
        team: card.team,
        year: card.year,
        brand: card.brand,
        category: card.category,
        isGraded: !!card.isGraded,
        currentValue: card.currentValue,
        purchasePrice: card.purchasePrice,
        roi,
        roiPercent: roi * 100,
        color: roiToColor(roi),
      };
    });
}

export function computeHeatmapStats(data: HeatmapCardData[]): HeatmapStats {
  const totalCards = data.length;
  const totalValue = data.reduce((sum, d) => sum + d.currentValue, 0);
  const winners = data.filter(d => d.roi > 0.01).length;
  const losers = data.filter(d => d.roi < -0.01).length;
  const flat = totalCards - winners - losers;
  const avgRoi = totalCards > 0
    ? data.reduce((sum, d) => sum + d.roi, 0) / totalCards
    : 0;

  return { totalCards, totalValue, winners, losers, flat, avgRoi };
}

export function calculatePeriodRoi(currentValue: number, periodStartValue: number | null): number {
  if (periodStartValue === null || periodStartValue <= 0) {
    return 0;
  }
  return (currentValue - periodStartValue) / periodStartValue;
}

export function buildHeatmapDataFromApi(apiCards: HeatmapApiCard[], period: string): HeatmapCardData[] {
  return apiCards.map(card => {
    const baseline = period === 'all' ? card.purchasePrice : card.periodStartValue;
    const roi = calculatePeriodRoi(card.currentValue, baseline);
    return {
      id: card.id,
      name: `${card.year} ${card.brand} ${card.player} #${card.cardNumber}`,
      player: card.player,
      team: card.team,
      year: card.year,
      brand: card.brand,
      category: card.category,
      isGraded: card.isGraded,
      currentValue: card.currentValue,
      purchasePrice: card.purchasePrice,
      roi,
      roiPercent: roi * 100,
      color: roiToColor(roi),
    };
  });
}
