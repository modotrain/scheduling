import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { drizzle } from "drizzle-orm/pg-proxy";
import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import ts from "typescript";

const require = createRequire(import.meta.url);
const approvedToO = pgTable("approved_too", {
  id: serial().primaryKey(),
  proposalId: varchar("proposal_id"),
  sourceId: varchar("source_id"),
});
const params = { params: Promise.resolve({ proposalId: "proposal-1", sourceId: "source-1" }) };

function loadModule(relativePath, rows, error) {
  const filename = new URL(relativePath, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const db = drizzle(async (sql, values) => {
    assert.match(sql, /where \("approved_too"\."proposal_id" = \$1 and "approved_too"\."source_id" = \$2\)/);
    assert.match(sql, /order by "approved_too"\."id" desc limit \$3/);
    assert.deepEqual(values, ["proposal-1", "source-1", 1]);
    if (error) throw error;
    const latest = rows
      .filter((row) => row.proposalId === values[0] && row.sourceId === values[1])
      .sort((a, b) => b.id - a.id)[0];
    return {
      rows: latest
        ? [sql.startsWith('select "id",') ? [latest.id, latest.proposalId, latest.sourceId] : [latest.id]]
        : [],
    };
  });
  const compiledModule = { exports: {} };
  runInNewContext(compiled, {
    Error,
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name) => {
      if (name === "@/src/db/client") return { db };
      if (name === "@/src/db/schema") return { approvedToO };
      if (name === "next/server") return { NextResponse: { json: Response.json } };
      if (name === "next/navigation") return { redirect: (url) => { throw new Error(url); } };
      return require(name);
    },
  }, { filename: filename.pathname });
  return compiledModule.exports;
}

const redirectPage = "../../../../../too-management/proposal/[proposalId]/[sourceId]/page.tsx";
const rows = [
  { id: 3, proposalId: "proposal-1", sourceId: "source-1" },
  { id: 9, proposalId: "proposal-1", sourceId: "source-1" },
  { id: 5, proposalId: "proposal-1", sourceId: "source-1" },
  { id: 20, proposalId: "proposal-2", sourceId: "source-1" },
  { id: 21, proposalId: "proposal-1", sourceId: "source-2" },
];

test("API returns the latest matching record and preserves its response shape", async () => {
  const { GET } = loadModule("./route.ts", rows);
  const response = await GET(new Request("http://localhost"), params);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { row: rows[1] });
});

test("proposal link redirects to the latest matching record", async () => {
  const page = loadModule(redirectPage, rows).default;
  await assert.rejects(page(params), { message: "/too-management/9" });
});

test("missing records preserve API 404 and the management redirect", async () => {
  const { GET } = loadModule("./route.ts", []);
  const response = await GET(new Request("http://localhost"), params);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
  await assert.rejects(loadModule(redirectPage, []).default(params), { message: "/too-management" });
});

test("database failures remain explicit", async () => {
  const error = new Error("Database unavailable");
  const { GET } = loadModule("./route.ts", [], error);
  const response = await GET(new Request("http://localhost"), params);
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /Failed query/);
  await assert.rejects(loadModule(redirectPage, [], error).default(params), (err) => err.cause === error);
});
