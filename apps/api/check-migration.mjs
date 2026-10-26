
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  console.log('Starting migration 0009...');

  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: './drizzle',
  });

  console.log('Migration completed successfully!');
} catch (error) {
  console.error('\n===== MIGRATION ERROR =====');
  console.error(error);

  let cause = error;
  while (cause instanceof Error && cause.cause) {
    cause = cause.cause;
    console.error('\n===== ROOT CAUSE =====');
    console.error(cause);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}
