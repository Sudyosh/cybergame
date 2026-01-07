// MUT Secure Vault - Reset Script
// Resets the database to initial state

import { resetDatabase, closeDatabase } from '../server/config/database.js';

console.log('='.repeat(60));
console.log('MUT Secure Vault - Database Reset');
console.log('='.repeat(60));

console.log('\nWARNING: This will delete all player data and sessions!');

async function reset() {
  try {
    console.log('\nResetting database...');
    await resetDatabase();
    console.log('\nDatabase reset successfully!');

    console.log('\nAll data cleared. Fresh start ready.');

  } catch (error) {
    console.error('\nReset failed:', error.message);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

reset();
