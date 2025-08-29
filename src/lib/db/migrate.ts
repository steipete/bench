import { promises as fs } from 'fs';
import path from 'path';
import { sql } from 'kysely';
import { createDb } from './database';
import { env } from '~/env';

async function migrate() {
  console.log('Running migrations...');
  
  const db = createDb(env.DATABASE_URL);
  
  try {
    // Read and execute migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/001_initial_schema.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf-8');
    
    // Execute the migration
    await sql.raw(migrationSql).execute(db);
    
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run if called directly
if (require.main === module) {
  migrate().catch(console.error);
}

export { migrate };