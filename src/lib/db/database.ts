import { type Generated, Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import { env } from "~/env";

export interface Database {
  users: {
    id: Generated<string>;
    email: string;
    name: string | null;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  posts: {
    id: Generated<string>;
    title: string;
    content: string | null;
    user_id: string;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
  };
  benchmark_results: {
    id: Generated<string>;
    driver: string;
    query_name: string;
    execution_time_ms: number;
    sample_count: number;
    median_ms: number;
    p95_ms: number;
    p99_ms: number;
    min_ms: number;
    max_ms: number;
    created_at: Generated<Date>;
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
