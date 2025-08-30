import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import postgres from 'postgres';
import { env } from '~/env';

export type DriverType = "postgres.js" | "neon-http" | "neon-websocket";

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

interface TestQuery {
  name: string;
  sql: string;
}

const testQueries: TestQuery[] = [
  {
    name: "simple",
    sql: "SELECT 1 as result"
  },
  {
    name: "timestamp",
    sql: "SELECT NOW() as current_time"
  },
  {
    name: "countUsers",
    sql: "SELECT COUNT(*) as count FROM users"
  },
  {
    name: "recentPosts",
    sql: `
      SELECT id, title, created_at 
      FROM posts 
      ORDER BY created_at DESC 
      LIMIT 10
    `
  },
  {
    name: "complexJoin",
    sql: `
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
    `
  },
  {
    name: "aggregation",
    sql: `
      SELECT 
        DATE_TRUNC('day', created_at) as day,
        COUNT(*) as post_count
      FROM posts
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
    `
  }
];

function calculateStats(times: number[]): Omit<PerformanceTestResult, 'queryName' | 'times' | 'sampleCount'> {
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { median, mean, p95, p99, min, max };
}

async function runPostgresJSBenchmark(): Promise<PerformanceTestResult[]> {
  const directUrl = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
  const sql = postgres(directUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const results: PerformanceTestResult[] = [];

  try {
    for (const query of testQueries) {
      const times: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await sql.unsafe(query.sql);
        const end = performance.now();
        times.push(end - start);
      }

      results.push({
        queryName: query.name,
        times,
        sampleCount: iterations,
        ...calculateStats(times),
      });
    }
  } finally {
    await sql.end();
  }

  return results;
}

async function runNeonBenchmark(useHttp: boolean): Promise<PerformanceTestResult[]> {
  const connectionString = env.DATABASE_URL; // Using pooler for both HTTP and WS

  const results: PerformanceTestResult[] = [];

  if (useHttp) {
    const sql = neon(connectionString);

    for (const query of testQueries) {
      const times: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await sql.query(query.sql);
        const end = performance.now();
        times.push(end - start);
      }

      results.push({
        queryName: query.name,
        times,
        sampleCount: iterations,
        ...calculateStats(times),
      });
    }
  } else {
    // Use WebSockets via Pool/Client API per Neon docs
    neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
    const pool = new Pool({ connectionString });

    try {
      for (const query of testQueries) {
        const times: number[] = [];
        const iterations = 20;

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await pool.query(query.sql);
          const end = performance.now();
          times.push(end - start);
        }

        results.push({
          queryName: query.name,
          times,
          sampleCount: iterations,
          ...calculateStats(times),
        });
      }
    } finally {
      await pool.end();
    }
  }

  return results;
}

export async function runBenchmarkComparison(): Promise<DriverComparisonResult[]> {
  const results: DriverComparisonResult[] = [];

  // Run postgres.js benchmark
  const postgresResults = await runPostgresJSBenchmark();
  results.push({
    driver: "postgres.js",
    results: postgresResults,
    totalMedian: postgresResults.reduce((sum, r) => sum + r.median, 0),
    totalMean: postgresResults.reduce((sum, r) => sum + r.mean, 0),
  });

  // Run neon-http benchmark
  const neonHttpResults = await runNeonBenchmark(true);
  results.push({
    driver: "neon-http",
    results: neonHttpResults,
    totalMedian: neonHttpResults.reduce((sum, r) => sum + r.median, 0),
    totalMean: neonHttpResults.reduce((sum, r) => sum + r.mean, 0),
  });

  // Run neon-websocket benchmark
  const neonWsResults = await runNeonBenchmark(false);
  results.push({
    driver: "neon-websocket",
    results: neonWsResults,
    totalMedian: neonWsResults.reduce((sum, r) => sum + r.median, 0),
    totalMean: neonWsResults.reduce((sum, r) => sum + r.mean, 0),
  });

  return results;
}

export async function storeBenchmarkResults(results: DriverComparisonResult[]): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  
  for (const driverResult of results) {
    for (const testResult of driverResult.results) {
      await sql`
        INSERT INTO benchmark_results (
          driver,
          query_name,
          execution_time_ms,
          sample_count,
          median_ms,
          p95_ms,
          p99_ms,
          min_ms,
          max_ms
        ) VALUES (
          ${driverResult.driver},
          ${testResult.queryName},
          ${testResult.mean},
          ${testResult.sampleCount},
          ${testResult.median},
          ${testResult.p95},
          ${testResult.p99},
          ${testResult.min},
          ${testResult.max}
        )
      `;
    }
  }
}
