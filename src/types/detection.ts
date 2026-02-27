// Types for card detection and extraction

export interface ExtractedCardData {
  // Basic Information
  player?: string;
  year?: string;
  brand?: string;
  setName?: string;
  cardNumber?: string;
  team?: string;
  category?: string;
  
  // Card Details
  parallel?: string;
  variation?: string;
  serialNumber?: string;
  printRun?: number;
  
  // Condition & Grading
  condition?: string;
  gradingCompany?: string;
  grade?: string;
  certNumber?: string;

  // Collection
  collectionId?: string;
  
  // Special Features
  features?: CardFeatures;
  
  // Metadata
  confidence?: DetectionConfidence;
  rawText?: string;
  extractionErrors?: string[];
}

export interface CardFeatures {
  isRookie: boolean;
  isAutograph: boolean;
  isRelic: boolean;
  isNumbered: boolean;
  isGraded: boolean;
  isParallel: boolean;
  isInsert?: boolean;
  isShortPrint?: boolean;
  isVariation?: boolean;
  is1of1?: boolean;
}

export interface DetectionConfidence {
  score: number; // 0-100
  level: 'high' | 'medium' | 'low';
  detectedFields: number;
  missingFields?: string[];
  warnings?: string[];
}

export interface DetectionResult {
  success: boolean;
  data?: ExtractedCardData;
  error?: string;
  processingTime?: number;
}

// Image processing options
export interface ImageProcessingOptions {
  enhanceContrast?: boolean;
  removeGlare?: boolean;
  autoRotate?: boolean;
  detectMultipleCards?: boolean;
}

// Detection settings
export interface DetectionSettings {
  language?: 'en' | 'es' | 'ja' | 'fr';
  sportHint?: 'baseball' | 'basketball' | 'football' | 'hockey' | 'soccer' | 'pokemon';
  yearRange?: { min: number; max: number };
  confidenceThreshold?: number;
}