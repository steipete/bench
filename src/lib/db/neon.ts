import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from '~/env';

// Enable fetching for serverless environments
neonConfig.fetchConnectionCache = true;

// Create a SQL query function using the Neon serverless driver
export const sql = neon(env.DATABASE_URL);

// All connections should use the pooled connection string
