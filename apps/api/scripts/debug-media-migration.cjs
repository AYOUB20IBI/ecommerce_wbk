
const path = require("node:path");
const { Pool } = require("pg");

const { drizzle } = require("drizzle-orm/node-postgres");

const {
  migrate,
} = require("drizzle-orm/node-postgres/migrator");

require("dotenv").config({
  path: path.resolve(process.cwd(), ".env"),
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const connection = await pool.query(`
      SELECT
        current_database() AS database,
        current_schema() AS schema,
        current_user AS username
    `);

    console.log("Database:", connection.rows[0]);

    const db = drizzle(pool);

    await migrate(db, {
      migrationsFolder: path.resolve(
        process.cwd(),
        "drizzle",
      ),
    });

    console.log("Migrations completed successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nMIGRATION ERROR:");
  console.error(error);

  if (error?.cause) {
    console.error("\nPOSTGRES CAUSE:");
    console.error(error.cause);
  }

  process.exitCode = 1;
});
