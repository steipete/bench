import React from "react";
import type { DriverComparisonResult } from "~/lib/db/driver-factory";

interface BenchmarkChartProps {
  results: DriverComparisonResult[];
  loading?: boolean;
}

export function BenchmarkChart({ results, loading }: BenchmarkChartProps) {
  if (loading) {
    return (
      <div className="bg-white border border-zinc-200 p-12">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-4">
            <div className="w-8 h-8 border-2 border-zinc-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Processing Benchmark</p>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 p-12">
        <div className="text-center">
          <p className="text-sm text-zinc-500 font-light">No benchmark data available</p>
          <p className="text-xs text-zinc-400 mt-2">
            Execute benchmark to view performance metrics
          </p>
        </div>
      </div>
    );
  }

  // Find the fastest driver for each query
  const queryWinners: Record<string, string> = {};
  const allQueries = [...new Set(results.flatMap((r) => r.results.map((q) => q.queryName)))];

  allQueries.forEach((queryName) => {
    let fastestDriver = "";
    let fastestTime = Infinity;

    results.forEach((driverResult) => {
      const queryResult = driverResult.results.find((r) => r.queryName === queryName);
      if (queryResult && queryResult.median < fastestTime) {
        fastestTime = queryResult.median;
        fastestDriver = driverResult.driver;
      }
    });

    queryWinners[queryName] = fastestDriver;
  });

  // Find overall winner
  const overallWinner = results.reduce((prev, curr) =>
    curr.totalMedian < prev.totalMedian ? curr : prev,
  ).driver;

  // Get max value for scale
  const maxMedian = Math.max(...results.map((r) => r.totalMedian));

  return (
    <div className="space-y-6">
      {/* Overall Performance */}
      <div className="bg-white border border-zinc-200 p-6">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-6">Overall Performance</h3>
        <div className="space-y-4">
          {results.map((driverResult) => {
            const firstResult = results[0];
            const percentage = firstResult ? (driverResult.totalMedian / maxMedian) * 100 : 100;
            const isWinner = driverResult.driver === overallWinner;

            return (
              <div key={driverResult.driver}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-light">{driverResult.driver}</span>
                    {isWinner && (
                      <span className="text-xs uppercase tracking-wider bg-zinc-900 text-white px-2 py-0.5">
                        Fastest
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-zinc-700">
                    {driverResult.totalMedian.toFixed(2)}ms
                  </span>
                </div>
                <div className="h-6 bg-zinc-100 relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isWinner ? "bg-zinc-900" : "bg-zinc-400"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Query Details */}
      <div className="bg-white border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500">
            Query Performance Matrix
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="px-6 py-3 text-left">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Query</span>
                </th>
                {results.map((r) => (
                  <th key={r.driver} className="px-6 py-3 text-right">
                    <span className="text-xs uppercase tracking-wider text-zinc-500">
                      {r.driver}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allQueries.map((queryName, idx) => (
                <tr key={queryName} className={idx % 2 === 0 ? "bg-zinc-50" : ""}>
                  <td className="px-6 py-3">
                    <span className="text-sm font-light">{queryName}</span>
                  </td>
                  {results.map((driverResult) => {
                    const queryResult = driverResult.results.find((r) => r.queryName === queryName);
                    const isWinner = queryWinners[queryName] === driverResult.driver;

                    return (
                      <td key={driverResult.driver} className="px-6 py-3 text-right">
                        {queryResult ? (
                          <div>
                            <span
                              className={`text-sm ${isWinner ? "font-medium" : "font-light text-zinc-600"}`}
                            >
                              {queryResult.median.toFixed(2)}
                            </span>
                            <span className="text-xs text-zinc-400 ml-1">ms</span>
                            {isWinner && (
                              <div className="text-xs text-zinc-500 mt-1">
                                p95: {queryResult.p95.toFixed(2)}ms
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistics */}
      <div className="bg-white border border-zinc-200 p-6">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-6">Statistical Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {results.map((driverResult) => {
            const isWinner = driverResult.driver === overallWinner;
            return (
              <div
                key={driverResult.driver}
                className={`p-4 ${isWinner ? "bg-zinc-900 text-white" : "bg-zinc-50"}`}
              >
                <h4
                  className={`text-xs uppercase tracking-wider mb-4 ${isWinner ? "text-zinc-300" : "text-zinc-500"}`}
                >
                  {driverResult.driver}
                </h4>
                <dl className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <dt className={`text-xs ${isWinner ? "text-zinc-400" : "text-zinc-500"}`}>
                      Median
                    </dt>
                    <dd className="text-sm font-medium">{driverResult.totalMedian.toFixed(2)}ms</dd>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <dt className={`text-xs ${isWinner ? "text-zinc-400" : "text-zinc-500"}`}>
                      Mean
                    </dt>
                    <dd className="text-sm font-medium">{driverResult.totalMean.toFixed(2)}ms</dd>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <dt className={`text-xs ${isWinner ? "text-zinc-400" : "text-zinc-500"}`}>
                      Queries
                    </dt>
                    <dd className="text-sm font-medium">{driverResult.results.length}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
