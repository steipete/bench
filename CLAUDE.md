# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a database driver benchmark playground built with the T3 Stack, comparing performance between postgres.js, Neon HTTP, and Neon WebSocket drivers. The application provides real-time benchmark visualization using Next.js, TypeScript, Kysely, and Tailwind CSS.

## Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run preview         # Build and start production server

# Code Quality
npm run typecheck       # Run TypeScript type checking
npm run lint           # Check code with Biome
npm run lint:fix       # Auto-fix linting issues with Biome
npm run format         # Format code with Biome
```

## Architecture Overview

### Database Layer
- **Database Schema**: Defined in `src/lib/db/database.ts` with Kysely types for `users`, `posts`, and `benchmark_results` tables
- **Driver Factory**: `src/lib/db/driver-factory.ts` provides driver abstraction for performance testing with three database drivers:
  - `postgres.js`: Direct PostgreSQL connection via postgres.js
  - `neon-http`: Neon HTTP driver for serverless environments
  - `neon-websocket`: Neon WebSocket driver for persistent connections
- **Benchmarking**: `src/lib/db/driver-benchmarks.ts` contains performance testing utilities and standard test queries

### API Architecture
The application uses Next.js API routes in `src/pages/api/`:
- `/api/health` - Health check endpoint
- `/api/benchmark/compare` - Driver comparison endpoint
- `/api/benchmark/migrate` - Database migration endpoint
- `/api/benchmark/seed` - Database seeding endpoint

### Frontend Components
- **BenchmarkChart**: Real-time visualization component for benchmark results
- **ThemeToggle**: Dark/light mode toggle component
- Uses Tailwind CSS v4 with custom configuration in `tailwind.config.ts`

### Environment & Configuration
- **Environment Variables**: Managed through T3's env schema in `src/env.js`
  - `DATABASE_URL`: Neon pooled connection string
  - `DIRECT_DATABASE_URL`: Optional direct PostgreSQL connection
- **Path Aliases**: `~/` maps to `src/` directory
- **Code Quality**: Biome for linting and formatting with strict TypeScript configuration

### Deployment
- Pushing to GitHub automatically triggers a Vercel deployment
- The application is configured for serverless deployment with proper environment variable validation

## Code Style
- Uses Biome for linting and formatting
- TypeScript with strict mode enabled
- 2-space indentation, double quotes, trailing commas
- Line width: 100 characters
- Import type usage enforced for type-only imports

## Database Drivers
The project specifically benchmarks three database connection strategies:
1. **postgres.js**: Traditional PostgreSQL driver with connection pooling
2. **neon-http**: HTTP-based serverless database connections 
3. **neon-websocket**: WebSocket-based connections for lower latency

Each driver is tested against standardized queries including simple selects, timestamps, counts, joins, and aggregations to provide comprehensive performance comparisons.