import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/lib/db/database";
import { compareDrivers, standardTestQueries, type DriverType } from "~/lib/db/driver-factory";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      drivers = ["postgres.js", "neon-http", "neon-websocket"],
      queries,
      sampleCount = 10,
    } = req.method === "POST" ? req.body : req.query;

    // Parse drivers and queries if they come as strings from query params
    const driverList: DriverType[] = Array.isArray(drivers)
      ? drivers
      : typeof drivers === "string"
        ? (drivers.split(",") as DriverType[])
        : ["postgres.js", "neon-http", "neon-websocket"];

    const queryList = Array.isArray(queries)
      ? queries
      : typeof queries === "string" && queries
        ? queries.split(",")
        : undefined;

    const samples = Math.min(parseInt(String(sampleCount), 10), 100);

    const results = await compareDrivers(driverList, queryList, samples);

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
    for (const driverResult of results) {
      for (const queryResult of driverResult.results) {
        await db
          .insertInto("benchmark_results")
          .values({
            driver: driverResult.driver,
            query_name: queryResult.queryName,
            execution_time_ms: queryResult.mean,
            sample_count: queryResult.sampleCount,
            median_ms: queryResult.median,
            p95_ms: queryResult.p95,
            p99_ms: queryResult.p99,
            min_ms: queryResult.min,
            max_ms: queryResult.max,
          })
          .execute();
      }
    }

    res.status(200).json({
      results: comparison,
      metadata: {
        sampleCount: samples,
        queries: queryList || Object.keys(standardTestQueries),
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
