import type { NextApiRequest, NextApiResponse } from "next";
import { neon } from '@neondatabase/serverless';
import { env } from "~/env";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const sql = neon(env.DATABASE_URL);
    const [result] = await sql`SELECT 1 as healthy`;
    
    res.status(200).json({
      status: "healthy",
      database: result?.healthy === 1,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
}