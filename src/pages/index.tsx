import Head from "next/head";
import { useState } from "react";
import { BenchmarkChart } from "~/components/BenchmarkChart";
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
  const [selectedDrivers, setSelectedDrivers] = useState({
    "postgres.js": true,
    "neon-http": true,
    "neon-websocket": true,
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

      <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Header */}
          <header className="mb-12">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-zinc-900"></div>
              <h1 className="text-2xl font-light tracking-tight">DATABASE/BENCHMARK</h1>
            </div>
            <p className="text-zinc-500 text-sm font-light">
              Performance comparison: postgres.js × neon-http × neon-websocket
            </p>
          </header>

          {/* Control Panel */}
          <div className="mb-8 bg-white border border-zinc-200 p-6">
            <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-6">Configuration</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Driver Selection */}
              <div>
                <p className="block text-xs uppercase tracking-wider text-zinc-600 mb-4">Drivers</p>
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
                        className="w-4 h-4 border-zinc-300 accent-zinc-900"
                      />
                      <span className="text-sm font-light group-hover:text-zinc-600">{driver}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sample Count */}
              <div>
                <label
                  htmlFor="sample-range"
                  className="block text-xs uppercase tracking-wider text-zinc-600 mb-4"
                >
                  Samples: <span className="text-zinc-900 font-medium">{sampleCount}</span>
                </label>
                <input
                  id="sample-range"
                  type="range"
                  min="5"
                  max="50"
                  value={sampleCount}
                  onChange={(e) => setSampleCount(parseInt(e.target.value, 10))}
                  className="w-full accent-zinc-900"
                />
                <div className="flex justify-between text-xs text-zinc-400 mt-2">
                  <span>Fast (5)</span>
                  <span>Accurate (50)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100">
              <button
                type="button"
                onClick={runBenchmark}
                disabled={loading}
                className="px-6 py-3 bg-zinc-900 text-white text-xs uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Running Benchmark..." : "Execute Benchmark"}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div className="w-1.5 h-1.5 bg-red-600"></div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-900 mb-1">{error.message}</h3>
                  {error.details && (
                    <p className="text-xs text-red-700 mb-2 font-light">{error.details}</p>
                  )}
                  <p className="text-xs text-red-600">
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
