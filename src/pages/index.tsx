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

export default function Home() {
  const [benchmarkResults, setBenchmarkResults] = useState<DriverComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrated, setMigrated] = useState(false);
  const [sampleCount, setSampleCount] = useState(10);
  const [selectedDrivers, setSelectedDrivers] = useState({
    'postgres.js': true,
    'neon-http': true,
    'neon-websocket': true,
  });

  const runMigration = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/benchmark/migrate', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Migration failed');
      }
      setMigrated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  const runBenchmark = async () => {
    setLoading(true);
    setError(null);
    try {
      const drivers = Object.entries(selectedDrivers)
        .filter(([_, enabled]) => enabled)
        .map(([driver]) => driver);

      if (drivers.length === 0) {
        throw new Error('Please select at least one driver');
      }

      const response = await fetch('/api/benchmark/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drivers,
          sampleCount,
        }),
      });

      const data: BenchmarkResponse = await response.json();
      if (!response.ok) {
        throw new Error((data as any).error || 'Benchmark failed');
      }
      
      setBenchmarkResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Database Driver Benchmark</title>
        <meta name="description" content="Compare database driver performance" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <header className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Database Driver Performance Benchmark
              </h1>
              <p className="text-lg text-gray-600">
                Compare Neon database driver performance: postgres.js vs Neon HTTP vs Neon WebSocket
              </p>
            </header>

            {/* Migration Section */}
            {!migrated && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Database needs to be initialized before running benchmarks.
                    </p>
                    <button
                      onClick={runMigration}
                      disabled={loading}
                      className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      Initialize Database
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Control Panel */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Benchmark Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Driver Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Drivers to Test
                  </label>
                  <div className="space-y-2">
                    {Object.entries(selectedDrivers).map(([driver, enabled]) => (
                      <label key={driver} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setSelectedDrivers({
                            ...selectedDrivers,
                            [driver]: e.target.checked
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-900">{driver}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sample Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sample Count: {sampleCount}
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={sampleCount}
                    onChange={(e) => setSampleCount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>5 (fast)</span>
                    <span>50 (accurate)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={runBenchmark}
                  disabled={loading || !migrated}
                  className="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Running Benchmark...' : 'Run Benchmark'}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Display */}
            <BenchmarkChart results={benchmarkResults} loading={loading} />
          </div>
        </div>
      </main>
    </>
  );
}