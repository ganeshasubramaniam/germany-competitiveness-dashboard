function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function previousYearPeriod(period) {
  const match = String(period).match(/^(\d{4})(.*)$/);
  if (!match) return null;
  return `${Number(match[1]) - 1}${match[2]}`;
}

function latestForCountry(observations, country) {
  return observations
    .filter((row) => row.country === country && Number.isFinite(row.value))
    .sort((a, b) => b.period.localeCompare(a.period))[0] ?? null;
}

function comparisonForCountry(observations, latest) {
  if (!latest) return null;
  const countryRows = observations
    .filter((row) => row.country === latest.country && row.period < latest.period)
    .sort((a, b) => b.period.localeCompare(a.period));
  const preferred = previousYearPeriod(latest.period);
  return countryRows.find((row) => row.period === preferred) ?? countryRows[0] ?? null;
}

function classify(definition, latest, comparison) {
  if (!latest) return "no-verdict";
  if (definition.direction === "neutral" || definition.frequency === "Annual") return "structural";
  if (!comparison) return "no-verdict";
  if (latest.status && /[peub]/i.test(latest.status)) return "mixed";
  const delta = latest.value - comparison.value;
  if (Math.abs(delta) < definition.noise) return "mixed";
  const higherIsBetter = definition.direction === "higher";
  return (delta > 0) === higherIsBetter ? "improving" : "deteriorating";
}

function explain(definition, latest, comparison, peerMedian, state) {
  if (!latest) return "No comparable German observation is available.";
  if (state === "structural") {
    if (peerMedian === null) {
      return `${latest.period} is the latest available annual observation; peer coverage is incomplete.`;
    }
    const gap = latest.value - peerMedian;
    const relation = Math.abs(gap) < definition.noise ? "close to" : gap > 0 ? "above" : "below";
    return `${latest.period}: Germany is ${relation} the available peer median. This is structural context, not a daily momentum call.`;
  }
  if (!comparison) {
    return `${latest.period} is available, but there is no suitable earlier comparison for a verdict.`;
  }
  const delta = latest.value - comparison.value;
  const directionWord = delta > 0 ? "rose" : "fell";
  const amount = Math.abs(delta).toFixed(definition.decimals ?? 1);
  if (state === "mixed") {
    if (latest.status) {
      return `${latest.period}: ${directionWord} by ${amount}${definition.suffix || ""} versus ${comparison.period}. Eurostat flags the latest observation as "${latest.status}", so the verdict stays mixed.`;
    }
    return `${latest.period}: ${directionWord} by ${amount}${definition.suffix || ""} versus ${comparison.period}, inside the ${definition.noise}-point noise band or subject to a data flag.`;
  }
  return `${latest.period}: ${directionWord} by ${amount}${definition.suffix || ""} versus ${comparison.period}; that is ${state} under the published direction rule.`;
}

export function buildIndicator(definition, result, countries, scope = "eu") {
  const observations = result?.observations ?? [];
  const germanyCode = scope === "global" ? "DEU" : "DE";
  const latestGermany = latestForCountry(observations, germanyCode);
  const peers = countries.map((country) => {
    const latest = latestForCountry(observations, country.code);
    return {
      code: country.code,
      shortLabel: country.shortLabel,
      value: latest?.value ?? null,
      period: latest?.period ?? null,
    };
  });
  const peerValues = peers
    .filter((peer) => peer.code !== germanyCode && peer.period === latestGermany?.period)
    .map((peer) => peer.value);
  const peerMedian = median(peerValues);
  const comparison = comparisonForCountry(observations, latestGermany);
  const signal = classify(definition, latestGermany, comparison);

  return {
    id: definition.id,
    name: definition.name,
    pillar: definition.pillar,
    frequency: definition.frequency,
    decimals: definition.decimals,
    suffix: definition.suffix,
    source: {
      ...definition.source,
      url: result?.requestUrl ?? definition.source.url,
    },
    peers,
    germany: {
      value: latestGermany?.value ?? null,
      period: latestGermany?.period ?? null,
      previousValue: comparison?.value ?? null,
      previousPeriod: comparison?.period ?? null,
      peerMedian,
      state: signal,
      explanation: explain(definition, latestGermany, comparison, peerMedian, signal),
      rule: {
        direction: definition.direction,
        noiseBand: definition.noise,
      },
    },
  };
}

export function buildBrief(indicators) {
  const counts = { improving: 0, deteriorating: 0, mixed: 0, structural: 0 };
  for (const indicator of indicators) {
    const state = indicator.germany?.state;
    if (state in counts) counts[state] += 1;
  }
  const deteriorating = indicators.filter((item) => item.germany?.state === "deteriorating");
  const improving = indicators.filter((item) => item.germany?.state === "improving");
  let headline = "The current evidence is mixed rather than one-directional.";
  if (deteriorating.length > improving.length + 1) {
    headline = "More timely signals are deteriorating than improving.";
  } else if (improving.length > deteriorating.length + 1) {
    headline = "More timely signals are improving than deteriorating.";
  }
  const adverseNames = deteriorating.slice(0, 2).map((item) => item.name);
  const positiveNames = improving.slice(0, 2).map((item) => item.name);
  const parts = [];
  if (adverseNames.length) parts.push(`Pressure is clearest in ${adverseNames.join(" and ")}.`);
  if (positiveNames.length) parts.push(`Improvement is visible in ${positiveNames.join(" and ")}.`);
  if (!parts.length) {
    parts.push("Most available measures are structural, unchanged within their noise bands, or awaiting a comparable release.");
  }
  return { headline, summary: parts.join(" "), counts };
}

function aggregateStageState(signals) {
  const counts = signals.reduce(
    (acc, signal) => {
      acc[signal.state] = (acc[signal.state] ?? 0) + 1;
      return acc;
    },
    {},
  );
  if ((counts.deteriorating ?? 0) > (counts.improving ?? 0)) return "deteriorating";
  if ((counts.improving ?? 0) > (counts.deteriorating ?? 0)) return "improving";
  return "mixed";
}

export function buildTransmissionChain(indicators) {
  const stages = [
    {
      title: "Inputs & bottlenecks",
      description: "Energy, labour availability and state capacity shape the feasible operating environment.",
      pillars: ["costs", "labour", "state"],
    },
    {
      title: "Investment & productivity",
      description: "Capital formation and innovation determine whether constraints translate into renewal or erosion.",
      pillars: ["investment", "innovation", "productivity"],
    },
    {
      title: "Industry & trade outcomes",
      description: "Production and export structure show where competitiveness is being won or lost.",
      pillars: ["industry", "trade"],
    },
  ];
  return stages.map((stage) => {
    const relevant = indicators.filter((item) => stage.pillars.includes(item.pillar) && item.germany);
    const signals = relevant.slice(0, 3).map((item) => ({
      label: item.name,
      state: item.germany.state,
    }));
    return { ...stage, state: aggregateStageState(signals), signals };
  });
}
