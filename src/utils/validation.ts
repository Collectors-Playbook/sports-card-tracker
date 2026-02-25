// Card data validation utilities

import { CATEGORIES, CONDITIONS, GRADING_COMPANIES, RAW_CONDITIONS } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateCard = (card: any): ValidationResult => {
  const errors: string[] = [];
  
  // Required fields
  if (!card.player || card.player.trim() === '') {
    errors.push('Player name is required');
  }
  
  if (!card.team || card.team.trim() === '') {
    errors.push('Team is required');
  }
  
  if (!card.year || card.year < 1850 || card.year > new Date().getFullYear() + 1) {
    errors.push('Year must be between 1850 and next year');
  }
  
  if (!card.brand || card.brand.trim() === '') {
    errors.push('Brand is required');
  }
  
  if (!card.category || !CATEGORIES.includes(card.category as any)) {
    errors.push('Valid category is required');
  }
  
  if (!card.cardNumber || card.cardNumber.trim() === '') {
    errors.push('Card number is required');
  }
  
  const validConditions = [...CONDITIONS, 'Graded', ...RAW_CONDITIONS];
  if (!card.condition || !validConditions.includes(card.condition as any)) {
    errors.push('Valid condition is required');
  }
  
  // Numeric validations
  if (typeof card.purchasePrice !== 'number' || card.purchasePrice < 0) {
    errors.push('Purchase price must be a positive number');
  }
  
  if (typeof card.currentValue !== 'number' || card.currentValue < 0) {
    errors.push('Current value must be a positive number');
  }
  
  if (card.sellPrice !== undefined && (typeof card.sellPrice !== 'number' || card.sellPrice < 0)) {
    errors.push('Sell price must be a positive number');
  }
  
  // Date validations
  if (!card.purchaseDate) {
    errors.push('Purchase date is required');
  } else {
    const purchaseDate = new Date(card.purchaseDate);
    if (purchaseDate > new Date()) {
      errors.push('Purchase date cannot be in the future');
    }
  }
  
  if (card.sellDate) {
    const sellDate = new Date(card.sellDate);
    const purchaseDate = new Date(card.purchaseDate);
    if (sellDate < purchaseDate) {
      errors.push('Sell date must be after purchase date');
    }
  }
  
  // Grading company validation
  if (card.gradingCompany && !GRADING_COMPANIES.includes(card.gradingCompany as any)) {
    errors.push('Invalid grading company');
  }
  
  // Logical validations
  const rawConditions = ['RAW', 'Raw', ...RAW_CONDITIONS];
  const isRawCondition = rawConditions.includes(card.condition);
  if (!isRawCondition && card.condition !== 'Graded' && !card.gradingCompany) {
    errors.push('Graded cards must have a grading company');
  }

  if (card.gradingCompany && isRawCondition) {
    errors.push('Cards with grading company cannot be RAW');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Format card number for consistency
export const formatCardNumber = (cardNumber: string): string => {
  return cardNumber.trim().toUpperCase();
};

// Format player name for consistency
export const formatPlayerName = (name: string): string => {
  return name.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Suggest current value based on condition and purchase price
export const suggestCurrentValue = (purchasePrice: number, condition: string): number => {
  const conditionMultipliers: Record<string, number> = {
    '10: GEM MINT': 2.5,
    '9.5: MINT+': 2.0,
    '9: MINT': 1.5,
    '8.5: NEAR MINT-MINT+': 1.3,
    '8: NEAR MINT-MINT': 1.2,
    '7.5: NEAR MINT+': 1.1,
    '7: NEAR MINT': 1.0,
    'RAW': 0.8
  };
  
  const multiplier = conditionMultipliers[condition] || 1.0;
  return Math.round(purchasePrice * multiplier);
};