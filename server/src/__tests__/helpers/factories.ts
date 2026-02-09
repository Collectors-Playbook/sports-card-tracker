import { CardInput, UserInput, JobInput } from '../../types';

let counter = 0;

function nextId(): number {
  return ++counter;
}

export function createCardData(overrides: Partial<CardInput> = {}): CardInput {
  const n = nextId();
  return {
    player: `Player ${n}`,
    team: 'Test Team',
    year: 2023,
    brand: 'Topps',
    category: 'Baseball',
    cardNumber: `${n}`,
    condition: 'RAW',
    purchasePrice: 10,
    purchaseDate: '2023-01-15',
    currentValue: 15,
    images: [],
    notes: '',
    ...overrides,
  };
}

export function createUserData(overrides: Partial<UserInput> = {}): UserInput {
  const n = nextId();
  return {
    username: `user${n}`,
    email: `user${n}@test.com`,
    password: 'password123',
    ...overrides,
  };
}

export function createJobData(overrides: Partial<JobInput> = {}): JobInput {
  return {
    type: 'image-processing',
    payload: {},
    ...overrides,
  };
}
