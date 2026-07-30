import { buildIndicator } from "./rules.mjs";

export function mergeIndicators(definitions, results, previousItems, countries, scope) {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  return definitions
    .map((definition, index) => {
      const result = results[index];
      if (result.status === "fulfilled") {
        return buildIndicator(definition, result.value, countries, scope);
      }
      const prior = previousById.get(definition.id);
      return prior
        ? {
            ...prior,
            stale: true,
            staleReason: result.reason?.message ?? String(result.reason),
          }
        : null;
    })
    .filter(Boolean);
}
