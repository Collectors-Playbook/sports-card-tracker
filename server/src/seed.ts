import { loadConfig } from './config';
import Database from './database';
import dotenv from 'dotenv';

dotenv.config();

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

const seedUsers: SeedUser[] = [
  {
    username: 'guntharp',
    email: 'fusion94@gmail.com',
    password: 'ppeieij0',
    role: 'admin',
  },
  {
    username: 'admin',
    email: 'admin@sportscard.local',
    password: 'admin123',
    role: 'admin',
  },
];

async function seed() {
  const config = loadConfig();
  const db = new Database(config.dbPath);
  await db.waitReady();

  for (const seedUser of seedUsers) {
    const existing = await db.getUserByEmail(seedUser.email);
    if (existing) {
      console.log(`User ${seedUser.email} already exists, skipping.`);
      continue;
    }

    const user = await db.createUser(seedUser);
    console.log(`User created: ${user.username} (${user.email}) [${user.id}]`);
  }

  await db.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
