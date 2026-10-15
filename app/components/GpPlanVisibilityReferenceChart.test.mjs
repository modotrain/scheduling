import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as Astronomy from "astronomy-engine";
import ts from "typescript";

const require = createRequire(import.meta.url);
const filename = new URL("./GpPlanVisibilityReferenceChart.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function loadVisibility(engine) {
  const compiledModule = { exports: {} };
  runInNewContext(compiled, {
    Date,
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name) => {
      if (name === "astronomy-engine") return engine;
      if (name === "@/app/lib/week-utils") return { getCycleWeekLabel: () => "W43" };
      return require(name);
    },
  }, { filename: filename.pathname });
  return compiledModule.exports.evaluateGpVisibility;
}

const evaluateControlled = loadVisibility({
  Body: { Sun: "Sun", Moon: "Moon" },
  GeoVector: (body, date) => ({
    x: body === "Sun" || date.toISOString().slice(0, 10) !== "2026-10-23" ? -1 : 1,
    y: 0,
    z: 0,
  }),
});

function evaluate(evaluator, start, end, sourceRa = "0", sourceDec = "0") {
  return evaluator({
    sourceRa,
    sourceDec,
    plannedStart: start,
    plannedEnd: end,
    visitPreviews: [{ visitNo: 1, start, end, weekId: "W43" }],
  });
}

test("a blocked midpoint does not reject a window with two visible ranges", () => {
  for (const start of ["2026-10-20", "2026-10-21"]) {
    const result = evaluate(evaluateControlled, start, "2026-10-27");
    assert.equal(result.blockedVisits.length, 0);
    assert.equal(result.visitPreviews[0].visible, true);
    assert.deepEqual(JSON.parse(JSON.stringify(result.visibleRanges)), [
      { start, end: "2026-10-22" },
      { start: "2026-10-24", end: "2026-10-27" },
    ]);
  }
});

test("windows with no visible segment remain blocked", () => {
  for (const [start, end] of [
    ["2026-10-22", "2026-10-24"],
    ["2026-10-22", "2026-10-23"],
    ["2026-10-23", "2026-10-24"],
  ]) {
    assert.equal(evaluate(evaluateControlled, start, end).blockedVisits.length, 1);
  }
});

test("one-day visible windows are schedulable at either side of the blockage", () => {
  for (const [start, end] of [
    ["2026-10-21", "2026-10-22"],
    ["2026-10-24", "2026-10-25"],
  ]) {
    assert.equal(evaluate(evaluateControlled, start, end).blockedVisits.length, 0);
  }
});

test("touching a visible range at an exclusive boundary is not overlap", () => {
  const result = evaluateControlled({
    sourceRa: "0",
    sourceDec: "0",
    plannedStart: "2026-10-20",
    plannedEnd: "2026-10-27",
    visitPreviews: [
      { visitNo: 1, start: "2026-10-22", end: "2026-10-24", weekId: "W43" },
      { visitNo: 2, start: "2026-10-24", end: "2026-10-25", weekId: "W43" },
    ],
  });
  assert.deepEqual(Array.from(result.blockedVisits, (visit) => visit.visitNo), [1]);
});

test("real October 2026 ephemeris gives consistent daily geometry across ranges", () => {
  const evaluateReal = loadVisibility(Astronomy);
  const moon = Astronomy.GeoVector(Astronomy.Body.Moon, new Date("2026-10-23T00:00:00Z"), true);
  const sourceRa = String((Math.atan2(moon.y, moon.x) * 180 / Math.PI + 360) % 360);
  const sourceDec = String(Math.asin(moon.z / Math.hypot(moon.x, moon.y, moon.z)) * 180 / Math.PI);
  const full = evaluate(evaluateReal, "2026-10-20", "2026-10-27", sourceRa, sourceDec);
  const narrow = evaluate(evaluateReal, "2026-10-21", "2026-10-27", sourceRa, sourceDec);
  assert.equal(full.blockedVisits.length, 0);
  assert.equal(narrow.blockedVisits.length, 0);
  assert.equal(full.visibleRanges.length, 2);
  for (const day of narrow.daySeries) {
    const sameDay = full.daySeries.find((sample) => sample.date === day.date);
    assert.equal(day.visible, sameDay.visible);
    assert.equal(day.sunAngle, sameDay.sunAngle);
    assert.equal(day.moonAngle, sameDay.moonAngle);
  }
});