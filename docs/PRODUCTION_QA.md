# Production QA use cases (OneDirectBuy)

Source workbook: `docs/production-qa-usecases.xlsx` (188 cases, IDs `QA-001` … `QA-188`).

## Playwright

- **Rule coverage (all 188):** `tests/OneDirectBuy/ProductionQaCoverage.spec.js` + `tests/helpers/productionQaRules.js`
- **Live storefront (Web-marked cases):** `tests/OneDirectBuy/ProductionQaLive.spec.js`
- Regenerate from Excel after edits: `npm run production-qa:generate`

```bash
npm run production-qa:test
PW_JSON_REPORT_PATH=test-results/production-qa-results.json npm run production-qa:test
npm run production-qa:report
```

Results are written to `docs/production-qa-usecases.xlsx` and `~/Desktop/production-qa-usecases.xlsx` when present.

## Google Sheet

Set `PRODUCTION_QA_GOOGLE_SHEET_ID` and authenticate (`gcloud auth application-default login`), then run:

```bash
node scripts/push-production-qa-to-google.mjs
```

Or paste the clipboard TSV from that script into a **Production QA** tab (columns: ID, Result, Notes).
