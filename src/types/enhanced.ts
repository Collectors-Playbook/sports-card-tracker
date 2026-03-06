// Enhanced card interface with additional fields for serious collectors

import { Card } from './index';

export interface EnhancedCard extends Card {
  // Serial Numbering
  serialNumber?: string; // e.g., "23/99"
  isNumbered?: boolean;
  printRun?: number; // Total print run if numbered
  
  // Set Information
  setName?: string; // e.g., "Topps Chrome Update"
  subset?: string; // e.g., "Future Stars", "Rookie Debut"
  insertSet?: string; // For special inserts
  
  // Card Characteristics
  isRookie?: boolean;
  isAutographed?: boolean;
  autographType?: 'on-card' | 'sticker';
  hasMemorabilia?: boolean;
  memorabiliaType?: string; // e.g., "jersey", "bat", "patch"
  
  // Grading Details
  certificationNumber?: string;
  gradingDate?: Date;
  subgrades?: {
    centering: number;
    corners: number;
    edges: number;
    surface: number;
  };
  
  // Inventory Management
  quantity?: number; // Default 1
  storageLocationLabel?: string; // e.g., "Safe", "Display Case A"
  storageType?: 'raw' | 'toploader' | 'one-touch' | 'slab' | 'binder';
  
  // Market Data
  lastSalePrice?: number;
  lastSaleDate?: Date;
  marketValue?: number; // Different from currentValue (user estimate)
  priceSource?: string; // e.g., "eBay", "COMC", "Manual"
  
  // Additional Metadata
  acquiredFrom?: string; // e.g., "eBay", "LCS", "Pack", "Trade"
  consignmentStatus?: 'none' | 'listed' | 'sold';
  insuredValue?: number;
  tags?: string[]; // Custom tags for organization
}

// Common card brands for dropdowns
export const CARD_BRANDS = [
  // Baseball
  'Topps', 'Topps Chrome', 'Topps Update', 'Topps Heritage',
  'Bowman', 'Bowman Chrome', 'Bowman Draft',
  'Panini Prizm', 'Panini Select', 'Panini Chronicles',
  'Stadium Club', 'Allen & Ginter',
  
  // Basketball
  'Panini Prizm', 'Panini Select', 'Panini Mosaic',
  'Panini Optic', 'Panini Hoops', 'Panini Donruss',
  'Panini Flawless', 'Panini National Treasures',
  
  // Football
  'Panini Prizm', 'Panini Select', 'Panini Mosaic',
  'Panini Phoenix', 'Panini Score', 'Panini Absolute',
  'Panini Contenders', 'Panini Origins',
  
  // Hockey
  'Upper Deck', 'Upper Deck Series 1', 'Upper Deck Series 2',
  'Upper Deck Young Guns', 'O-Pee-Chee', 'SP Authentic',
  
  // Other
  'Leaf', 'Fleer', 'Donruss', 'Score', 'Pro Set'
] as const;

// Parallel types commonly found
export const PARALLEL_TYPES = [
  'Base', 'Silver', 'Gold', 'Black', 'Blue', 'Red', 'Green', 
  'Orange', 'Purple', 'Pink', 'Prizm', 'Refractor', 
  'X-Fractor', 'Superfractor', 'Atomic', 'Shimmer',
  'Cracked Ice', 'Rainbow Foil', 'Holo', 'Mojo'
] as const;

// Storage recommendations by value
export const getStorageRecommendation = (value: number): string => {
  if (value >= 1000) return 'one-touch';
  if (value >= 100) return 'toploader';
  if (value >= 20) return 'toploader';
  return 'binder';
};