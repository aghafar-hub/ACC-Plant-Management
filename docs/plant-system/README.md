# Plant system — from downtime app to the plant's single source of truth

Repository `ACC-Plant-Management`, branch `main` (moved from branch `claude/plant-system` of ACC-DownTime-Analysis on 2026-10-20, full history kept). The live downtime app stays in ACC-DownTime-Analysis and is not changed by this work. A push to `main` publishes the app (.github/workflows/deploy.yml, variable `PLANT_API_URL`).

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
| 0 | Agree one definition per KPI ([01-kpi-definitions.md](01-kpi-definitions.md)) | 24 approved 2026-10-19; quality and other new KPIs in draft |
| 1 | Shift reports with production → reliability review; only validated stoppages reach the downtime analysis ([02-shift-workflow-and-roles.md](02-shift-workflow-and-roles.md)) | Built (backend 2.1.0): Responsibilities, Shift reports, Review, Daily meeting |
| 1b | Import NRS downtime history 2024–2025 (date only, `time_precision = day`) | Built (backend 2.2.0): Upload › History import, Admin only |
| 2 | Daily production data from the DCS automated report, laboratory results from QCX; daily meeting view | Daily meeting (downtime part) built; production and quality wait for the DCS report and the QCX answers |
| 3 | Monthly reporting from the app, replacing the NRS workbook | After Stage 2 |

## Database

Schema v7 and how to set it up without touching the live app: [03-database-v7.md](03-database-v7.md).

## Open questions

Questions waiting for an answer: [05-open-questions.md](05-open-questions.md).

## Rules

Calculation rules: [01-kpi-definitions.md](01-kpi-definitions.md). Data checks, review duties and month-end closing for every section (downtime, production, energy, fuel, water, stocks, materials, quality): [04-rules-all-sections.md](04-rules-all-sections.md).
