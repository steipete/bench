import { Kysely, sql } from 'kysely';
import { NeonDialect, NeonHTTPDialect } from 'kysely-neon';
import { Pool } from '@neondatabase/serverless';
import postgres from 'postgres';
import { PostgresJSDialect } from 'kysely-postgres-js';
import type { Database } from './database';
import { env } from '~/env';

export type DriverType = 'postgres.js' | 'neon-http' | 'neon-websocket';

export interface PerformanceTestResult {
  queryName: string;
  times: number[];
  median: number;
  mean: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  sampleCount: number;
}

export interface DriverComparisonResult {
  driver: DriverType;
  results: PerformanceTestResult[];
  totalMedian: number;
  totalMean: number;
}

export function createKyselyWithDriver(driver: DriverType): Kysely<Database> {
  const poolerUrl = env.DATABASE_URL;
  const directUrl = env.DIRECT_DATABASE_URL || env.DATABASE_URL;

  switch (driver) {
    case 'postgres.js': {
      const postgresConnection = postgres(directUrl, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      
      return new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: postgresConnection,
        }),
      });
    }
    
    case 'neon-http': {
      return new Kysely<Database>({
        dialect: new NeonHTTPDialect({
          connectionString: poolerUrl,
        }),
      });
    }
    
    case 'neon-websocket': {
      const pool = new Pool({
        connectionString: poolerUrl,
        max: 1,
      });
      
      return new Kysely<Database>({
        dialect: new NeonDialect({
          pool,
        }),
      });
    }
    
    default:
      throw new Error(`Unknown driver: ${driver}`);
  }
}

export const standardTestQueries = {
  simple: () => sql`SELECT 1 as result`,
  timestamp: () => sql`SELECT NOW() as current_time`,
  countUsers: () => sql`SELECT COUNT(*) as count FROM users`,
  recentPosts: () => sql`
    SELECT id, title, created_at 
    FROM posts 
    ORDER BY created_at DESC 
    LIMIT 10
  `,
  complexJoin: () => sql`
    SELECT 
      u.id,
      u.name,
      u.email,
      COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    GROUP BY u.id, u.name, u.email
    HAVING COUNT(p.id) > 0
    ORDER BY post_count DESC
    LIMIT 5
  `,
  aggregation: () => sql`
    SELECT 
      DATE_TRUNC('day', created_at) as day,
      COUNT(*) as post_count
    FROM posts
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day DESC
  `,
};

function calculateStats(times: number[]): Omit<PerformanceTestResult, 'queryName' | 'times' | 'sampleCount'> {
  const sorted = [...times].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  
  return {
    median: sorted[Math.floor(sorted.length / 2)] || 0,
    mean: sum / sorted.length || 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
  };
}

export async function runPerformanceTest(
  db: Kysely<Database>,
  queryName: string,
  queryFn: () => any,
  sampleCount: number = 10
): Promise<PerformanceTestResult> {
  const times: number[] = [];
  
  // Warm-up run
  await queryFn().execute(db);
  
  for (let i = 0; i < sampleCount; i++) {
    const start = performance.now();
    await queryFn().execute(db);
    const end = performance.now();
    times.push(end - start);
  }
  
  const stats = calculateStats(times);
  
  return {
    queryName,
    times,
    sampleCount,
    ...stats,
  };
}

export async function compareDrivers(
  drivers: DriverType[],
  queryNames?: string[],
  sampleCount: number = 10
): Promise<DriverComparisonResult[]> {
  const results: DriverComparisonResult[] = [];
  const queriesToRun = queryNames || Object.keys(standardTestQueries);
  
  for (const driver of drivers) {
    const db = createKyselyWithDriver(driver);
    const driverResults: PerformanceTestResult[] = [];
    
    try {
      for (const queryName of queriesToRun) {
        if (queryName in standardTestQueries) {
          const queryFn = standardTestQueries[queryName as keyof typeof standardTestQueries];
          const result = await runPerformanceTest(db, queryName, queryFn, sampleCount);
          driverResults.push(result);
        }
      }
      
      const allMedians = driverResults.map(r => r.median);
      const allMeans = driverResults.map(r => r.mean);
      
      results.push({
        driver,
        results: driverResults,
        totalMedian: allMedians.reduce((a, b) => a + b, 0) / allMedians.length,
        totalMean: allMeans.reduce((a, b) => a + b, 0) / allMeans.length,
      });
    } finally {
      await db.destroy();
    }
  }
  
  return results;
}