export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  profilePhoto?: string | null;
}

export type CollectionType = 'PC' | 'Inventory' | 'Pending';

export const COLLECTION_TYPES: { value: CollectionType; label: string }[] = [
  { value: 'Inventory', label: 'Inventory (For Sale)' },
  { value: 'PC', label: 'Personal Collection (Keep)' },
  { value: 'Pending', label: 'Pending (Unsorted)' }
];

export interface Card {
  id: string;
  userId: string; // User who owns this card
  collectionId?: string; // Collection this card belongs to
  collectionType: CollectionType; // PC = never sell, Inventory = for sale
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  setName?: string;
  serialNumber?: string;
  grade?: string;
  isRookie?: boolean;
  isAutograph?: boolean;
  isRelic?: boolean;
  isNumbered?: boolean;
  isGraded?: boolean;
  purchasePrice: number;
  purchaseDate: Date;
  sellPrice?: number;
  sellDate?: Date;
  currentValue: number;
  images: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardFormData {
  player: string;
  team: string;
  year: number;
  brand: string;
  category: string;
  cardNumber: string;
  parallel?: string;
  condition: string;
  gradingCompany?: string;
  purchasePrice: number;
  purchaseDate: string;
  sellPrice?: number;
  sellDate?: string;
  currentValue: number;
  notes: string;
  collectionId?: string;
  collectionType?: string;
}

export interface PortfolioStats {
  totalCards: number;
  totalCostBasis: number;
  totalCurrentValue: number;
  totalProfit: number;
  totalSold: number;
  totalSoldValue: number;
}

export interface FilterOptions {
  player?: string;
  team?: string;
  year?: number;
  brand?: string;
  category?: string;
  condition?: string;
  minValue?: number;
  maxValue?: number;
  collectionType?: string;
}

export interface SortOption {
  field: keyof Card;
  direction: 'asc' | 'desc';
}

export type ConditionGrade = 
  | 'RAW'
  | '10: GEM MINT'
  | '9.5: MINT+'
  | '9: MINT'
  | '8.5: NEAR MINT-MINT+'
  | '8: NEAR MINT-MINT'
  | '7.5: NEAR MINT+'
  | '7: NEAR MINT'
  | '6.5: EXCELLENT-MINT+'
  | '6: EXCELLENT-MINT'
  | '5.5: EXCELLENT+'
  | '5: EXCELLENT'
  | '4.5: VERY GOOD-EXCELLENT+'
  | '4: VERY GOOD-EXCELLENT'
  | '3.5: VERY GOOD+'
  | '3: VERY GOOD'
  | '2.5: GOOD+'
  | '2: GOOD'
  | '1.5: POOR+'
  | '1: POOR';

export const CONDITIONS: ConditionGrade[] = [
  'RAW',
  '10: GEM MINT',
  '9.5: MINT+',
  '9: MINT',
  '8.5: NEAR MINT-MINT+',
  '8: NEAR MINT-MINT',
  '7.5: NEAR MINT+',
  '7: NEAR MINT',
  '6.5: EXCELLENT-MINT+',
  '6: EXCELLENT-MINT',
  '5.5: EXCELLENT+',
  '5: EXCELLENT',
  '4.5: VERY GOOD-EXCELLENT+',
  '4: VERY GOOD-EXCELLENT',
  '3.5: VERY GOOD+',
  '3: VERY GOOD',
  '2.5: GOOD+',
  '2: GOOD',
  '1.5: POOR+',
  '1: POOR'
];

export type CardCategory = 
  | 'Racing'
  | 'MMA'
  | 'Wrestling'
  | 'Pokemon'
  | 'Soccer'
  | 'Hockey'
  | 'Baseball'
  | 'Basketball'
  | 'Football'
  | 'Magic: The Gathering';

export const CATEGORIES: CardCategory[] = [
  'Racing',
  'MMA',
  'Wrestling',
  'Pokemon',
  'Soccer',
  'Hockey',
  'Baseball',
  'Basketball',
  'Football',
  'Magic: The Gathering'
];

export type GradingCompany = 
  | 'PSA'
  | 'BGS'
  | 'SGC'
  | 'CGC Cards'
  | 'CSG'
  | 'HGA'
  | 'TAG'
  | 'ISA'
  | 'GMA Grading'
  | 'ACE Grading';

export const GRADING_COMPANIES: GradingCompany[] = [
  'PSA',
  'BGS',
  'SGC',
  'CGC Cards',
  'CSG',
  'HGA',
  'TAG',
  'ISA',
  'GMA Grading',
  'ACE Grading'
];