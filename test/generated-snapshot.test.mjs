import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(
  await readFile(new URL("../site/data/dashboard.json", import.meta.url), "utf8"),
);

test("published snapshot contains the full comparison panels", () => {
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.indicators.length, 10);
  assert.equal(data.globalIndicators.length, 10);
  assert.ok(data.countries.global.some((country) => country.code === "USA"));
  assert.ok(data.countries.global.some((country) => country.code === "CHN"));
  assert.equal("score" in data.brief, false);
});

test("published news is compact, sourced and explained", () => {
  assert.ok(data.news.length <= 5);
  for (const item of data.news) {
    assert.ok(item.title);
    assert.match(item.url, /^https?:\/\//);
    assert.ok(item.whyItMatters);
    assert.ok(item.source);
  }
});

test("source health and interpretation rules remain visible", () => {
  assert.ok(data.sourceHealth.length >= 3);
  for (const source of data.sourceHealth) {
    assert.ok(["fresh", "stale", "failed"].includes(source.status));
  }
  for (const indicator of data.indicators) {
    assert.ok(indicator.source?.name);
    assert.ok(indicator.germany?.rule);
    assert.ok(indicator.germany?.explanation);
  }
});
