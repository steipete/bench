import { Kysely } from 'kysely';
import { NeonDialect } from 'kysely-neon';
import { neon } from '@neondatabase/serverless';
import { env } from '~/env';

export interface Database {
  users: {
    id: string;
    email: string;
    name: string | null;
    created_at: Date;
    updated_at: Date;
  };
  posts: {
    id: string;
    title: string;
    content: string | null;
    user_id: string;
    created_at: Date;
    updated_at: Date;
  };
  benchmark_results: {
    id: string;
    driver: string;
    query_name: string;
    execution_time_ms: number;
    sample_count: number;
    median_ms: number;
    p95_ms: number;
    p99_ms: number;
    min_ms: number;
    max_ms: number;
    created_at: Date;
  };
}

export const createDb = (connectionString: string) => {
  return new Kysely<Database>({
    dialect: new NeonDialect({
      connectionString,
    }),
  });
};

export const db = createDb(env.DATABASE_URL);