import React from 'react';
import type { DriverComparisonResult } from '~/lib/db/driver-factory';

interface BenchmarkChartProps {
  results: DriverComparisonResult[];
  loading?: boolean;
}

export function BenchmarkChart({ results, loading }: BenchmarkChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Running benchmark...</p>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        No benchmark results available. Click "Run Benchmark" to start.
      </div>
    );
  }

  // Find the fastest driver for each query
  const queryWinners: Record<string, string> = {};
  const allQueries = [...new Set(results.flatMap(r => r.results.map(q => q.queryName)))];
  
  allQueries.forEach(queryName => {
    let fastestDriver = '';
    let fastestTime = Infinity;
    
    results.forEach(driverResult => {
      const queryResult = driverResult.results.find(r => r.queryName === queryName);
      if (queryResult && queryResult.median < fastestTime) {
        fastestTime = queryResult.median;
        fastestDriver = driverResult.driver;
      }
    });
    
    queryWinners[queryName] = fastestDriver;
  });

  // Find overall winner
  const overallWinner = results.reduce((prev, curr) => 
    curr.totalMedian < prev.totalMedian ? curr : prev
  ).driver;

  return (
    <div className="space-y-6">
      {/* Overall Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Overall Performance</h3>
        <div className="space-y-3">
          {results.map(driverResult => {
            const firstResult = results[0];
            const percentage = firstResult ? Math.round((driverResult.totalMedian / firstResult.totalMedian) * 100) : 100;
            const isWinner = driverResult.driver === overallWinner;
            
            return (
              <div key={driverResult.driver} className="flex items-center space-x-4">
                <div className="w-32 font-medium">
                  {driverResult.driver}
                  {isWinner && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Winner
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-6 relative">
                    <div
                      className={`h-6 rounded-full ${
                        isWinner ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium">
                      {driverResult.totalMedian.toFixed(2)}ms
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Query Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Query Performance Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Query
                </th>
                {results.map(r => (
                  <th key={r.driver} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {r.driver}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allQueries.map(queryName => (
                <tr key={queryName}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {queryName}
                  </td>
                  {results.map(driverResult => {
                    const queryResult = driverResult.results.find(r => r.queryName === queryName);
                    const isWinner = queryWinners[queryName] === driverResult.driver;
                    
                    return (
                      <td key={driverResult.driver} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {queryResult ? (
                          <div>
                            <span className={isWinner ? 'font-semibold text-green-600' : ''}>
                              {queryResult.median.toFixed(2)}ms
                            </span>
                            <div className="text-xs text-gray-500">
                              p95: {queryResult.p95.toFixed(2)}ms
                            </div>
                          </div>
                        ) : (
                          '-'
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

      {/* Statistical Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Statistical Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {results.map(driverResult => (
            <div key={driverResult.driver} className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">{driverResult.driver}</h4>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Median:</dt>
                  <dd className="font-medium">{driverResult.totalMedian.toFixed(2)}ms</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Mean:</dt>
                  <dd className="font-medium">{driverResult.totalMean.toFixed(2)}ms</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Queries:</dt>
                  <dd className="font-medium">{driverResult.results.length}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}