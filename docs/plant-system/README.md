# Plant system — from downtime app to the plant's single source of truth

Branch: `claude/plant-system`. The live app (`main`, `live`, `test-site`) is not changed by this work.

## Where we are going

Today the plant keeps its production performance in three places that do not agree:

| Source | What it does | Problem |
|---|---|---|
| Daily Shift Report workbook | Shift leaders enter production, power, fuel and stoppages; the daily meeting uses its charts | No review step, no shift column, RF always 100 % (stop hours not filled), very large sheets |
| NRS reporting workbook | Monthly KPIs from the DCS data and the downtime list | Hard-coded targets, silent zeros, error cells, refreshes only on one computer |
| Downtime app | Reviewed downtime, reliability KPIs, actions | Downtime only, loaded once a month |

The app becomes the one place where data is entered once, reviewed, and reported from.

## Stages

| Stage | What | Status |
|---|---|---|
| 0 | Agree one definition per KPI ([01-kpi-definitions.md](01-kpi-definitions.md)) | Draft ready for review |
| 1 | Shift reports with production → reliability review; only validated stoppages reach the downtime analysis ([02-shift-workflow-and-roles.md](02-shift-workflow-and-roles.md)) | Designed; database ready |
| 1b | Import NRS downtime history 2024–2025 (date only, `time_precision = day`) | Agreed; after Stage 1 |
| 2 | Daily production data from the DCS automated report; daily meeting view | Waiting for the DCS report |
| 3 | Monthly reporting from the app, replacing the NRS workbook | After Stage 2 |

## Database

Schema v7 and how to set it up without touching the live app: [03-database-v7.md](03-database-v7.md).
