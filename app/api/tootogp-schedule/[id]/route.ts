import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/src/db/client";
import { tooToGpSchedule } from "@/src/db/schema";

type Params = { params: Promise<{ id: string }> };

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function getTuesdayStart(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  const daysSince = (d.getUTCDay() + 7 - 2) % 7;
  const tue = new Date(d.getTime() - daysSince * 86_400_000);
  return [tue.getUTCFullYear(), String(tue.getUTCMonth() + 1).padStart(2, "0"), String(tue.getUTCDate()).padStart(2, "0")].join("-");
}

function buildGeneratedId(epDbObjectId: string, seqNo: number): string {
  const normalized = epDbObjectId.trim();
  const match = normalized.match(/^EP_ToO_Season-\d+-([^-]+)-([^-]+)$/i);
  if (match) {
    const [, p2, p3] = match;
    return `cycle2-${p2}_${p3}_${seqNo}_ToO`;
  }
  return `${normalized.replace(/^EP_ToO_Season/i, "cycle2")}_${seqNo}_ToO`;
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      plannedStartTime?: string | null;
      plannedEndTime?: string | null;
      notes?: string | null;
      status?: string | null;
      cadenceValue?: number | null;
      cadenceUnit?: string | null;
      reviewedSingleExposureTimeSnapshot?: number | null;
      reviewedTotalExposureTimeSnapshot?: number | null;
    };

    const plannedStartTime = body.plannedStartTime === undefined ? undefined : toDateOnly(body.plannedStartTime);
    const plannedEndTime = body.plannedEndTime === undefined ? undefined : toDateOnly(body.plannedEndTime);

    if (body.plannedStartTime !== undefined && body.plannedStartTime !== null && !plannedStartTime) {
      return NextResponse.json({ error: "Invalid planned start date" }, { status: 400 });
    }
    if (body.plannedEndTime !== undefined && body.plannedEndTime !== null && !plannedEndTime) {
      return NextResponse.json({ error: "Invalid planned end date" }, { status: 400 });
    }

    const updatePayload: Partial<typeof tooToGpSchedule.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.plannedStartTime !== undefined) {
      updatePayload.plannedStartTime = plannedStartTime;
      updatePayload.earliestStartTime = plannedStartTime;
    }
    if (body.plannedEndTime !== undefined) {
      updatePayload.plannedEndTime = plannedEndTime;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes?.trim() ? body.notes.trim() : null;
    }
    if (body.cadenceValue !== undefined) {
      updatePayload.cadenceValue = body.cadenceValue;
    }
    if (body.cadenceUnit !== undefined) {
      updatePayload.cadenceUnit = body.cadenceUnit?.trim() ? body.cadenceUnit : null;
    }
    if (body.reviewedSingleExposureTimeSnapshot !== undefined) {
      updatePayload.reviewedSingleExposureTimeSnapshot = body.reviewedSingleExposureTimeSnapshot;
    }
    if (body.reviewedTotalExposureTimeSnapshot !== undefined) {
      updatePayload.reviewedTotalExposureTimeSnapshot = body.reviewedTotalExposureTimeSnapshot;
    }
    if (body.status !== undefined && body.status !== null) {
      updatePayload.status = body.status;
    }

    // --- Week-change detection: cascade generatedEpDbObjectId to sibling rows ---
    const cascadeUpdates: Array<{ id: number; generatedEpDbObjectId: string }> = [];
    if (body.plannedStartTime !== undefined && plannedStartTime) {
      const [existingRow] = await db
        .select({
          approvedTooId: tooToGpSchedule.approvedTooId,
          parentEpDbObjectId: tooToGpSchedule.parentEpDbObjectId,
          sequenceNo: tooToGpSchedule.sequenceNo,
          plannedStartTime: tooToGpSchedule.plannedStartTime,
        })
        .from(tooToGpSchedule)
        .where(eq(tooToGpSchedule.id, numId))
        .limit(1);

      if (existingRow) {
        const oldWeekStart = getTuesdayStart(existingRow.plannedStartTime);
        const newWeekStart = getTuesdayStart(plannedStartTime);

        if (oldWeekStart && newWeekStart && oldWeekStart !== newWeekStart) {
          const allRows = await db
            .select({
              id: tooToGpSchedule.id,
              sequenceNo: tooToGpSchedule.sequenceNo,
              plannedStartTime: tooToGpSchedule.plannedStartTime,
              generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
            })
            .from(tooToGpSchedule)
            .where(eq(tooToGpSchedule.approvedTooId, existingRow.approvedTooId));

          const siblings = allRows.filter((r) => r.id !== numId);
          const newWeekSiblings = siblings.filter((r) => getTuesdayStart(r.plannedStartTime) === newWeekStart);
          const oldWeekSiblings = siblings.filter((r) => getTuesdayStart(r.plannedStartTime) === oldWeekStart);
          const parentId = existingRow.parentEpDbObjectId;

          // Determine new ID for this row in the target week
          const newAnchor = Math.min(...[...newWeekSiblings.map((r) => r.sequenceNo), existingRow.sequenceNo]);
          const newId = buildGeneratedId(parentId, newAnchor);
          updatePayload.generatedEpDbObjectId = newId;

          // New week: update siblings whose ID no longer matches
          for (const s of newWeekSiblings) {
            if (s.generatedEpDbObjectId !== newId) cascadeUpdates.push({ id: s.id, generatedEpDbObjectId: newId });
          }
          // Old week: re-anchor remaining siblings
          if (oldWeekSiblings.length > 0) {
            const oldAnchor = Math.min(...oldWeekSiblings.map((r) => r.sequenceNo));
            const oldId = buildGeneratedId(parentId, oldAnchor);
            for (const s of oldWeekSiblings) {
              if (s.generatedEpDbObjectId !== oldId) cascadeUpdates.push({ id: s.id, generatedEpDbObjectId: oldId });
            }
          }
        }
      }
    }

    const [updated] = await db
      .update(tooToGpSchedule)
      .set(updatePayload)
      .where(eq(tooToGpSchedule.id, numId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Apply cascade ID updates to sibling rows
    for (const { id: cid, generatedEpDbObjectId: gid } of cascadeUpdates) {
      await db
        .update(tooToGpSchedule)
        .set({ generatedEpDbObjectId: gid, updatedAt: new Date().toISOString() })
        .where(eq(tooToGpSchedule.id, cid));
    }

    return NextResponse.json({ row: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update GP planning record" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const numId = Number.parseInt(id, 10);

  if (Number.isNaN(numId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(tooToGpSchedule)
      .where(eq(tooToGpSchedule.id, numId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch all remaining rows for this approvedTooId and re-number them compactly
    const remaining = await db
      .select({
        id: tooToGpSchedule.id,
        sequenceNo: tooToGpSchedule.sequenceNo,
        plannedStartTime: tooToGpSchedule.plannedStartTime,
        generatedEpDbObjectId: tooToGpSchedule.generatedEpDbObjectId,
      })
      .from(tooToGpSchedule)
      .where(eq(tooToGpSchedule.approvedTooId, deleted.approvedTooId));

    if (remaining.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Sort by existing sequenceNo to preserve relative order
    remaining.sort((a, b) => a.sequenceNo - b.sequenceNo);

    const parentId = deleted.parentEpDbObjectId ?? "";

    // Assign compact 1-based seqNos and compute new week anchors
    const renumbered = remaining.map((row, idx) => ({
      ...row,
      newSeqNo: idx + 1,
      weekStart: getTuesdayStart(row.plannedStartTime),
    }));

    // Min newSeqNo per week group = new anchor for generatedEpDbObjectId
    const weekAnchorMap = new Map<string, number>();
    for (const r of renumbered) {
      if (r.weekStart) {
        const cur = weekAnchorMap.get(r.weekStart);
        if (cur === undefined || r.newSeqNo < cur) weekAnchorMap.set(r.weekStart, r.newSeqNo);
      }
    }

    // Update rows that need changes (ascending order avoids unique-constraint conflicts)
    for (const r of renumbered) {
      const anchor = r.weekStart ? (weekAnchorMap.get(r.weekStart) ?? r.newSeqNo) : r.newSeqNo;
      const newGeneratedId = buildGeneratedId(parentId, anchor);
      const seqChanged = r.newSeqNo !== r.sequenceNo;
      const idChanged = r.generatedEpDbObjectId !== newGeneratedId;

      if (seqChanged || idChanged) {
        await db
          .update(tooToGpSchedule)
          .set({
            ...(seqChanged ? { sequenceNo: r.newSeqNo } : {}),
            ...(idChanged ? { generatedEpDbObjectId: newGeneratedId } : {}),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tooToGpSchedule.id, r.id));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete GP planning record" },
      { status: 500 },
    );
  }
}