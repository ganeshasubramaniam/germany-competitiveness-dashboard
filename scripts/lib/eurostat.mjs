import { fetchJson } from "./http.mjs";

const BASE_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

function categoryCodes(category) {
  if (!category?.index) return [];
  if (Array.isArray(category.index)) return category.index;
  return Object.entries(category.index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code);
}

export function parseJsonStat(payload) {
  if (!Array.isArray(payload.id) || !Array.isArray(payload.size)) {
    throw new Error("Eurostat response is missing JSON-stat dimensions");
  }
  const codes = Object.fromEntries(
    payload.id.map((dimension) => [
      dimension,
      categoryCodes(payload.dimension?.[dimension]?.category),
    ]),
  );
  const values = Array.isArray(payload.value)
    ? payload.value.entries()
    : Object.entries(payload.value ?? {}).map(([index, value]) => [Number(index), value]);
  const observations = [];

  for (const [rawIndex, value] of values) {
    if (value === null || value === undefined) continue;
    let index = Number(rawIndex);
    const coordinates = {};
    for (let dimensionIndex = payload.id.length - 1; dimensionIndex >= 0; dimensionIndex -= 1) {
      const size = payload.size[dimensionIndex];
      const position = index % size;
      index = Math.floor(index / size);
      const dimension = payload.id[dimensionIndex];
      coordinates[dimension] = codes[dimension][position];
    }
    observations.push({
      ...coordinates,
      value: Number(value),
      status: payload.status?.[rawIndex] ?? null,
    });
  }
  return {
    observations,
    updatedAt: payload.updated ?? null,
    label: payload.label ?? null,
  };
}

export function buildEurostatUrl(definition, countryCodes, sinceYear = new Date().getUTCFullYear() - 6) {
  const url = new URL(`${BASE_URL}/${definition.dataset}`);
  url.searchParams.set("lang", "en");
  url.searchParams.set("sinceTimePeriod", String(sinceYear));
  for (const code of countryCodes) url.searchParams.append("geo", code);
  for (const [key, value] of Object.entries(definition.filters ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

export async function fetchEurostatIndicator(definition, countries) {
  const url = buildEurostatUrl(definition, countries.map((country) => country.code));
  const payload = await fetchJson(url);
  const parsed = parseJsonStat(payload);
  const observations = parsed.observations
    .filter((row) => row.geo && row.time)
    .map((row) => ({
      country: row.geo,
      period: row.time,
      value: row.value,
      status: row.status,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  if (!observations.length) {
    throw new Error(`Eurostat returned no observations for ${definition.id}`);
  }
  return {
    observations,
    sourceUpdatedAt: parsed.updatedAt,
    requestUrl: url,
  };
}
