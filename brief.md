---
project: germany-competitiveness-dashboard
status: active
level: 2
created: 2026-07-30
---

# Germany Competitiveness Dashboard

## Goal

Build a mobile-friendly personal dashboard that tests Germany's competitiveness narrative against evidence rather than headlines alone. It must update automatically, compare Germany with relevant peers, explain changes transparently, and surface only consequential economic and business news.

## Deliverables

- Responsive static dashboard published through a separate GitHub Pages repository
- Daily no-key data refresh using GitHub Actions
- Timely EU peer panel for Germany, EU27, France, Italy, Netherlands, and Poland
- Annual global benchmark adding the United States and China
- Rules-based interpretations with visible thresholds, dates, source links, and caveats
- Significant-news layer built from official German feeds and clearly labelled company announcements
- Tests, source-health reporting, stale-data fallback, and methodology documentation

## Acceptance criteria

- Works comfortably on phone and desktop from one public URL
- Contains no AgenticOS files, personal data, credentials, or paid API dependency
- Shows each observation's period, frequency, source, and freshness
- Never treats unavailable or incomparable US/China data as equivalent to Eurostat peer data
- Produces no synthetic single competitiveness score
- Explains every improving/deteriorating/mixed classification from deterministic rules
- Publishes no more than five significant news items per daily refresh, with source and "why it matters"
- A failing source preserves last good data, marks it stale, and does not break publication
- Daily workflow and manual refresh both pass automated tests before deployment

## Constraints and dependencies

- Hosting: public GitHub Pages from a dedicated repository
- Runtime: static HTML/CSS/JavaScript; Node.js standard library for refresh tooling
- Primary data: Eurostat and World Bank WDI, with selected official German sources
- Primary news: Destatis and Bundesbank official feeds, plus clearly labelled SAP corporate releases
- Publication requires renewed GitHub CLI authentication
