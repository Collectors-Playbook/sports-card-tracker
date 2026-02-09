import { loadConfig } from './config';
import Database from './database';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const config = loadConfig();
  const db = new Database(config.dbPath);
  await db.waitReady();

  const existing = await db.getUserByEmail('fusion94@gmail.com');
  if (existing) {
    console.log('Admin user already exists, skipping.');
    await db.close();
    return;
  }

  const user = await db.createUser({
    username: 'guntharp',
    email: 'fusion94@gmail.com',
    password: 'ppeieij0',
    role: 'admin',
  });

  console.log(`Admin user created: ${user.username} (${user.email}) [${user.id}]`);
  await db.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
