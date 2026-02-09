import { Card, User } from '../../types';
import { Collection } from '../../types/collection';

let counter = 0;
const nextId = () => `test-${++counter}`;

export const createCard = (overrides: Partial<Card> = {}): Card => ({
  id: nextId(),
  userId: 'user-1',
  collectionId: 'collection-1',
  player: 'Mike Trout',
  team: 'Angels',
  year: 2023,
  brand: 'Topps Chrome',
  category: 'Baseball',
  cardNumber: '1',
  condition: 'RAW',
  purchasePrice: 50,
  purchaseDate: new Date('2023-06-15'),
  currentValue: 75,
  images: [],
  notes: '',
  createdAt: new Date('2023-06-15'),
  updatedAt: new Date('2023-06-15'),
  collectionType: 'Inventory',
  ...overrides,
});

export const createSoldCard = (overrides: Partial<Card> = {}): Card =>
  createCard({
    sellPrice: 100,
    sellDate: new Date('2024-01-15'),
    ...overrides,
  });

export const createGradedCard = (overrides: Partial<Card> = {}): Card =>
  createCard({
    condition: '10: GEM MINT',
    gradingCompany: 'PSA',
    currentValue: 200,
    ...overrides,
  });

export const createUser = (overrides: Partial<User> = {}): User => ({
  id: nextId(),
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  ...overrides,
});

export const createCollection = (overrides: Partial<Collection> = {}): Collection => ({
  id: nextId(),
  userId: 'user-1',
  name: 'Test Collection',
  description: 'A test collection',
  color: '#4F46E5',
  icon: '📦',
  isDefault: false,
  visibility: 'private',
  tags: [],
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  ...overrides,
});

export const createCardBatch = (count: number, overrides: Partial<Card> = {}): Card[] =>
  Array.from({ length: count }, (_, i) =>
    createCard({
      player: `Player ${i + 1}`,
      cardNumber: String(i + 1),
      purchasePrice: 10 + i * 5,
      currentValue: 15 + i * 7,
      ...overrides,
    })
  );

export const createPortfolio = (): Card[] => [
  // Baseball cards
  createCard({ category: 'Baseball', player: 'Mike Trout', purchasePrice: 50, currentValue: 100, year: 2020, brand: 'Topps', team: 'Angels', condition: 'RAW' }),
  createCard({ category: 'Baseball', player: 'Shohei Ohtani', purchasePrice: 100, currentValue: 250, year: 2021, brand: 'Bowman', team: 'Angels', condition: '10: GEM MINT', gradingCompany: 'PSA' }),
  // Basketball
  createCard({ category: 'Basketball', player: 'LeBron James', purchasePrice: 200, currentValue: 150, year: 2019, brand: 'Panini', team: 'Lakers', condition: '9: MINT', gradingCompany: 'PSA' }),
  // Football
  createCard({ category: 'Football', player: 'Patrick Mahomes', purchasePrice: 75, currentValue: 300, year: 2022, brand: 'Panini', team: 'Chiefs', condition: 'RAW' }),
  // Sold card
  createSoldCard({ category: 'Baseball', player: 'Aaron Judge', purchasePrice: 30, currentValue: 80, sellPrice: 90, sellDate: new Date('2024-06-01'), year: 2023, brand: 'Topps', team: 'Yankees' }),
  // Low value card
  createCard({ category: 'Baseball', player: 'Test Player', purchasePrice: 2, currentValue: 1, year: 2023, brand: 'Topps', team: 'Mets', condition: 'RAW' }),
];

export const resetCounter = () => { counter = 0; };
