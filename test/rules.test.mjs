import assert from "node:assert/strict";
import test from "node:test";
import { buildBrief, buildIndicator } from "../scripts/lib/rules.mjs";

const countries = [
  { code: "DE", shortLabel: "DE" },
  { code: "FR", shortLabel: "FR" },
  { code: "IT", shortLabel: "IT" },
];

const definition = {
  id: "production",
  name: "Industrial production",
  pillar: "industry",
  frequency: "Monthly",
  direction: "higher",
  noise: 1,
  decimals: 1,
  suffix: "",
  source: { name: "Test source", url: "https://example.test" },
};

test("buildIndicator uses year-ago comparison and visible noise band", () => {
  const indicator = buildIndicator(
    definition,
    {
      observations: [
        { country: "DE", period: "2025-06", value: 100 },
        { country: "DE", period: "2026-05", value: 99 },
        { country: "DE", period: "2026-06", value: 97 },
        { country: "FR", period: "2026-06", value: 101 },
        { country: "IT", period: "2026-06", value: 99 },
      ],
      requestUrl: "https://example.test/data",
    },
    countries,
  );
  assert.equal(indicator.germany.previousPeriod, "2025-06");
  assert.equal(indicator.germany.state, "deteriorating");
  assert.equal(indicator.germany.peerMedian, 100);
  assert.match(indicator.germany.explanation, /fell by 3.0/);
});

test("buildBrief states the evidence balance without creating a score", () => {
  const brief = buildBrief([
    { name: "A", germany: { state: "deteriorating" } },
    { name: "B", germany: { state: "deteriorating" } },
    { name: "C", germany: { state: "improving" } },
    { name: "D", germany: { state: "structural" } },
  ]);
  assert.deepEqual(brief.counts, {
    improving: 1,
    deteriorating: 2,
    mixed: 0,
    structural: 1,
  });
  assert.match(brief.summary, /Pressure is clearest/);
  assert.equal("score" in brief, false);
});
