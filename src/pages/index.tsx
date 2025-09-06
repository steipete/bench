import Head from "next/head";
import { useState } from "react";
import { BenchmarkChart } from "~/components/BenchmarkChart";
import { ThemeToggle } from "~/components/ThemeToggle";
import type { DriverComparisonResult } from "~/lib/db/driver-factory";

interface BenchmarkResponse {
  results: DriverComparisonResult[];
  metadata: {
    sampleCount: number;
    queries: string[];
    timestamp: string;
  };
}

interface ErrorDetails {
  message: string;
  details?: string;
  timestamp: string;
}

export default function Home() {
  const [benchmarkResults, setBenchmarkResults] = useState<DriverComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [sampleCount, setSampleCount] = useState(10);
  const [selectedQueries, setSelectedQueries] = useState({
    simple: true,
    timestamp: true,
    countUsers: true,
    recentPosts: true,
    complexJoin: true,
    aggregation: true,
  });
  const [selectedDrivers, setSelectedDrivers] = useState({
    "postgres.js": true,
    "neon-http": true,
    "neon-websocket": true,
    "planetscale": true,
    "planetscale-unpooled": true,
  });

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const drivers = Object.entries(selectedDrivers)
        .filter(([_, enabled]) => enabled)
        .map(([driver]) => driver);

      if (drivers.length === 0) {
        throw new Error("Please select at least one driver to benchmark");
      }

      const response = await fetch("/api/benchmark/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drivers,
          sampleCount,
          queries: Object.entries(selectedQueries)
            .filter(([_, enabled]) => enabled)
            .map(([name]) => name),
        }),
      });

      const data: BenchmarkResponse | { error?: string; details?: string } = await response.json();

      if (!response.ok) {
        const errorData = data as { error?: string; details?: string };
        throw new Error(errorData.error || errorData.details || "Benchmark failed");
      }

      setBenchmarkResults((data as BenchmarkResponse).results);
    } catch (err) {
      setError({
        message: "Failed to run benchmark comparison",
        details: err instanceof Error ? err.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Database Driver Benchmark</title>
        <meta name="description" content="High-performance database driver comparison" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <header className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-lg font-medium mb-1 text-gray-900 dark:text-gray-100">DATABASE/BENCHMARK</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Performance comparison: postgres.js × neon × planetscale
              </p>
            </div>
            <ThemeToggle />
          </header>

          {/* Control Panel */}
          <div className="mb-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 transition-colors">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-900 dark:text-gray-100 mb-6">Configuration</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Driver Selection */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-3">Drivers</p>
            <div className="space-y-3">
                  {Object.entries(selectedDrivers).map(([driver, enabled]) => (
                    <label key={driver} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          setSelectedDrivers({
                            ...selectedDrivers,
                            [driver]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{driver}</span>
                    </label>
                  ))}
            </div>
          </div>

              {/* Sample Count */}
              <div>
                <label
                  htmlFor="sample-range"
                  className="text-xs font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-3 block"
                >
                  Samples: <span className="text-gray-900 dark:text-gray-100 font-semibold">{sampleCount}</span>
                </label>
                <input
                  id="sample-range"
                  type="range"
                  min="1"
                  max="50"
                  value={sampleCount}
                  onChange={(e) => setSampleCount(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <span>Fast (1)</span>
                  <span>Accurate (50)</span>
                </div>
              </div>

              {/* Query Selection */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-3">Queries</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(selectedQueries).map(([name, enabled]) => (
                    <label key={name} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          setSelectedQueries({
                            ...selectedQueries,
                            [name]: e.target.checked,
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={runBenchmark}
                disabled={loading}
                className="px-4 py-2 bg-black dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "Running Benchmark..." : "EXECUTE BENCHMARK"}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 dark:text-red-300 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">{error.message}</h3>
                  {error.details && (
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error.details}</p>
                  )}
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <BenchmarkChart results={benchmarkResults} loading={loading} />
        </div>
      </main>
    </>
  );
}
