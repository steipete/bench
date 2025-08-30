import type { NextApiRequest, NextApiResponse } from "next";
import {
  runBenchmarkComparison,
  storeBenchmarkResults,
} from "~/lib/db/driver-benchmarks";
import type { DriverType } from "~/lib/db/driver-benchmarks";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { drivers, sampleCount } =
      req.method === "POST" && req.body
        ? (typeof req.body === "string" ? JSON.parse(req.body) : req.body)
        : { drivers: undefined, sampleCount: undefined };

    const driverList: DriverType[] = Array.isArray(drivers) && drivers.length
      ? drivers
      : ["postgres.js", "neon-http", "neon-websocket"];

    const count: number = typeof sampleCount === "number" && sampleCount > 0 ? sampleCount : 20;

    const results = await runBenchmarkComparison(driverList, count);

    // Calculate comparison percentages
    const comparison = results.map((driverResult, index) => {
      const otherResults = results.filter((_, i) => i !== index);
      const comparisons = otherResults.map((other) => ({
        driver: other.driver,
        percentageDifference:
          ((driverResult.totalMedian - other.totalMedian) / other.totalMedian) * 100,
      }));

      return {
        ...driverResult,
        comparisons,
      };
    });

    // Store results in database
    await storeBenchmarkResults(results);

    res.status(200).json({
      results: comparison,
      metadata: {
        sampleCount: count,
        queries: results[0]?.results.map(r => r.queryName) ?? [],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Benchmark comparison error:", error);
    res.status(500).json({
      error: "Failed to run benchmark comparison",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
