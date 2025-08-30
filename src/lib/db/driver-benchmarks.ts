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

function getQueriesToRun(queryNames?: string[]): TestQuery[] {
  if (!queryNames || queryNames.length === 0) return testQueries;
  const set = new Set(queryNames);
  return testQueries.filter((q) => set.has(q.name));
}

function calculateStats(times: number[]): Omit<PerformanceTestResult, 'queryName' | 'times' | 'sampleCount'> {
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

  const median = quantile(sorted, 0.5);
  const p95 = quantile(sorted, 0.95);
  const p99 = quantile(sorted, 0.99);
  const mean = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  return { median, mean, p95, p99, min, max };
}

async function runPostgresJSBenchmark(iterations: number, queryNames?: string[]): Promise<PerformanceTestResult[]> {
  // Use pooled connection for postgres.js as well
  const pooledUrl = env.DATABASE_URL;
  const sql = postgres(pooledUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const results: PerformanceTestResult[] = [];

  try {
    for (const query of getQueriesToRun(queryNames)) {
      const times: number[] = [];

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

async function runNeonBenchmark(useHttp: boolean, iterations: number, queryNames?: string[]): Promise<PerformanceTestResult[]> {
  const connectionString = env.DATABASE_URL; // Using pooler for both HTTP and WS

  const results: PerformanceTestResult[] = [];

  if (useHttp) {
    const sql = neon(connectionString);

    for (const query of getQueriesToRun(queryNames)) {
      const times: number[] = [];

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
      for (const query of getQueriesToRun(queryNames)) {
        const times: number[] = [];

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

export async function runBenchmarkComparison(
  drivers: DriverType[] = ["postgres.js", "neon-http", "neon-websocket"],
  sampleCount: number = 20,
  queryNames?: string[],
): Promise<DriverComparisonResult[]> {
  const results: DriverComparisonResult[] = [];

  for (const driver of drivers) {
    if (driver === "postgres.js") {
      const r = await runPostgresJSBenchmark(sampleCount, queryNames);
      results.push({
        driver,
        results: r,
        totalMedian: r.reduce((sum, x) => sum + x.median, 0),
        totalMean: r.reduce((sum, x) => sum + x.mean, 0),
      });
    } else if (driver === "neon-http") {
      const r = await runNeonBenchmark(true, sampleCount, queryNames);
      results.push({
        driver,
        results: r,
        totalMedian: r.reduce((sum, x) => sum + x.median, 0),
        totalMean: r.reduce((sum, x) => sum + x.mean, 0),
      });
    } else if (driver === "neon-websocket") {
      const r = await runNeonBenchmark(false, sampleCount, queryNames);
      results.push({
        driver,
        results: r,
        totalMedian: r.reduce((sum, x) => sum + x.median, 0),
        totalMean: r.reduce((sum, x) => sum + x.mean, 0),
      });
    }
  }

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
