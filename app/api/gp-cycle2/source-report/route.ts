import { db } from "@/src/db";
import { getCycleTables } from "@/src/db/cycle-tables";
import { resolveCycleFromRequest } from "@/app/lib/cycles";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const gpCycle2SourceReports = getCycleTables(resolveCycleFromRequest(request)).sourceReports;
    const url = new URL(request.url);
    const sourceIdStr = url.searchParams.get("sourceId");
    const dataset = (url.searchParams.get("dataset") || "cycle2").toLowerCase() === "gf" ? "gf" : "cycle2";

    if (!sourceIdStr) {
      return new Response(
        JSON.stringify({ error: "Missing sourceId parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sourceId = parseInt(sourceIdStr, 10);
    if (isNaN(sourceId)) {
      return new Response(
        JSON.stringify({ error: "Invalid sourceId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Query the source report from database
    const report = await db
      .select()
      .from(gpCycle2SourceReports)
      .where(and(
        eq(gpCycle2SourceReports.dataset, dataset),
        eq(gpCycle2SourceReports.sourceId, sourceId),
      ))
      .limit(1);

    if (report.length === 0) {
      return new Response(
        JSON.stringify({ error: "Source report not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const row = report[0];

    return new Response(
      JSON.stringify({
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        metadata: {
          proposalId: row.proposalId,
          proposalNo: row.proposalNo,
          pi: row.pi,
          userGroup: row.userGroup,
          obsType: row.obsType,
          priority: row.priority,
          ra: row.ra,
          dec: row.dec,
        },
        scheduling: {
          requiredExposureS: row.requiredExposureS,
          requiredVisits: row.requiredVisits,
          perVisitMinS: row.perVisitMinS,
          perVisitMaxS: row.perVisitMaxS,
          scheduledExposureS: row.scheduledExposureS,
          scheduledVisits: row.scheduledVisits,
          exposureRatio: row.exposureRatio,
        },
        chartData: row.chartData,
        summaryText: row.summaryText,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // 1 hour
        },
      }
    );
  } catch (error) {
    console.error("Error fetching source report:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
