import { NextResponse } from "next/server";
import { db } from "@/src/db/client";
import { getCycleTables, CYCLE_TABLE_NAME } from "@/src/db/cycle-tables";
import { resolveCycleFromRequest } from "@/app/lib/cycles";
import { sql } from "drizzle-orm";

function toCamelCaseKey(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function toCamelCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelCaseKey(key), value]),
  );
}

// Whitelist of client-side camelCase sort keys → DB snake_case column names.
// `cycle` is a validated integer so table names are injection-safe; these
// column names are also validated through the whitelist below.
const SORT_COL_DB: Record<string, string> = {
  id: "id",
  sourceName: "source_name",
  sourceId: "source_id",
  proposalNo: "proposal_no",
  pi: "pi",
  obsType: "obs_type",
  totalExposureTime: "total_exposure_time",
  sourcePriority: "source_priority",
};

export async function GET(request: Request) {
  try {
    const cycle = resolveCycleFromRequest(request);
    const gfTable = CYCLE_TABLE_NAME(cycle).gf;

    const url = new URL(request.url);
    const pageRaw = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSizeRaw = parseInt(url.searchParams.get("pageSize") ?? "100", 10);
    const sortColRaw = url.searchParams.get("sortCol") ?? "id";
    const sortDirRaw = url.searchParams.get("sortDir") ?? "desc";
    const q = url.searchParams.get("q")?.trim() ?? "";

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Math.min(500, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 100));
    const offset = (page - 1) * pageSize;

    // Sanitised sort: fall back to "id" if the key isn't in the whitelist.
    const sortColDb = SORT_COL_DB[sortColRaw] ?? "id";
    const sortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

    const searchPattern = q ? `%${q}%` : null;

    // ── Count total matching rows (fast — no heavy joins) ─────────────────
    const countResult = await db.execute(
      searchPattern
        ? sql`
            SELECT COUNT(*) AS total
            FROM ${sql.raw(gfTable)} g
            WHERE (
              g.source_name ILIKE ${searchPattern}
              OR g.pi        ILIKE ${searchPattern}
              OR g.proposal_no ILIKE ${searchPattern}
              OR g.source_id   ILIKE ${searchPattern}
              OR g.obs_type    ILIKE ${searchPattern}
            )
          `
        : sql`SELECT COUNT(*) AS total FROM ${sql.raw(gfTable)}`,
    );
    const countRows = Array.isArray(countResult) ? countResult : countResult.rows;
    const total = Number((countRows[0] as Record<string, unknown>)?.total ?? 0);

    // ── Main query — only join obs data for the requested page ─────────────
    //
    // Strategy: `paged_ids` selects the correct IDs with sort + limit first
    // (touches only the main table — very fast). All subsequent CTEs and the
    // final SELECT join against `paged_ids`, so heavy obs_wp / obslogtest
    // joins are executed for at most `pageSize` sources instead of all rows.
    const result = await db.execute(
      searchPattern
        ? sql`
            WITH
            paged_ids AS (
              SELECT id
              FROM   ${sql.raw(gfTable)} g
              WHERE (
                g.source_name  ILIKE ${searchPattern}
                OR g.pi        ILIKE ${searchPattern}
                OR g.proposal_no ILIKE ${searchPattern}
                OR g.source_id   ILIKE ${searchPattern}
                OR g.obs_type    ILIKE ${searchPattern}
              )
              ORDER BY ${sql.raw(sortColDb)} ${sql.raw(sortDir)} NULLS LAST
              LIMIT  ${pageSize}
              OFFSET ${offset}
            ),
            base AS (
              SELECT g.id, g.source_id, g.visit_number,
                     o.qc, o.start_date, o.end_date, t.valid_secs, t.start_time
              FROM   ${sql.raw(gfTable)} g
              JOIN   paged_ids p ON p.id = g.id
              LEFT JOIN obs_wp o ON g.source_id = o.source_id
              LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
            ),
            ordered AS (
              SELECT id, source_id, visit_number, qc, start_date, end_date, valid_secs, start_time,
                     CASE WHEN LAG(qc) OVER (
                       PARTITION BY source_id, visit_number ORDER BY source_id, start_date
                     ) IS NOT DISTINCT FROM qc THEN 0 ELSE 1 END AS qc_changed
              FROM base
            ),
            segmented AS (
              SELECT id, source_id, visit_number, qc, start_date, end_date, valid_secs, start_time,
                     1 + SUM(qc_changed) OVER (
                       PARTITION BY source_id, visit_number
                       ORDER BY source_id, start_date DESC NULLS LAST
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                     ) - qc_changed AS seg_id
              FROM ordered
            ),
            last_obs AS (
              SELECT source_id, visit_number, COALESCE(SUM(valid_secs), 0) AS last_valid_secs
              FROM   segmented
              WHERE  seg_id = 1
              GROUP BY source_id, visit_number
            ),
            ratios AS (
              SELECT g.id,
                CASE
                  WHEN NULLIF(BTRIM(g.visit_number), '')::numeric > 0
                   AND NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
                  THEN COALESCE(MAX(lo.last_valid_secs), 0)::numeric
                       / (NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                          / NULLIF(NULLIF(BTRIM(g.visit_number), '')::numeric, 0))
                  ELSE 0
                END AS last_valid_nom_ratio,
                CASE
                  WHEN NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
                  THEN COALESCE(SUM(t.valid_secs), 0)::numeric
                       / NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                  ELSE 0
                END AS valid_time_ratio
              FROM   ${sql.raw(gfTable)} g
              JOIN   paged_ids p ON p.id = g.id
              LEFT JOIN obs_wp o ON g.source_id = o.source_id
              LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
              LEFT JOIN last_obs lo ON lo.source_id = g.source_id AND lo.visit_number = g.visit_number
              GROUP BY g.id, g.visit_number, g.total_exposure_time
            )
            SELECT g.*,
                   COALESCE(r.last_valid_nom_ratio, 0) AS last_valid_nom_ratio,
                   COALESCE(r.valid_time_ratio, 0)     AS valid_time_ratio
            FROM   ${sql.raw(gfTable)} g
            JOIN   paged_ids p ON p.id = g.id
            LEFT JOIN ratios r ON r.id = g.id
            ORDER BY ${sql.raw(sortColDb)} ${sql.raw(sortDir)} NULLS LAST
          `
        : sql`
            WITH
            paged_ids AS (
              SELECT id
              FROM   ${sql.raw(gfTable)}
              ORDER BY ${sql.raw(sortColDb)} ${sql.raw(sortDir)} NULLS LAST
              LIMIT  ${pageSize}
              OFFSET ${offset}
            ),
            base AS (
              SELECT g.id, g.source_id, g.visit_number,
                     o.qc, o.start_date, o.end_date, t.valid_secs, t.start_time
              FROM   ${sql.raw(gfTable)} g
              JOIN   paged_ids p ON p.id = g.id
              LEFT JOIN obs_wp o ON g.source_id = o.source_id
              LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
            ),
            ordered AS (
              SELECT id, source_id, visit_number, qc, start_date, end_date, valid_secs, start_time,
                     CASE WHEN LAG(qc) OVER (
                       PARTITION BY source_id, visit_number ORDER BY source_id, start_date
                     ) IS NOT DISTINCT FROM qc THEN 0 ELSE 1 END AS qc_changed
              FROM base
            ),
            segmented AS (
              SELECT id, source_id, visit_number, qc, start_date, end_date, valid_secs, start_time,
                     1 + SUM(qc_changed) OVER (
                       PARTITION BY source_id, visit_number
                       ORDER BY source_id, start_date DESC NULLS LAST
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                     ) - qc_changed AS seg_id
              FROM ordered
            ),
            last_obs AS (
              SELECT source_id, visit_number, COALESCE(SUM(valid_secs), 0) AS last_valid_secs
              FROM   segmented
              WHERE  seg_id = 1
              GROUP BY source_id, visit_number
            ),
            ratios AS (
              SELECT g.id,
                CASE
                  WHEN NULLIF(BTRIM(g.visit_number), '')::numeric > 0
                   AND NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
                  THEN COALESCE(MAX(lo.last_valid_secs), 0)::numeric
                       / (NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                          / NULLIF(NULLIF(BTRIM(g.visit_number), '')::numeric, 0))
                  ELSE 0
                END AS last_valid_nom_ratio,
                CASE
                  WHEN NULLIF(BTRIM(g.total_exposure_time), '')::numeric > 0
                  THEN COALESCE(SUM(t.valid_secs), 0)::numeric
                       / NULLIF(NULLIF(BTRIM(g.total_exposure_time), '')::numeric, 0)
                  ELSE 0
                END AS valid_time_ratio
              FROM   ${sql.raw(gfTable)} g
              JOIN   paged_ids p ON p.id = g.id
              LEFT JOIN obs_wp o ON g.source_id = o.source_id
              LEFT JOIN obslogtest t ON t.obs_id_hex = SUBSTRING(o.obs_id_number, 3)
              LEFT JOIN last_obs lo ON lo.source_id = g.source_id AND lo.visit_number = g.visit_number
              GROUP BY g.id, g.visit_number, g.total_exposure_time
            )
            SELECT g.*,
                   COALESCE(r.last_valid_nom_ratio, 0) AS last_valid_nom_ratio,
                   COALESCE(r.valid_time_ratio, 0)     AS valid_time_ratio
            FROM   ${sql.raw(gfTable)} g
            JOIN   paged_ids p ON p.id = g.id
            LEFT JOIN ratios r ON r.id = g.id
            ORDER BY ${sql.raw(sortColDb)} ${sql.raw(sortDir)} NULLS LAST
          `,
    );

    const rawRows = Array.isArray(result) ? result : result.rows;
    const rows = rawRows.map((row) => toCamelCaseRow(row as Record<string, unknown>));
    return NextResponse.json({ rows, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const cycle = resolveCycleFromRequest(request);
    const cycle2GF = getCycleTables(cycle).gf;
    const body = (await request.json()) as Record<string, string | null>;
    const [inserted] = await db.insert(cycle2GF).values(body).returning();
    return NextResponse.json({ row: inserted }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create" },
      { status: 500 },
    );
  }
}
