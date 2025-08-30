import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '~/env';

// Enable fetching for serverless environments
neonConfig.fetchConnectionCache = true;

// Create a SQL query function using the Neon serverless driver
export const sql = neon(env.DATABASE_URL);

// For direct connections (bypassing pooler)
export const directSql = neon(env.DIRECT_DATABASE_URL || env.DATABASE_URL);