const DATA_URL = "./data/dashboard.json";

const stateLabels = {
  improving: "Improving",
  deteriorating: "Deteriorating",
  mixed: "Mixed",
  structural: "Structural",
  "no-verdict": "No verdict",
};

const countryLabels = {
  DE: "Germany",
  EU27_2020: "EU27",
  FR: "France",
  IT: "Italy",
  NL: "Netherlands",
  PL: "Poland",
  DEU: "Germany",
  EUU: "European Union",
  FRA: "France",
  ITA: "Italy",
  NLD: "Netherlands",
  POL: "Poland",
  USA: "United States",
  CHN: "China",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not yet refreshed";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function formatValue(value, decimals = 1, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const magnitude = Math.abs(Number(value));
  const digits = magnitude >= 100 ? 0 : decimals;
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value))}${suffix}`;
}

function setActiveView(viewName) {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("tabindex", active ? "0" : "-1");
    if (active) button.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  document.querySelectorAll(".view").forEach((section) => {
    const active = section.id === `view-${viewName}`;
    section.classList.toggle("is-active", active);
    section.hidden = !active;
  });
}

function stateBadge(signal) {
  const safeSignal = stateLabels[signal] ? signal : "no-verdict";
  return `<span class="state-badge ${safeSignal}">${stateLabels[safeSignal]}</span>`;
}

function renderBrief(data) {
  const brief = data.brief ?? {};
  const counts = brief.counts ?? {};
  document.querySelector("#daily-brief").innerHTML = `
    <p class="brief-headline">${escapeHtml(brief.headline ?? "No current reading")}</p>
    <p class="brief-summary">${escapeHtml(brief.summary ?? "The evidence set is not yet available.")}</p>
    <div class="evidence-balance" aria-label="Evidence balance">
      ${[
        ["improving", "Improving"],
        ["deteriorating", "Deteriorating"],
        ["mixed", "Mixed"],
        ["structural", "Structural"],
      ]
        .map(
          ([key, label]) => `
            <div class="balance-item ${key}">
              <span class="balance-value">${Number(counts[key] ?? 0)}</span>
              <span class="balance-label">${label}</span>
            </div>`,
        )
        .join("")}
    </div>`;
}

function renderFreshness(data) {
  const sources = data.sourceHealth ?? [];
  const target = document.querySelector("#freshness-summary");
  if (!sources.length) {
    target.innerHTML = `<div class="empty-state">No source checks are available yet.</div>`;
    return;
  }
  target.innerHTML = sources
    .map((source) => {
      const status = ["fresh", "stale", "failed"].includes(source.status) ? source.status : "stale";
      const detail =
        status === "failed"
          ? source.message || "Last refresh failed"
          : `Updated ${formatDate(source.lastSuccessAt, false)}`;
      return `
        <div class="source-health-row">
          <span class="health-dot ${status}" aria-hidden="true"></span>
          <span>
            <span class="health-name">${escapeHtml(source.name)}</span>
            <span class="health-detail">${escapeHtml(detail)}</span>
          </span>
        </div>`;
    })
    .join("");
}

function renderChain(data) {
  const chain = data.transmissionChain ?? [];
  const target = document.querySelector("#transmission-chain");
  if (!chain.length) {
    target.innerHTML = `<div class="empty-state">The transmission chain will appear after the first refresh.</div>`;
    return;
  }
  target.innerHTML = chain
    .map(
      (stage, index) => `
        <article class="chain-stage">
          <span class="chain-index">0${index + 1}</span>
          <h3>${escapeHtml(stage.title)}</h3>
          <p>${escapeHtml(stage.description)}</p>
          <div class="chain-evidence">
            ${(stage.signals ?? [])
              .slice(0, 3)
              .map(
                (signal) => `
                  <div class="chain-signal">
                    <span>${escapeHtml(signal.label)}</span>
                    ${stateBadge(signal.state)}
                  </div>`,
              )
              .join("")}
          </div>
        </article>`,
    )
    .join("");
}

function renderWatchList(data) {
  const priority = { deteriorating: 0, mixed: 1, improving: 2, structural: 3, "no-verdict": 4 };
  const sorted = [...(data.indicators ?? [])]
    .filter((item) => item.germany)
    .sort((a, b) => (priority[a.germany.state] ?? 5) - (priority[b.germany.state] ?? 5));
  const items = sorted.slice(0, 2);
  const constructive = sorted.find(
    (item) => item.germany.state === "improving" && !items.some((selected) => selected.id === item.id),
  );
  if (constructive) items.push(constructive);
  if (items.length < 3) {
    items.push(...sorted.filter((item) => !items.some((selected) => selected.id === item.id)).slice(0, 3 - items.length));
  }
  const target = document.querySelector("#watch-list");
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">No comparable signals are available yet.</div>`;
    return;
  }
  target.innerHTML = items
    .map(
      (item) => `
        <article class="watch-item">
          ${stateBadge(item.germany.state)}
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.germany.explanation)}</p>
        </article>`,
    )
    .join("");
}

function peerStrip(indicator) {
  const peers = indicator.peers ?? [];
  return `
    <div class="peer-strip" aria-label="${escapeHtml(indicator.name)} peer comparison">
      ${peers
        .map(
          (peer) => `
            <div class="peer ${["DE", "DEU"].includes(peer.code) ? "is-germany" : ""}" title="${escapeHtml(
              countryLabels[peer.code] ?? peer.code,
            )}, ${escapeHtml(peer.period ?? "no period")}">
              <span class="peer-code">${escapeHtml(peer.shortLabel ?? peer.code)}</span>
              <span class="peer-value">${escapeHtml(
                formatValue(peer.value, indicator.decimals, indicator.suffix),
              )}</span>
              <span class="peer-period">${escapeHtml(peer.period ?? "—")}</span>
            </div>`,
        )
        .join("")}
    </div>`;
}

function metricCard(indicator) {
  const germany = indicator.germany ?? {
    value: null,
    period: null,
    state: "no-verdict",
    explanation: "No comparable German observation is available.",
  };
  return `
    <article class="metric-card">
      <div class="metric-card-header">
        <h3>${escapeHtml(indicator.name)}</h3>
        ${stateBadge(germany.state)}
      </div>
      <div class="metric-lead">
        <span>
          <span class="metric-value">${escapeHtml(
            formatValue(germany.value, indicator.decimals, indicator.suffix),
          )}</span>
          <span class="metric-period">${escapeHtml(germany.period ?? "No current period")}</span>
        </span>
        <span class="metric-comparison">
          ${germany.peerMedian === null || germany.peerMedian === undefined
            ? "Same-period peer median unavailable"
            : `Same-period peer median<br>${escapeHtml(
                formatValue(germany.peerMedian, indicator.decimals, indicator.suffix),
              )}`}
        </span>
      </div>
      ${peerStrip(indicator)}
      <p class="metric-rule">${escapeHtml(germany.explanation)}</p>
      <div class="metric-footer">
        <span class="frequency-badge">${escapeHtml(indicator.frequency)}</span>
        <a href="${safeUrl(indicator.source.url)}" target="_blank" rel="noreferrer">Source: ${escapeHtml(
          indicator.source.name,
        )}</a>
      </div>
    </article>`;
}

function renderEvidence(data) {
  const pillars = data.pillars ?? [];
  const indicators = data.indicators ?? [];
  const target = document.querySelector("#evidence-grid");
  const populated = pillars
    .map((pillar) => ({
      ...pillar,
      indicators: indicators.filter((indicator) => indicator.pillar === pillar.id),
    }))
    .filter((pillar) => pillar.indicators.length);

  if (!populated.length) {
    target.innerHTML = `<div class="empty-state">The timely EU panel has not been populated yet.</div>`;
    return;
  }

  target.innerHTML = populated
    .map(
      (pillar) => `
        <section class="pillar-block" aria-labelledby="pillar-${escapeHtml(pillar.id)}">
          <div class="pillar-header">
            <h2 id="pillar-${escapeHtml(pillar.id)}">${escapeHtml(pillar.name)}</h2>
            <p>${escapeHtml(pillar.description)}</p>
          </div>
          <div class="metric-grid">
            ${pillar.indicators.map(metricCard).join("")}
          </div>
        </section>`,
    )
    .join("");
}

function renderGlobal(data) {
  const target = document.querySelector("#global-grid");
  const indicators = data.globalIndicators ?? [];
  target.innerHTML = indicators.length
    ? indicators.map(metricCard).join("")
    : `<div class="empty-state">The annual global benchmark has not been populated yet.</div>`;
}

function renderNews(data) {
  const target = document.querySelector("#news-list");
  const items = data.news ?? [];
  if (!items.length) {
    target.innerHTML = `<div class="empty-state">No release crossed the significance threshold in the current window.</div>`;
    return;
  }
  target.innerHTML = items
    .map(
      (item) => `
        <article class="news-card">
          <div>
            <div class="news-source">${escapeHtml(item.source)}</div>
            <div class="news-date">${escapeHtml(formatDate(item.publishedAt))}</div>
            <div class="topic-tags">
              <span class="score-badge">Significance ${Number(item.score)}/10</span>
              ${item.kind === "company" ? `<span class="topic-tag">Company announcement</span>` : ""}
              ${item.stale ? `<span class="topic-tag">Last good item · source unavailable</span>` : ""}
            </div>
          </div>
          <div>
            <h3><a href="${safeUrl(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(
              item.title,
            )}</a></h3>
            <p class="news-why"><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p>
            <div class="news-meta">
              <div class="topic-tags">
                ${(item.topics ?? []).map((topic) => `<span class="topic-tag">${escapeHtml(topic)}</span>`).join("")}
              </div>
              <span class="metric-period">${escapeHtml((item.rules ?? []).join(" · "))}</span>
            </div>
          </div>
        </article>`,
    )
    .join("");
}

function renderMethodology(data) {
  const noiseBands = data.methodology?.noiseBands ?? [];
  const sources = data.sourceHealth ?? [];
  document.querySelector("#methodology-content").innerHTML = `
    <article class="method-card">
      <p class="eyebrow">Two-speed evidence</p>
      <h2>Comparable where it matters</h2>
      <ul>
        <li>Eurostat provides the timely, harmonised EU peer panel.</li>
        <li>World Bank WDI provides the annual global panel including the US and China.</li>
        <li>Reference periods and frequency remain visible; annual data never masquerades as a daily signal.</li>
        <li>Missing or incomparable observations remain unavailable rather than being filled with proxies.</li>
      </ul>
    </article>
    <article class="method-card">
      <p class="eyebrow">Interpretation</p>
      <h2>Every verdict has a rule</h2>
      <ul>
        <li>Improving and deteriorating require movement beyond a metric-specific noise band.</li>
        <li>Mixed means the move is small, conflicting, or provisional.</li>
        <li>Structural indicators are compared with peer levels, not coloured as daily momentum.</li>
        <li>No single competitiveness score is calculated.</li>
      </ul>
    </article>
    <article class="method-card">
      <p class="eyebrow">Noise bands</p>
      <h2>Minimum meaningful movement</h2>
      <ul>
        ${noiseBands.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`).join("")}
      </ul>
    </article>
    <article class="method-card">
      <p class="eyebrow">Source status</p>
      <h2>Failure stays visible</h2>
      <ul>
        ${sources
          .map(
            (source) =>
              `<li><strong>${escapeHtml(source.name)}:</strong> ${escapeHtml(source.status)}${
                source.message ? ` — ${escapeHtml(source.message)}` : ""
              }</li>`,
          )
          .join("")}
      </ul>
    </article>
    <article class="method-card">
      <p class="eyebrow">News gate</p>
      <h2>Material events, not a feed</h2>
      <ul>
        <li>Official statistics and binding policy decisions receive the highest authority weight.</li>
        <li>Quantified investment, employment, capacity, closure, and regulatory events receive magnitude weight.</li>
        <li>Company releases are labelled announcements and cannot alone prove economic impact.</li>
        <li>At most five items scoring 6/10 or more are shown.</li>
      </ul>
    </article>
    <article class="method-card">
      <p class="eyebrow">Limitations</p>
      <h2>What this cannot establish</h2>
      <ul>
        <li>The transmission chain is a reading order, not a causal econometric model.</li>
        <li>Official series are revised and often published with substantial lags.</li>
        <li>Rules-based relevance describes mechanisms; it is not a forecast.</li>
        <li>Annual institutional indicators are context, not proof of current momentum.</li>
      </ul>
    </article>`;
}

function render(data) {
  document.querySelector("#as-of").textContent = data.generatedAt
    ? `Evidence refreshed ${formatDate(data.generatedAt, true)}`
    : "Awaiting first refresh";
  document.querySelector("#build-stamp").textContent = data.generatedAt
    ? `Snapshot ${new Date(data.generatedAt).toISOString()}`
    : "No snapshot generated";
  renderBrief(data);
  renderFreshness(data);
  renderChain(data);
  renderWatchList(data);
  renderEvidence(data);
  renderGlobal(data);
  renderNews(data);
  renderMethodology(data);
}

async function loadDashboard() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request returned ${response.status}`);
    render(await response.json());
  } catch (error) {
    document.querySelector("#daily-brief").innerHTML = `
      <div class="empty-state">
        The dashboard data could not be loaded. ${escapeHtml(error.message)}
      </div>`;
  }
}

const navButtons = [...document.querySelectorAll(".nav-tab")];

navButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    const nextHash = `#${button.dataset.view}`;
    if (location.hash === nextHash) {
      setActiveView(button.dataset.view);
    } else {
      location.hash = nextHash;
    }
  });
  button.addEventListener("keydown", (event) => {
    const offsets = { ArrowLeft: -1, ArrowRight: 1 };
    let nextIndex;
    if (event.key in offsets) {
      nextIndex = (index + offsets[event.key] + navButtons.length) % navButtons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = navButtons.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    navButtons[nextIndex].focus();
    navButtons[nextIndex].click();
  });
});

const viewNames = new Set(["overview", "evidence", "global", "news", "methodology"]);

function syncViewFromHash() {
  const requestedView = location.hash.slice(1);
  if (viewNames.has(requestedView)) setActiveView(requestedView);
}

syncViewFromHash();
window.addEventListener("hashchange", syncViewFromHash);

loadDashboard();
