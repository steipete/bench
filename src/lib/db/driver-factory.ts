import { Kysely, sql } from "kysely";
import { NeonDialect, NeonHTTPDialect } from "kysely-neon";
import { PlanetScaleDialect } from "kysely-planetscale";
import { PostgresJSDialect } from "kysely-postgres-js";
import mysql from "mysql2/promise";
import postgres from "postgres";
import { env } from "~/env";
import type { Database } from "./database";

export type DriverType = "postgres.js" | "neon-http" | "neon-websocket" | "planetscale" | "planetscale-unpooled";

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

  switch (driver) {
    case "postgres.js": {
      const postgresConnection = postgres(poolerUrl, {
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

    case "neon-http": {
      return new Kysely<Database>({
        dialect: new NeonHTTPDialect({
          connectionString: poolerUrl,
        }),
      });
    }

    case "neon-websocket": {
      return new Kysely<Database>({
        dialect: new NeonDialect({
          connectionString: poolerUrl,
        }),
      });
    }

    case "planetscale": {
      if (!env.PLANETSCALE_DATABASE_URL) {
        throw new Error("PLANETSCALE_DATABASE_URL environment variable is required for planetscale driver");
      }

      return new Kysely<Database>({
        dialect: new PlanetScaleDialect({
          url: env.PLANETSCALE_DATABASE_URL,
        }),
      });
    }

    case "planetscale-unpooled": {
      if (!env.PLANETSCALE_DATABASE_URL_UNPOOLED) {
        throw new Error("PLANETSCALE_DATABASE_URL_UNPOOLED environment variable is required for planetscale-unpooled driver");
      }

      return new Kysely<Database>({
        dialect: new PlanetScaleDialect({
          url: env.PLANETSCALE_DATABASE_URL_UNPOOLED,
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
      DATE(created_at) as day,
      COUNT(*) as post_count
    FROM posts
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY day
    ORDER BY day DESC
  `,
};

function calculateStats(
  times: number[],
): Omit<PerformanceTestResult, "queryName" | "times" | "sampleCount"> {
  const sorted = [...times].sort((a, b) => a - b);

  const quantile = (arr: number[], p: number): number => {
    const n = arr.length;
    if (n === 0) return 0;
    if (p <= 0) return arr[0] ?? 0;
    if (p >= 1) return arr[n - 1] ?? 0;
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const w = idx - lo;
    if (lo === hi) return arr[lo] ?? 0;
    return (arr[lo] ?? 0) * (1 - w) + (arr[hi] ?? 0) * w;
  };

  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    median: quantile(sorted, 0.5),
    mean: sorted.length ? sum / sorted.length : 0,
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
  };
}

export async function runPerformanceTest(
  db: Kysely<Database>,
  queryName: string,
  queryFn: () => any,
  sampleCount: number = 10,
): Promise<PerformanceTestResult> {
  const times: number[] = [];

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
  sampleCount: number = 10,
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

      const allMedians = driverResults.map((r) => r.median);
      const allMeans = driverResults.map((r) => r.mean);

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
