// Integration utilities for enhanced card data

import { Card } from '../types';
import { EnhancedCard } from '../types/card-enhanced';
import { migrateCardToEnhanced, hasEnhancedFields } from './cardMigration';

// Convert enhanced card back to basic card for storage
export const enhancedToBasicCard = (enhancedCard: Partial<EnhancedCard>): Card => {
  // Generate enhanced notes that include special features
  const enhancedNotes = generateEnhancedNotes(enhancedCard);
  
  // Combine original notes with enhanced notes
  const combinedNotes = [enhancedCard.notes, enhancedNotes]
    .filter(note => note && note.trim().length > 0)
    .join(' | ');
  
  // Extract basic fields
  const basicCard: Card = {
    id: enhancedCard.id || `card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    userId: enhancedCard.userId || '', // Preserve userId if it exists
    collectionId: enhancedCard.collectionId, // Preserve collectionId
    createdAt: enhancedCard.createdAt || new Date(),
    updatedAt: new Date(),
    
    // Core fields
    player: enhancedCard.player || '',
    team: enhancedCard.team || '',
    year: enhancedCard.year || new Date().getFullYear(),
    brand: enhancedCard.brand || '',
    category: enhancedCard.category || '',
    cardNumber: enhancedCard.cardNumber || '',
    parallel: enhancedCard.parallel,
    condition: enhancedCard.condition || 'RAW',
    collectionType: enhancedCard.collectionType || 'Inventory',
    gradingCompany: enhancedCard.gradingCompany,
    
    // Financial
    purchasePrice: enhancedCard.purchasePrice || 0,
    purchaseDate: enhancedCard.purchaseDate || new Date(),
    sellPrice: enhancedCard.sellPrice,
    sellDate: enhancedCard.sellDate,
    currentValue: enhancedCard.currentValue || 0,
    
    // Images & Notes - include both original notes and enhanced features
    images: enhancedCard.images || [],
    notes: combinedNotes || ''
  };
  
  return basicCard;
};

// Generate comprehensive notes from enhanced fields
const generateEnhancedNotes = (card: Partial<EnhancedCard>): string => {
  const notes: string[] = [];
  
  // Don't add existing notes here - they will be combined separately
  // to avoid duplication when editing cards multiple times
  
  // Add enhanced field information
  if (card.identification) {
    const id = card.identification;
    if (id.serialNumber) notes.push(`Serial: ${id.serialNumber}`);
    if (id.printRun) notes.push(`Print Run: ${id.printRun}`);
    if (id.subset) notes.push(`Subset: ${id.subset}`);
    if (id.insert) notes.push(`Insert: ${id.insert}`);
  }
  
  if (card.playerMetadata) {
    const meta = card.playerMetadata;
    if (meta.isRookie) notes.push('ROOKIE CARD');
    if (meta.isHallOfFame) notes.push(`HOF (${meta.inductionYear})`);
    if (meta.jerseyNumber) notes.push(`Jersey #${meta.jerseyNumber}`);
    if (meta.position) notes.push(`Position: ${meta.position}`);
  }
  
  if (card.specialFeatures) {
    const features = card.specialFeatures;
    if (features.hasAutograph) {
      notes.push(`Autograph: ${features.autographType || 'Unknown type'}`);
      if (features.autographColor) notes.push(`Auto Color: ${features.autographColor}`);
    }
    if (features.hasMemorabilia) {
      notes.push('Memorabilia Card');
      if (features.isPatch) notes.push('PATCH');
      if (features.isGameUsed) notes.push('Game Used');
    }
    if (features.is1of1) notes.push('1/1 ONE OF ONE');
  }
  
  if (card.authentication) {
    const auth = card.authentication;
    if (auth.certificationNumber) notes.push(`Cert #${auth.certificationNumber}`);
    if (auth.populationHigher !== undefined) {
      notes.push(`Pop Report: ${auth.populationHigher} higher, ${auth.populationEqual} equal`);
    }
  }
  
  if (card.marketData) {
    const market = card.marketData;
    if (market.purchaseVenue) notes.push(`Purchased from: ${market.purchaseVenue}`);
    if (market.trendDirection) notes.push(`Market Trend: ${market.trendDirection}`);
  }
  
  if (card.storage) {
    const storage = card.storage;
    if (storage.storageLocation) notes.push(`Location: ${storage.storageLocation}`);
    if (storage.boxNumber) notes.push(`Box: ${storage.boxNumber}`);
  }
  
  if (card.collectionMeta) {
    const meta = card.collectionMeta;
    if (meta.personalStory) notes.push(`Story: ${meta.personalStory}`);
    if (meta.willingToTrade) notes.push('AVAILABLE FOR TRADE');
  }
  
  return notes.join(' | ');
};

// Store enhanced data in localStorage
export const saveEnhancedData = (cardId: string, enhancedData: Partial<EnhancedCard>) => {
  const key = `enhanced_card_${cardId}`;
  const dataToStore = {
    identification: enhancedData.identification,
    playerMetadata: enhancedData.playerMetadata,
    authentication: enhancedData.authentication,
    specialFeatures: enhancedData.specialFeatures,
    marketData: enhancedData.marketData,
    physicalAttributes: enhancedData.physicalAttributes,
    storage: enhancedData.storage,
    transaction: enhancedData.transaction,
    digital: enhancedData.digital,
    analytics: enhancedData.analytics,
    collectionMeta: enhancedData.collectionMeta
  };
  
  console.log('Saving enhanced data for card:', cardId);
  console.log('LocalStorage key:', key);
  console.log('Data to store:', dataToStore);
  
  localStorage.setItem(key, JSON.stringify(dataToStore));
  
  // Verify the save
  const saved = localStorage.getItem(key);
  console.log('Verification - Data saved to localStorage:', saved);
};

// Retrieve enhanced data from localStorage
export const loadEnhancedData = (cardId: string): Partial<EnhancedCard> | null => {
  const key = `enhanced_card_${cardId}`;
  const data = localStorage.getItem(key);
  
  console.log('Loading enhanced data for card:', cardId);
  console.log('LocalStorage key:', key);
  console.log('Raw data from localStorage:', data);
  
  if (data) {
    try {
      const parsed = JSON.parse(data);
      console.log('Parsed enhanced data:', parsed);
      return parsed;
    } catch (error) {
      console.error('Error parsing enhanced card data:', error);
      return null;
    }
  }
  
  console.log('No enhanced data found for card:', cardId);
  return null;
};

// Merge basic card with enhanced data
export const mergeCardWithEnhanced = (card: Card): EnhancedCard => {
  console.log('Merging card with enhanced data:', card.id);
  const enhancedData = loadEnhancedData(card.id);
  
  if (enhancedData) {
    console.log('Found enhanced data, merging with basic card');
    const merged = {
      ...card,
      ...enhancedData
    };
    console.log('Merged card data:', merged);
    return merged;
  }
  
  console.log('No enhanced data found, migrating card to enhanced format');
  return migrateCardToEnhanced(card);
};

// Save complete enhanced card
export const saveEnhancedCard = async (
  enhancedCard: Partial<EnhancedCard>,
  addCard: (card: Card) => Promise<void>,
  updateCard: (card: Card) => Promise<void>
): Promise<void> => {
  console.log('[saveEnhancedCard] Starting save process for enhanced card:', enhancedCard);
  
  // Convert to basic card for database
  const basicCard = enhancedToBasicCard(enhancedCard);
  console.log('[saveEnhancedCard] Converted to basic card:', basicCard);
  
  // Save enhanced data to localStorage
  saveEnhancedData(basicCard.id, enhancedCard);
  
  // Save to database
  // Check if this is an update (card has an ID and was created before)
  const isUpdate = enhancedCard.id && enhancedCard.createdAt;
  
  console.log('[saveEnhancedCard] Save details:', {
    id: enhancedCard.id,
    createdAt: enhancedCard.createdAt,
    isUpdate,
    player: enhancedCard.player,
    basicCardId: basicCard.id,
    userId: basicCard.userId,
    collectionId: basicCard.collectionId
  });
  
  try {
    if (isUpdate) {
      console.log('[saveEnhancedCard] Updating existing card');
      await updateCard(basicCard);
      console.log('[saveEnhancedCard] Card updated successfully');
    } else {
      console.log('[saveEnhancedCard] Adding new card');
      await addCard(basicCard);
      console.log('[saveEnhancedCard] Card added successfully');
    }
  } catch (error) {
    console.error('[saveEnhancedCard] Error saving card:', error);
    throw error;
  }
};