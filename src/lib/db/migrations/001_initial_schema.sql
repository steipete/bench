-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create benchmark_results table
CREATE TABLE IF NOT EXISTS benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver VARCHAR(50) NOT NULL,
  query_name VARCHAR(100) NOT NULL,
  execution_time_ms DECIMAL(10, 3) NOT NULL,
  sample_count INTEGER NOT NULL,
  median_ms DECIMAL(10, 3) NOT NULL,
  p95_ms DECIMAL(10, 3) NOT NULL,
  p99_ms DECIMAL(10, 3) NOT NULL,
  min_ms DECIMAL(10, 3) NOT NULL,
  max_ms DECIMAL(10, 3) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_benchmark_results_created_at ON benchmark_results(created_at DESC);
CREATE INDEX idx_benchmark_results_driver_query ON benchmark_results(driver, query_name);

-- Insert sample data for benchmarking
INSERT INTO users (email, name) VALUES 
  ('alice@example.com', 'Alice Johnson'),
  ('bob@example.com', 'Bob Smith'),
  ('charlie@example.com', 'Charlie Brown'),
  ('diana@example.com', 'Diana Prince'),
  ('eve@example.com', 'Eve Adams')
ON CONFLICT (email) DO NOTHING;

-- Insert sample posts
INSERT INTO posts (title, content, user_id)
SELECT 
  'Post ' || generate_series,
  'This is the content for post ' || generate_series || '. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  (SELECT id FROM users ORDER BY RANDOM() LIMIT 1)
FROM generate_series(1, 20)
ON CONFLICT DO NOTHING;