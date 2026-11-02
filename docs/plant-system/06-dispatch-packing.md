# Dispatch & Packing section

A section of its own in the app (left rail: **Dispatch & Packing**), next to Downtime analysis. It holds everything the
workbook sheet "Packing & Dispatch" holds: dispatch by product and delivery mode, the six packers, bags, clinker and
packing power. **Status: frontend and demo mode.** The access tab `dispatch` exists in the schema and the backend (14 tabs,
seeded as below), but the four data calls and the database tables are the next step. Until a server reports version 2.4.0
the section is not shown (`useVisiblePages`), so a real server never offers a section whose calls would fail; demo mode reports 2.4.0.

## Decisions (owner, this session)

| Topic | Decision |
|---|---|
| Data in | Upload the production workbook (sheet "Packing & Dispatch"), on the **Data** page. A daily entry form may follow later. |
| Duplicate dates | The whole upload is refused if any date is already stored; nothing is ever replaced by an upload. |
| Access | One new access tab, `dispatch`. Admin, Manager and Production manager **Edit**; every other role **View**. No new roles, no review workflow yet. |
| Downtime | **Fully separate.** Packer stoppage, unplanned and no-trucks hours live only in this section. Nothing is posted to downtime events; the areas PK.1 and PK.2 in the downtime analysis are untouched. |
| Checks | Four groups on **Data validation**: totals tie-out, time balance, range and gaps, bags and products (rules `DP-*`, `src/dispatch/checks.ts`). A check never changes a value. |
| Targets | Rated capacity per packer, a dispatch target per month, a running-availability target and a most-no-trucks share, kept on the Data page. **Values still to be supplied by the plant**; empty means no target. |

## Pages

Dashboard · Dispatch analysis · Packers · Bags, clinker and power · Data validation · Data (upload, targets, every day, export).
Paths `/dispatch/dashboard`, `/dispatch/analysis`, `/dispatch/packers`, `/dispatch/bags`, `/dispatch/validate`, `/dispatch/data`.

## Where things are

| What | Where |
|---|---|
| Model, formulas, checks, parser, insights | `src/dispatch/` (pure, unit-tested) |
| Pages | `src/pages/dispatch/` |
| API (demo implementation only) | `DispatchApi` in `src/api/types.ts`: `getDispatchDays`, `uploadDispatchDays`, `getDispatchSettings`, `saveDispatchSettings`. Kept out of `Api` because the backend suite needs an access rule and handler for every `Api` call. The server client answers "not available". |
| Demo data | `src/dispatch/synthetic.ts`: made up, seeded. **Real plant data is never committed.** |
| Access tab | `schema/tables.json` (`tabAccessDefaults`), `backend/apps-script/Config.js` (`TAB_IDS`), `src/api/types.ts` |

## Facts found in the 2025 workbook (reconciled locally, not stored here)

* Total dispatch = bagged + bulk + sling (CEM IV/A) + jumbo (CEM I 52.5); it equals the Daily Report year-to-date figure.
* Packer tons = bagged + sling dispatch over the year (0.04 % apart), but not day by day: the daily tie-out is information only, the monthly one warns above 1 %.
* The sheet's "broken %" columns are multiplied by 10, broken bags are used bags x a fixed rate, and used bags are tons x 20: all bag figures are estimates. The workbook's palletized-manual total leaves out CEM IV/A.

## Next

1. Backend 2.4.0: tables for the daily rows and the targets, the four calls above (then move them into `Api`, add their access rules), contract tests, bump `APP_VERSION`.
2. Month closing and a review step if the plant wants them (the access choice made now is Edit / View only).
3. A daily entry form, once the upload has been used for a while.
