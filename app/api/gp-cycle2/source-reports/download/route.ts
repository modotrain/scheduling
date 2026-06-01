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
      return new Response("Missing sourceId parameter", { status: 400 });
    }

    const sourceId = parseInt(sourceIdStr, 10);
    if (isNaN(sourceId)) {
      return new Response("Invalid sourceId", { status: 400 });
    }

    // Query the source report
    const report = await db
      .select()
      .from(gpCycle2SourceReports)
      .where(and(
        eq(gpCycle2SourceReports.dataset, dataset),
        eq(gpCycle2SourceReports.sourceId, sourceId),
      ))
      .limit(1);

    if (report.length === 0) {
      return new Response("Source report not found", { status: 404 });
    }

    const row = report[0];
    const summaryText = row.summaryText || "";
    const filename = `${sourceId}_${String(row.sourceName || "source").replace(/[^\w\-+.]/g, "_").substring(0, 80)}_schedule.txt`;

    return new Response(summaryText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error downloading source report:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
