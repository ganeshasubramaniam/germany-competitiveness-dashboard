import { fetchJson } from "./http.mjs";

const BASE_URL = "https://api.worldbank.org/v2";

export function parseWorldBank(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error("World Bank response has an unexpected shape");
  }
  return payload[1]
    .filter((row) => row.value !== null && row.countryiso3code)
    .map((row) => ({
      country: row.countryiso3code,
      period: row.date,
      value: Number(row.value),
      status: null,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function fetchWorldBankIndicator(definition, countries) {
  const countryPath = countries.map((country) => country.code).join(";");
  const url = new URL(`${BASE_URL}/country/${countryPath}/indicator/${definition.code}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "200");
  url.searchParams.set("date", `${new Date().getUTCFullYear() - 8}:${new Date().getUTCFullYear()}`);
  const payload = await fetchJson(url.href, { timeout: 25_000, attempts: 1 });
  const observations = parseWorldBank(payload);
  if (!observations.length) {
    throw new Error(`World Bank returned no observations for ${definition.code}`);
  }
  return { observations, sourceUpdatedAt: null, requestUrl: url.href };
}
