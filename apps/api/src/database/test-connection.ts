
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  try {
    const db = drizzle({ client: pool });

    const result = await db.execute(
      sql`SELECT current_database() AS database_name, NOW() AS server_time`,
    );

    console.log('Neon PostgreSQL connection successful!');
    console.log(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database connection failed:', error);
  process.exitCode = 1;
});
