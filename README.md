# Germany Competitiveness Dashboard

A public, mobile-friendly evidence dashboard for tracking Germany's competitiveness against European peers and annual global benchmarks.

**Live dashboard:** https://ganeshasubramaniam.github.io/germany-competitiveness-dashboard/

## Local use

```bash
npm test
npm run update
npm run serve
```

Then open `http://localhost:4173`.

## Data model

- Eurostat: timely harmonised EU comparisons
- World Bank WDI: annual global comparison including the US and China
- Official German RSS feeds: significant economic and business developments

The dashboard refresh is deterministic and uses no paid API or language model.

## Publishing

GitHub Actions refreshes the data daily at 05:17 UTC, runs tests, commits changed snapshots, and deploys `site/` to GitHub Pages.
