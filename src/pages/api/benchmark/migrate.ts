import type { NextApiRequest, NextApiResponse } from "next";
import { neon } from '@neondatabase/serverless';
import { env } from "~/env";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Create a new connection for migration
    const sql = neon(env.DATABASE_URL);
    
    // Create tables using template literals
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS benchmark_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver VARCHAR(50) NOT NULL,
        query_name VARCHAR(100) NOT NULL,
        execution_time_ms DECIMAL(10, 3) NOT NULL,
        sample_count INTEGER NOT NULL,
        median_ms DECIMAL(10, 3),
        p95_ms DECIMAL(10, 3),
        p99_ms DECIMAL(10, 3),
        min_ms DECIMAL(10, 3),
        max_ms DECIMAL(10, 3),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_results_driver ON benchmark_results(driver)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_results_created_at ON benchmark_results(created_at DESC)`;

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