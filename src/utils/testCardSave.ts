// Test script to manually test card saving
import { cardDatabase } from '../db/simpleDatabase';

export async function testCardSave() {
  console.log('=== TEST CARD SAVE ===');
  
  // Check current user
  const userStr = localStorage.getItem('user');
  console.log('Current user from localStorage:', userStr);
  
  if (!userStr) {
    console.error('No user logged in! Please log in first.');
    return;
  }
  
  const user = JSON.parse(userStr);
  console.log('Parsed user:', user);
  
  // Create test card
  const testCard = {
    id: `test-${Date.now()}`,
    player: 'Test Player ' + Date.now(),
    team: 'Test Team',
    year: 2024,
    brand: 'Test Brand',
    category: 'Baseball',
    cardNumber: 'T123',
    condition: 'Mint',
    purchasePrice: 10,
    purchaseDate: new Date(),
    currentValue: 20,
    notes: 'This is a test card created at ' + new Date().toISOString(),
    userId: user.id,
    images: [],
    collectionType: 'Inventory' as const,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  console.log('Test card to save:', testCard);
  
  try {
    // Save the card
    console.log('Calling cardDatabase.addCard...');
    await cardDatabase.addCard(testCard);
    console.log('Card saved successfully!');
    
    // Verify by getting all cards
    console.log('Getting all cards...');
    const allCards = await cardDatabase.getAllCards();
    console.log('Total cards:', allCards.length);
    
    // Find our test card
    const savedCard = allCards.find(c => c.id === testCard.id);
    if (savedCard) {
      console.log('Test card found in database:', savedCard);
      console.log('Card userId:', savedCard.userId);
      console.log('Card collectionId:', savedCard.collectionId);
    } else {
      console.error('Test card NOT found in database!');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
  
  console.log('=== END TEST ===');
}

// Make it available globally
(window as any).testCardSave = testCardSave;

// Also expose the cardDatabase for direct testing
(window as any).cardDatabase = cardDatabase;