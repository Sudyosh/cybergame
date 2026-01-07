// MUT Secure Vault - Setup Script
// Initializes the database with schema and seed data

import { initDB, closeDatabase } from '../server/config/database.js';

console.log('='.repeat(60));
console.log('MUT Secure Vault - Database Setup');
console.log('='.repeat(60));

async function setup() {
  try {
    console.log('\nInitializing database...');
    await initDB();
    console.log('\nDatabase initialized successfully!');

    console.log('\nSetup complete. You can now start the server with:');
    console.log('  cd server && npm run dev');

  } catch (error) {
    console.error('\nSetup failed:', error.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

setup();
