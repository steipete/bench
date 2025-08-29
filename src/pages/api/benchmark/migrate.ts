import { promises as fs } from "node:fs";
import path from "node:path";
import { sql } from "kysely";
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/lib/db/database";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read migration file
    const migrationPath = path.join(process.cwd(), "src/lib/db/migrations/001_initial_schema.sql");
    const migrationSql = await fs.readFile(migrationPath, "utf-8");

    // Execute the migration - use db.executeQuery with raw SQL
    await db.executeQuery(sql.raw(migrationSql).compile(db));

    res.status(200).json({
      success: true,
      message: "Database migration completed successfully",
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({
      error: "Failed to run migration",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
