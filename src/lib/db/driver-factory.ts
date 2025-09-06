import { Kysely, sql } from "kysely";
import { NeonDialect, NeonHTTPDialect } from "kysely-neon";
import { PostgresJSDialect } from "kysely-postgres-js";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { env } from "~/env";
import type { Database } from "./database";

export type DriverType = "postgres.js" | "neon-http" | "neon-websocket" | "neon-unpooled" | "planetscale" | "planetscale-unpooled" | "planetscale-metal" | "planetscale-metal-unpooled";

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

async function ensureDatabaseSchema(db: Kysely<Database>, driver: DriverType): Promise<void> {
  // Special handling for neon-http - use direct SQL
  if (driver === "neon-http") {
    try {
      const neonSql = neon(env.DATABASE_URL);
      await neonSql.query("SELECT id FROM users LIMIT 1");
      console.log('✅ Database schema exists and is accessible');
      return;
    } catch (error) {
      console.log('Database schema not found, attempting to create tables...');
      try {
        const neonSql = neon(env.DATABASE_URL);
        
        // Create users table
        await neonSql.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        
        // Create posts table
        await neonSql.query(`
          CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        
        // Create benchmark_results table
        await neonSql.query(`
          CREATE TABLE IF NOT EXISTS benchmark_results (
            id SERIAL PRIMARY KEY,
            driver VARCHAR(50) NOT NULL,
            query_name VARCHAR(100) NOT NULL,
            execution_time_ms REAL NOT NULL,
            sample_count INTEGER NOT NULL,
            median_ms REAL NOT NULL,
            p95_ms REAL NOT NULL,
            p99_ms REAL NOT NULL,
            min_ms REAL NOT NULL,
            max_ms REAL NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `);
        
        // Seed some test data
        await neonSql.query(`
          INSERT INTO users (name, email) VALUES 
          ('Alice Johnson', 'alice@example.com'),
          ('Bob Smith', 'bob@example.com'),
          ('Carol Davis', 'carol@example.com'),
          ('David Wilson', 'david@example.com'),
          ('Eve Brown', 'eve@example.com')
          ON CONFLICT (email) DO NOTHING
        `);
        
        // Add some posts
        await neonSql.query(`
          INSERT INTO posts (user_id, title, content)
          SELECT u.id, 
                 'Post by User ' || u.id || ' - Part ' || s.part, 
                 'Content for post ' || s.part || ' by user ' || u.id
          FROM users u
          CROSS JOIN (VALUES (1), (2)) AS s(part)
          ON CONFLICT DO NOTHING
        `);
        
        console.log('✅ Database schema created and seeded successfully');
        return;
      } catch (schemaError) {
        console.log('⚠️ Could not create schema (may be read-only database), continuing with existing schema...');
        console.log('Schema error:', schemaError);
        return;
      }
    }
  }

  // Standard Kysely execution for all other drivers
  try {
    // Try to query a table - if it fails, create the schema
    await db.selectFrom('users').select('id').limit(1).execute();
    console.log('✅ Database schema exists and is accessible');
  } catch (error) {
    console.log('Database schema not found, attempting to create tables...');
    
    try {
      // Create users table
      await db.schema.createTable('users')
        .ifNotExists()
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
        .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
        .execute();
      
      // Create posts table
      await db.schema.createTable('posts')
        .ifNotExists()
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user_id', 'integer', (col) => col.references('users.id').onDelete('cascade'))
        .addColumn('title', 'varchar(255)', (col) => col.notNull())
        .addColumn('content', 'text')
        .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
        .execute();
      
      // Create benchmark_results table
      await db.schema.createTable('benchmark_results')
        .ifNotExists()
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('driver', 'varchar(50)', (col) => col.notNull())
        .addColumn('query_name', 'varchar(100)', (col) => col.notNull())
        .addColumn('execution_time_ms', 'real', (col) => col.notNull())
        .addColumn('sample_count', 'integer', (col) => col.notNull())
        .addColumn('median_ms', 'real', (col) => col.notNull())
        .addColumn('p95_ms', 'real', (col) => col.notNull())
        .addColumn('p99_ms', 'real', (col) => col.notNull())
        .addColumn('min_ms', 'real', (col) => col.notNull())
        .addColumn('max_ms', 'real', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`NOW()`))
        .execute();
      
      // Seed some test data
      const users = await db.insertInto('users')
        .values([
          { name: 'Alice Johnson', email: 'alice@example.com' },
          { name: 'Bob Smith', email: 'bob@example.com' },
          { name: 'Carol Davis', email: 'carol@example.com' },
          { name: 'David Wilson', email: 'david@example.com' },
          { name: 'Eve Brown', email: 'eve@example.com' },
        ])
        .returning('id')
        .execute();
      
      // Add some posts
      const posts = [];
      for (const user of users) {
        posts.push(
          { user_id: user.id, title: `Post by User ${user.id} - Part 1`, content: `Content for post 1 by user ${user.id}` },
          { user_id: user.id, title: `Post by User ${user.id} - Part 2`, content: `Content for post 2 by user ${user.id}` },
        );
      }
      
      await db.insertInto('posts').values(posts).execute();
      
      console.log('✅ Database schema created and seeded successfully');
    } catch (schemaError) {
      console.log('⚠️ Could not create schema (may be read-only database), continuing with existing schema...');
      console.log('Schema error:', schemaError);
    }
  }
}

export function createKyselyWithDriver(driver: DriverType): Kysely<Database> {
  const poolerUrl = env.DATABASE_URL;

  switch (driver) {
    case "postgres.js": {
      const postgresConnection = postgres(poolerUrl, {
        max: 8,
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

    case "neon-unpooled": {
      if (!env.DIRECT_DATABASE_URL) {
        throw new Error("DIRECT_DATABASE_URL environment variable is required for neon-unpooled driver");
      }

      return new Kysely<Database>({
        dialect: new NeonDialect({
          connectionString: env.DIRECT_DATABASE_URL,
        }),
      });
    }

    case "planetscale": {
      if (!env.PLANETSCALE_DATABASE_URL) {
        throw new Error("PLANETSCALE_DATABASE_URL environment variable is required for planetscale driver");
      }

      const planetscalePooledConnection = postgres(env.PLANETSCALE_DATABASE_URL, {
        max: 8,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      return new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: planetscalePooledConnection,
        }),
      });
    }

    case "planetscale-unpooled": {
      if (!env.PLANETSCALE_DATABASE_URL_UNPOOLED) {
        throw new Error("PLANETSCALE_DATABASE_URL_UNPOOLED environment variable is required for planetscale-unpooled driver");
      }

      const planetscaleUnpooledConnection = postgres(env.PLANETSCALE_DATABASE_URL_UNPOOLED, {
        max: 8,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      return new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: planetscaleUnpooledConnection,
        }),
      });
    }

    case "planetscale-metal": {
      if (!env.PLANETSCALE_METAL_DATABASE_URL) {
        throw new Error("PLANETSCALE_METAL_DATABASE_URL environment variable is required for planetscale-metal driver");
      }

      const planetscaleMetalConnection = postgres(env.PLANETSCALE_METAL_DATABASE_URL, {
        max: 8,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      return new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: planetscaleMetalConnection,
        }),
      });
    }

    case "planetscale-metal-unpooled": {
      if (!env.PLANETSCALE_METAL_DATABASE_URL_UNPOOLED) {
        throw new Error("PLANETSCALE_METAL_DATABASE_URL_UNPOOLED environment variable is required for planetscale-metal-unpooled driver");
      }

      const planetscaleMetalUnpooledConnection = postgres(env.PLANETSCALE_METAL_DATABASE_URL_UNPOOLED, {
        max: 8,
        idle_timeout: 20,
        connect_timeout: 10,
      });

      return new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: planetscaleMetalUnpooledConnection,
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

// Raw SQL strings for neon-http direct execution
export const neonHttpQueries = {
  simple: "SELECT 1 as result",
  timestamp: "SELECT NOW() as current_time",
  countUsers: "SELECT COUNT(*) as count FROM users",
  recentPosts: `
    SELECT id, title, created_at 
    FROM posts 
    ORDER BY created_at DESC 
    LIMIT 10
  `,
  complexJoin: `
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
  aggregation: `
    SELECT 
      DATE_TRUNC('day', created_at) as day,
      COUNT(*) as post_count
    FROM posts
    WHERE created_at >= NOW() - INTERVAL '30 days'
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
  driver?: DriverType,
): Promise<PerformanceTestResult> {
  const times: number[] = new Array(sampleCount);
  const CONCURRENCY = 8;

  // Special handling for neon-http - use direct SQL execution
  if (driver === "neon-http") {
    const neonSql = neon(env.DATABASE_URL);
    const sqlQuery = neonHttpQueries[queryName as keyof typeof neonHttpQueries];
    
    if (!sqlQuery) {
      throw new Error(`No raw SQL query defined for ${queryName} in neon-http`);
    }

    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= sampleCount) break;
        const start = performance.now();
        await neonSql.query(sqlQuery);
        const end = performance.now();
        times[i] = end - start;
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, sampleCount) }, worker);
    await Promise.all(workers);
  } else {
    // Standard Kysely execution for all other drivers
    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= sampleCount) break;
        const start = performance.now();
        await queryFn().execute(db);
        const end = performance.now();
        times[i] = end - start;
      }
    };
    const workers = Array.from({ length: Math.min(CONCURRENCY, sampleCount) }, worker);
    await Promise.all(workers);
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
    console.log(`\n🔍 Testing driver: ${driver}`);
    let db: Kysely<Database> | null = null;
    const driverResults: PerformanceTestResult[] = [];

    try {
      db = createKyselyWithDriver(driver);
      
      // Ensure database schema exists
      await ensureDatabaseSchema(db, driver);
      
      for (const queryName of queriesToRun) {
        if (queryName in standardTestQueries) {
          const queryFn = standardTestQueries[queryName as keyof typeof standardTestQueries];
          const result = await runPerformanceTest(db, queryName, queryFn, sampleCount, driver);
          driverResults.push(result);
        }
      }

      const allMedians = driverResults.map((r) => r.median);
      const allMeans = driverResults.map((r) => r.mean);

      results.push({
        driver,
        results: driverResults,
        totalMedian: allMedians.length ? allMedians.reduce((a, b) => a + b, 0) / allMedians.length : 0,
        totalMean: allMeans.length ? allMeans.reduce((a, b) => a + b, 0) / allMeans.length : 0,
      });
      
      console.log(`✅ ${driver}: ${driverResults.length} queries completed`);
    } catch (error) {
      console.error(`❌ ${driver} failed:`, error);
      // Skip this driver but continue with others
    } finally {
      if (db) {
        await db.destroy();
      }
    }
  }

  return results;
}
