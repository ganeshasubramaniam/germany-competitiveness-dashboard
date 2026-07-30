import assert from "node:assert/strict";
import test from "node:test";
import { buildEurostatUrl, parseJsonStat } from "../scripts/lib/eurostat.mjs";

test("parseJsonStat decodes sparse row-major observations", () => {
  const payload = {
    id: ["geo", "time"],
    size: [2, 2],
    dimension: {
      geo: { category: { index: { DE: 0, FR: 1 } } },
      time: { category: { index: { "2024": 0, "2025": 1 } } },
    },
    value: { 0: 1.1, 1: 1.2, 3: 2.2 },
    status: { 3: "p" },
    updated: "2026-07-30",
  };
  assert.deepEqual(parseJsonStat(payload).observations, [
    { geo: "DE", time: "2024", value: 1.1, status: null },
    { geo: "DE", time: "2025", value: 1.2, status: null },
    { geo: "FR", time: "2025", value: 2.2, status: "p" },
  ]);
});

test("buildEurostatUrl repeats geography and pins filters", () => {
  const url = new URL(
    buildEurostatUrl(
      { dataset: "une_rt_m", filters: { sex: "T", unit: "PC_ACT" } },
      ["DE", "FR"],
      2024,
    ),
  );
  assert.deepEqual(url.searchParams.getAll("geo"), ["DE", "FR"]);
  assert.equal(url.searchParams.get("sinceTimePeriod"), "2024");
  assert.equal(url.searchParams.get("sex"), "T");
});
