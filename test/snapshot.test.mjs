import assert from "node:assert/strict";
import test from "node:test";
import { mergeIndicators } from "../scripts/lib/snapshot.mjs";

const definition = {
  id: "output",
  name: "Output",
  pillar: "industry",
  frequency: "Monthly",
  direction: "higher",
  noise: 0.5,
  decimals: 1,
  suffix: "",
  source: { name: "Test source", url: "https://example.test" },
};
const countries = [{ code: "DE", shortLabel: "DE" }];

test("failed refresh keeps the last good indicator and marks it stale", () => {
  const prior = {
    id: "output",
    name: "Output",
    germany: { value: 99, period: "2026-05", state: "mixed" },
  };
  const merged = mergeIndicators(
    [definition],
    [{ status: "rejected", reason: new Error("source timeout") }],
    [prior],
    countries,
    "eu",
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].germany.value, 99);
  assert.equal(merged[0].stale, true);
  assert.match(merged[0].staleReason, /timeout/);
});

test("successful refresh replaces the old observation", () => {
  const merged = mergeIndicators(
    [definition],
    [{
      status: "fulfilled",
      value: {
        observations: [
          { country: "DE", period: "2025-06", value: 97 },
          { country: "DE", period: "2026-06", value: 101 },
        ],
        requestUrl: "https://example.test/data",
      },
    }],
    [{ id: "output", germany: { value: 99 } }],
    countries,
    "eu",
  );
  assert.equal(merged[0].germany.value, 101);
  assert.equal(merged[0].germany.state, "improving");
  assert.equal(merged[0].stale, undefined);
});
