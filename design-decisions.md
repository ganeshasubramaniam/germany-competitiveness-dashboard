# Design and analytical decisions

## Human and task

The primary reader is a Germany-based project-finance specialist making a quick morning scan on a phone, with the option to inspect methodology and peer data on a larger screen.

The dashboard must answer: **What changed, and does the evidence strengthen or weaken the case that Germany is losing competitiveness?**

It should feel like a Bundesbank briefing crossed with an industrial control room: calm, dense, and legible rather than dramatic.

## Domain language

The interface borrows from industrial production and transmission systems:

- inputs and bottlenecks
- cost stack
- capacity and orders
- transmission from drivers to outcomes
- structural versus cyclical signals
- source vintages and revisions

## Visual direction

- Statistical-paper canvas rather than a generic white SaaS background
- Graphite typography and steel-grey structure
- Restrained amber for pressure, oxide red for deterioration, and export teal for improvement
- Surface colour shifts as the only depth strategy
- Four-pixel spacing base for compact mobile and desktop scanning
- Tabular numerals for every metric

## Signature element

The overview is a **competitiveness transmission chain**:

`Inputs & bottlenecks → Investment & productivity → Industry & trade outcomes`

Each link shows Germany's current direction, peer gap, data age, and supporting evidence. The chain is not a causal model; it is a reading order that prevents outcome statistics from being detached from their underlying drivers.

## Deliberate rejections

- No single competitiveness score: weights would create false precision.
- No generic KPI-card wall: relationships and freshness matter more than isolated values.
- No news homepage: news is filtered evidence, not the organising principle.
- No fabricated global monthly comparison: the US and China appear only where a genuinely comparable annual source exists.

## Evidence model

### Timely EU panel

Germany, EU27, France, Italy, Netherlands, and Poland use harmonised Eurostat series for growth, productivity, unit labour costs, industry, energy prices, investment, R&D, labour, and demography.

### Global annual benchmark

World Bank WDI adds the United States and China for comparable annual measures such as GDP growth, productivity per worker, investment, manufacturing share, R&D, high-tech exports, demographics, and government effectiveness.

### Interpretation states

- `Improving`: preferred-direction movement exceeds the metric's noise band
- `Deteriorating`: adverse movement exceeds the noise band
- `Mixed`: conflicting comparisons, provisional value, or movement inside the noise band
- `Structural`: slow-moving annual level shown against the peer median
- `No verdict`: missing, stale beyond tolerance, or incomparable

Every rendered verdict exposes the rule, comparison period, threshold, and source.

## News policy

Official statistical and regulatory sources take priority. Company releases are labelled as announcements and cannot alone establish economic impact. Media feeds are excluded from v1 unless their redistribution terms are clearly compatible.

Items receive a visible significance score based on authority, binding action, quantified magnitude, topic relevance, corroboration, and a direct German connection. Only items scoring at least 6/10 appear, with a maximum of five per refresh.
