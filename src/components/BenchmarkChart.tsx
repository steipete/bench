import type { DriverComparisonResult } from "~/lib/db/driver-factory";

interface BenchmarkChartProps {
  results: DriverComparisonResult[];
  loading?: boolean;
}

export function BenchmarkChart({ results, loading }: BenchmarkChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-12 transition-colors">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Running benchmark tests...</p>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-12 transition-colors">
        <div className="text-center">
          <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">No benchmark data available</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Execute benchmark to view performance metrics</p>
        </div>
      </div>
    );
  }

  // Find the fastest driver (lowest median)
  const fastestDriver = results.reduce((prev, current) =>
    prev.totalMedian < current.totalMedian ? prev : current
  );

  // Calculate max time for scaling
  const maxTime = Math.max(...results.flatMap(r => r.results.flatMap(res => res.max)));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((driver) => {
          const isFastest = driver.driver === fastestDriver.driver;
          const percentDiff = ((driver.totalMedian - fastestDriver.totalMedian) / fastestDriver.totalMedian) * 100;
          
          return (
            <div key={driver.driver} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{driver.driver}</h3>
                {isFastest && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                    Fastest
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                <div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {driver.totalMedian.toFixed(2)}ms
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Median response time</p>
                </div>
                
                {!isFastest && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(1)}% vs fastest
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Results */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 transition-colors">
        <h3 className="text-sm font-medium uppercase tracking-wide text-gray-900 dark:text-gray-100 mb-6">
          Query Performance Breakdown
        </h3>
        
        <div className="space-y-6">
          {results[0]?.results.map((queryResult) => {
            const queryName = queryResult.queryName;
            
            return (
              <div key={queryName} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{queryName}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">ms</span>
                </div>
                
                <div className="space-y-2">
                  {results.map((driver) => {
                    const result = driver.results.find(r => r.queryName === queryName);
                    if (!result) return null;
                    
                    const widthPercent = (result.median / maxTime) * 100;
                    const isFastestQuery = Math.min(...results.map(d => 
                      d.results.find(r => r.queryName === queryName)?.median || Infinity
                    )) === result.median;
                    
                    return (
                      <div key={driver.driver} className="flex items-center gap-3">
                        <div className="w-24 text-xs text-gray-600 dark:text-gray-300 truncate">{driver.driver}</div>
                        <div className="flex-1 relative">
                          <div className="bg-gray-100 dark:bg-gray-700 h-6">
                            <div 
                              className={`h-full transition-all ${
                                isFastestQuery ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-400 dark:bg-gray-500'
                              }`}
                              style={{ width: `${Math.max(widthPercent, 2)}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {result.median.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Statistics Table */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium uppercase tracking-wide text-gray-900 dark:text-gray-100 mb-4">
            Detailed Statistics
          </h4>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Mean
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Median
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    P95
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    P99
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Min
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Max
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {results.map((driver) => (
                  <tr key={driver.driver}>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">{driver.driver}</td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {driver.totalMean.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {driver.totalMedian.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {driver.results[0]?.p95.toFixed(2) || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {driver.results[0]?.p99.toFixed(2) || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {Math.min(...driver.results.map(r => r.min)).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                      {Math.max(...driver.results.map(r => r.max)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}