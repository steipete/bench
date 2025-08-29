import { promises as fs } from "fs";
import { sql } from "kysely";
import path from "path";
import { env } from "~/env";
import { createDb } from "./database";

async function migrate() {
  console.log("Running migrations...");

  const db = createDb(env.DATABASE_URL);

  try {
    // Read and execute migration file
    const migrationPath = path.join(process.cwd(), "src/lib/db/migrations/001_initial_schema.sql");
    const migrationSql = await fs.readFile(migrationPath, "utf-8");

    // Execute the migration
    await sql.raw(migrationSql).execute(db);

    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
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
