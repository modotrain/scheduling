import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const filename = new URL("./page.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderTable(rows, { mode = "visit", search = "", sort = { col: null, dir: "asc" } } = {}) {
  const states = [rows, true, "", search, "", "", sort];
  const compiledModule = { exports: {} };
  runInNewContext(compiled, {
    Date,
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name) => {
      if (name === "react") return {
        useState: () => [states.shift(), () => {}],
        useCallback: (callback) => callback,
        useEffect: () => {},
        useMemo: (callback) => callback(),
        useSyncExternalStore: (_subscribe, _snapshot, serverSnapshot) =>
          serverSnapshot() === "visit" ? mode : "all",
      };
      if (name === "next/link") return { __esModule: true, default: "a" };
      if (name === "@/app/lib/cycles") return { ACTIVE_CYCLE: 3 };
      if (name === "@/app/lib/week-utils") return { getWeekKey: () => "C3-W01" };
      return require(name);
    },
  }, { filename: filename.pathname });
  const markup = renderToStaticMarkup(compiledModule.exports.default());
  const body = markup.match(/<tbody>(.*?)<\/tbody>/s)[1];
  return Array.from(body.matchAll(/<tr\b[^>]*>(.*?)<\/tr>/gs), ([, row]) =>
    Array.from(row.matchAll(/<td\b[^>]*>(.*?)<\/td>/gs), ([, cell]) => cell.replace(/<[^>]*>/g, "")),
  );
}

function makeRow(id, single, visits, total = 99999) {
  return {
    id,
    approvedTooId: id,
    generatedEpDbObjectId: "source-1",
    reviewedSingleExposureTimeSnapshot: single,
    reviewedNumberOfVisitsSnapshot: visits,
    reviewedTotalExposureTimeSnapshot: total,
    scheduledStatus: "queued",
    plannedStartTime: null,
    weekId: null,
  };
}

test("visit totals use current Single Exp times Visits instead of the stored total", () => {
  for (const single of [120, 250.5]) {
    const [cells] = renderTable([makeRow(1, single, 3)]);
    assert.equal(cells[5], String(single));
    assert.equal(cells[6], "3");
    assert.equal(cells[7], String(single * 3));
  }
});

test("source totals use the displayed Single Exp and merged Visits", () => {
  const [cells] = renderTable([makeRow(1, 120, 2), makeRow(2, 200, 3)], { mode: "merged" });
  assert.equal(cells[5], "120");
  assert.equal(cells[6], "5");
  assert.equal(cells[7], "600");
});

test("missing factors display a dash while zero factors produce zero", () => {
  for (const [single, visits, expected] of [
    [null, 3, "—"],
    [120, null, "—"],
    [0, 3, "0"],
    [120, 0, "0"],
  ]) {
    assert.equal(renderTable([makeRow(1, single, visits)])[0][7], expected);
  }
});

test("Total sorting and search use computed values", () => {
  const rows = [makeRow(1, 300, 2, 1), makeRow(2, 100, 2, 99999)];
  const sorted = renderTable(rows, { sort: { col: "reviewedTotalExposureTimeSnapshot", dir: "asc" } });
  assert.deepEqual(sorted.map((cells) => cells[1]), ["2", "1"]);
  const matched = renderTable(rows, { search: "600" });
  assert.equal(matched.length, 1);
  assert.equal(matched[0][1], "1");
  assert.equal(renderTable(rows, { search: "99999" })[0][0], "No matching rows.");
});
