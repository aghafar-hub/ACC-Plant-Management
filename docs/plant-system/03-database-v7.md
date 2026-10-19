# Database schema v7 and how to set it up

Schema v7 keeps all 27 existing tables unchanged and adds 17 tables and 3 columns on `events`. It comes from `schema/tables.json` (version 7) like every earlier version.

## New tables

| Table | Stage | Holds |
|---|---|---|
| `shifts` | 1 | The plant shifts (seeded: Day 08:00–20:00, Night 20:00–08:00) |
| `shift_reports` | 1 | One report per date × shift × area with its status and who acted when |
| `shift_stoppages` | 1 | The stoppages of each report (same fields as `events`), open or closed, which later shift closed it, and the event it was posted as |
| `shift_stoppage_edits` | 1 | Every change after submission: step, field, old, new, who, when, comment |
| `workflow_log` | 1 | Every status change of a report |
| `responsibilities` | 1 | Who holds which duty (entry, production review, reliability validation, targets, master data, daily meeting) for which scope (plant, line, area), with backup and dates |
| `kpi_definitions` | 0 | The agreed definition of each KPI (24 approved on 2026-10-19, 15 quality / materials / stock / data drafts) |
| `kpi_targets` | 0 | Targets by scope × KPI × year × month (month 0 = whole year) |
| `production_metrics` | 2 | What is measured per area each day, with its DCS tag and limits |
| `production_values` | 2 | Daily (or per-shift) values: raw, correction, final |
| `production_corrections` | 2 | Requested and approved corrections with the reason |
| `dcs_import_batches` | 2 | Each imported DCS report, QCX export or workbook |
| `quality_parameters` | 2 | What the laboratory measures per area and material, with specification and valid limits (seeded with the 52 QCX columns) |
| `quality_results` | 2 | Laboratory results, per sample or daily average |
| `check_rules` | all | The data checks of every section with their thresholds (36 seeded) |
| `data_checks` | all | Each check raised and how it was resolved |
| `month_closings` | 3 | Month-end review (section engineer) and sign-off (section manager) per section; signed-off months are locked |

New columns on `events` (blank on every existing row, which means “uploaded as today”):

| Column | Values |
|---|---|
| `origin` | `upload` · `shift` · `history` |
| `time_precision` | `exact` · `day` (history rows from the NRS workbook only know the date) |
| `shift_stop_id` | The shift stoppage the event was posted from |

Also added: 4 roles (Shift leader, Production manager, Reliability engineer, Quality engineer) with access to the existing tabs, and 5 settings (`shift_submit_deadline_h`, `prod_review_deadline_h`, `rel_validation_deadline_h`, `daily_meeting_time`, `shift_entry_from`).

## Set-up — the current app is not touched

The new work runs on its own copy of the database and its own Apps Script project, so the live app keeps working whatever happens on the new branch.

1. **Copy the live database.** In Google Drive, right-click the live database spreadsheet › *Make a copy*. Name it e.g. `ACC Plant System Database (test)`. The copy has every event, user, action and setting as they are today.
2. **Make a second Apps Script project.** Open the copy › *Extensions › Apps Script*, or create a stand-alone project. Paste the files of `backend/apps-script/` from branch `claude/plant-system` (same file names as before).
3. **Script properties.** Set `SPREADSHEET_ID` to the id of the **copy** (only needed for a stand-alone project), and new values for `SESSION_SIGNING_SECRET` and `PASSWORD_PEPPER`. A new pepper means the passwords in the copy no longer match; reset them from the copy, or reuse the live pepper if you want the same passwords on the test copy.
4. **Run `ensureSchema`, then `seedDefaults`.** They add the 17 tables, the 3 event columns, the roles, settings, shifts, KPI definitions, quality parameters and check rules. They never change or remove existing rows.
5. **Deploy as a web app** and keep its URL private; the test site of the plant-system branch will point to it.

The live spreadsheet and the live Apps Script project are never opened in these steps.

## Reference workbook

`local-data/ACC_Downtime_Database_v7_template.xlsx` (not in git) is built with:

```
python3 tools/build_database_sheet.py \
  --equipment local-data/ACC_Downtime_Equipment_Master_v2.xlsx \
  --reasons local-data/ACC_Downtime_Reason_Master.xlsx \
  --out local-data/ACC_Downtime_Database_v7_template.xlsx
```

It has all 44 tables with their headers, the seeds, and up-to-date README and DICTIONARY tabs. It is a **reference and empty template**, not a replacement for the live data: it has no events, users or actions, and its equipment and reason masters are the original files (the live sheet has been edited since). Use the copy in step 1 for real work.

## Points found in the live database

| Point | Proposal |
|---|---|
| README and DICTIONARY tabs still describe version 1 | Replace them with the tabs of the reference workbook (copy-paste the two sheets) |
| The seed upload batch has a placeholder `file_hash` | Leave it; it only affects the duplicate-file check for that first file |
| Equipment `111.AF040` has itself as parent | Clear its `parent_id` in Master data |
| `planned_allowance_h_year` = 1 h on an area target | Looks like a test value; enter the real yearly planned-stop allowance |
| 604 SHR failures with reason “Material blockage” in a draft action | Check with the area whether these are true failures or process stops (classification PRO vs CIR) |
