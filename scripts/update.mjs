import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  EU_COUNTRIES,
  EUROSTAT_INDICATORS,
  GLOBAL_COUNTRIES,
  METHODOLOGY,
  NEWS_SOURCES,
  PILLARS,
  WORLD_BANK_INDICATORS,
} from "./config.mjs";
import { fetchEurostatIndicator } from "./lib/eurostat.mjs";
import { curateNews, fetchNewsSource } from "./lib/news.mjs";
import { buildBrief, buildTransmissionChain } from "./lib/rules.mjs";
import { mergeIndicators } from "./lib/snapshot.mjs";
import { fetchWorldBankIndicator } from "./lib/worldbank.mjs";

const dashboardPath = fileURLToPath(new URL("../site/data/dashboard.json", import.meta.url));
const historyPath = fileURLToPath(new URL("../site/data/history.json", import.meta.url));
const newsHistoryPath = fileURLToPath(new URL("../site/data/news-history.json", import.meta.url));
const now = new Date();
const nowIso = now.toISOString();

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        output[index] = { status: "fulfilled", value: await mapper(items[index], index) };
      } catch (reason) {
        output[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

function previousHealth(previous, id) {
  return previous.sourceHealth?.find((source) => source.id === id) ?? null;
}

function groupHealth({ id, name, results, previous }) {
  const successCount = results.filter((result) => result.status === "fulfilled").length;
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message ?? String(result.reason));
  const prior = previousHealth(previous, id);
  if (successCount === results.length) {
    return { id, name, status: "fresh", lastSuccessAt: nowIso, message: null };
  }
  if (successCount > 0) {
    return {
      id,
      name,
      status: "stale",
      lastSuccessAt: nowIso,
      message: `${successCount}/${results.length} series refreshed. ${failures.slice(0, 2).join(" ")}`,
    };
  }
  return {
    id,
    name,
    status: "failed",
    lastSuccessAt: prior?.lastSuccessAt ?? null,
    message: failures.slice(0, 2).join(" ") || "No source response",
  };
}

async function updateNews(previous) {
  const results = await mapWithConcurrency(NEWS_SOURCES, 3, fetchNewsSource);
  const freshItems = results
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value);
  const failedSourceIds = new Set(
    NEWS_SOURCES
      .filter((_, index) => results[index].status === "rejected")
      .map((source) => source.id),
  );
  const fallbackItems = (previous.news ?? [])
    .filter((item) => failedSourceIds.has(item.sourceId))
    .map((item) => ({ ...item, stale: true }));
  const curated = curateNews([...freshItems, ...fallbackItems], now);
  const health = NEWS_SOURCES.map((source, index) => {
    const result = results[index];
    const prior = previousHealth(previous, `news-${source.id}`);
    return result.status === "fulfilled"
      ? {
          id: `news-${source.id}`,
          name: `${source.name} feed`,
          status: "fresh",
          lastSuccessAt: nowIso,
          message: null,
        }
      : {
          id: `news-${source.id}`,
          name: `${source.name} feed`,
          status: "failed",
          lastSuccessAt: prior?.lastSuccessAt ?? null,
          message: result.reason?.message ?? String(result.reason),
        };
  });
  return { curated, health };
}

function snapshotHistory(history, indicators, globalIndicators) {
  const entry = {
    generatedAt: nowIso,
    indicators: [...indicators, ...globalIndicators].map((item) => ({
      id: item.id,
      value: item.germany?.value ?? null,
      period: item.germany?.period ?? null,
      state: item.germany?.state ?? "no-verdict",
    })),
  };
  const snapshots = [...(history.snapshots ?? []), entry].slice(-180);
  return { schemaVersion: 1, snapshots };
}

function updateNewsHistory(history, news) {
  const existing = new Map((history.items ?? []).map((item) => [item.url, item]));
  for (const item of news) {
    existing.set(item.url, {
      url: item.url,
      title: item.title,
      firstSeenAt: existing.get(item.url)?.firstSeenAt ?? nowIso,
      lastSeenAt: nowIso,
    });
  }
  const cutoff = now.valueOf() - 30 * 24 * 60 * 60 * 1000;
  return {
    schemaVersion: 1,
    items: [...existing.values()].filter((item) => new Date(item.lastSeenAt).valueOf() >= cutoff),
  };
}

async function main() {
  const previous = await readJson(dashboardPath, {});
  const history = await readJson(historyPath, { schemaVersion: 1, snapshots: [] });
  const newsHistory = await readJson(newsHistoryPath, { schemaVersion: 1, items: [] });

  const eurostatResults = await mapWithConcurrency(EUROSTAT_INDICATORS, 3, (definition) =>
    fetchEurostatIndicator(definition, EU_COUNTRIES),
  );
  const worldBankResults = await mapWithConcurrency(WORLD_BANK_INDICATORS, 4, (definition) =>
    fetchWorldBankIndicator(definition, GLOBAL_COUNTRIES),
  );
  const newsResult = await updateNews(previous);

  const indicators = mergeIndicators(
    EUROSTAT_INDICATORS,
    eurostatResults,
    previous.indicators ?? [],
    EU_COUNTRIES,
    "eu",
  );
  const globalIndicators = mergeIndicators(
    WORLD_BANK_INDICATORS,
    worldBankResults,
    previous.globalIndicators ?? [],
    GLOBAL_COUNTRIES,
    "global",
  );
  const sourceHealth = [
    groupHealth({
      id: "eurostat",
      name: "Eurostat EU panel",
      results: eurostatResults,
      previous,
    }),
    groupHealth({
      id: "world-bank",
      name: "World Bank global panel",
      results: worldBankResults,
      previous,
    }),
    ...newsResult.health,
  ];
  const allEvidence = [...indicators, ...globalIndicators];
  if (!allEvidence.length) {
    throw new Error("No official indicator source produced usable data and no previous snapshot exists");
  }
  const dashboard = {
    schemaVersion: 1,
    generatedAt: nowIso,
    status: sourceHealth.some((source) => source.status !== "fresh") ? "degraded" : "healthy",
    countries: { eu: EU_COUNTRIES, global: GLOBAL_COUNTRIES },
    pillars: PILLARS,
    indicators,
    globalIndicators,
    news: newsResult.curated,
    sourceHealth,
    transmissionChain: buildTransmissionChain(allEvidence),
    brief: buildBrief(indicators),
    methodology: METHODOLOGY,
  };

  await writeFile(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`);
  await writeFile(historyPath, `${JSON.stringify(snapshotHistory(history, indicators, globalIndicators), null, 2)}\n`);
  await writeFile(newsHistoryPath, `${JSON.stringify(updateNewsHistory(newsHistory, newsResult.curated), null, 2)}\n`);

  const failed = sourceHealth.filter((source) => source.status === "failed");
  console.log(
    `Updated ${indicators.length} EU indicators, ${globalIndicators.length} global indicators, and ${newsResult.curated.length} news items.`,
  );
  if (failed.length) {
    console.warn(`Degraded sources: ${failed.map((source) => source.name).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message ?? String(error));
  process.exitCode = 1;
});
