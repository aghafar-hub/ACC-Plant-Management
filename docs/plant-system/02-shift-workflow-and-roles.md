# Stage 1 — Shift reports, review chain and responsibilities

## Goal

Downtime enters the app once, at the source: the shift leader records it during the shift. It is then checked twice before it counts in the downtime analysis:

```
Shift leader enters ──► Production manager reviews ──► Reliability validates ──► Posted to downtime analysis
      (Draft)                 (Submitted)                (Production approved)          (Validated → Posted)
                 ◄── Returned with a comment ──┘  ◄── Returned with a comment ──┘
```

* **Daily meeting** uses the figures as they are (provisional, marked by status).
* **Downtime analysis and monthly reports** use only **posted** stoppages, so every number in them has passed both reviews.
* Data up to **September 2026** is already reviewed and stays as uploaded. Shift reports start on **1 October 2026** (setting `shift_entry_from`).
* The monthly Excel upload stays available during the change-over (for months not yet entered through shift reports).

## Statuses of a shift report

| Status | Who acts | What they can do |
|---|---|---|
| `draft` | Shift leader of the area | Add, edit, delete stoppages; submit |
| `submitted` | Production manager | Edit stoppages (each change logged), approve or return |
| `returned` | Shift leader (from production) or production manager (from reliability) | Fix and submit again |
| `prod_approved` | Reliability engineer | Edit stoppages (logged): code, reason, classification, criticality, failure; validate or return |
| `validated` | System | Posts the stoppages to `events` (origin `shift`) |
| `posted` | Reliability (reopen only) | Reopening voids the posted events and returns the report to `prod_approved`; the reason is required |

One report = one **date × shift × area**. A stop that runs over a shift change stays one stoppage, entered by the shift in which it started; the next shift sees it as “still stopped” and enters only the restart time.

## What every change keeps

* `shift_stoppage_edits`: field, old value, new value, step (entry / production / reliability), who, when, comment. This replaces the comparison we made by hand (July: reviewers changed the equipment code 495 times, the reason 76 times, the classification 51 times, the criticality 46 times, the failure flag 43 times).
* `workflow_log`: every status change with who, when and the comment.
* The same data checks as the upload (unknown code, code of another area, blank reason, end before start, overlap …) run while the shift leader types, so most fixes happen before submission.

## Deadlines and reminders

| Step | Setting | Default | Reminder |
|---|---|---|---|
| Shift leader submits | `shift_submit_deadline_h` | 2 h after the shift ends | To the shift leader, then their backup |
| Production manager reviews | `prod_review_deadline_h` | 12 h after submission | To the production manager of the area |
| Reliability validates | `rel_validation_deadline_h` | 48 h after production approval | To the reliability engineer of the area |

Overdue reports appear in the bell and in the daily meeting view.

## Roles and responsibilities

Two separate things decide what a person can do:

1. **Role** (as today): which tabs they see and whether they can edit them. Three roles are added: **Shift leader**, **Production manager**, **Reliability engineer**.
2. **Responsibilities** (new, table `responsibilities`): which duty they hold **for which part of the plant**.

| Duty | Meaning |
|---|---|
| `shift_entry` | Enters shift reports for the scope |
| `production_review` | Reviews and approves shift reports for the scope |
| `reliability_validation` | Validates shift reports for the scope |
| `targets` | Edits KPI targets for the scope |
| `master_data` | Edits equipment, reasons and production metrics for the scope |
| `daily_meeting` | Sees the daily meeting view and its alerts for the scope |

Scope is **plant**, a **line** (L.1, L.2) or one **area**. A responsibility can be marked **backup** (covers when the main person is away) and can have **valid from / to** dates (holidays, rotation). A person may hold several duties; the same person may not approve their own entry (entry and production review of the same report must be different people — enforced by the server).

### Users page — what is added

* **Responsibilities** panel on each user: list of duty × scope rows with Add / Remove, backup tick and dates.
* **Coverage** view for Admins: a grid of areas × duties showing who is main and who is backup; a red cell means nobody holds that duty for that area (a report there could not move on).
* **Who does what** filter on the users list (e.g. “all production reviewers of Line 2”).

## Screens added in Stage 1

| Screen | For | Content |
|---|---|---|
| Shift report | Shift leader | Date, shift, area; stoppage list with the same fields as the downtime sheet; checks as you type; Submit |
| Review queue | Production manager, reliability engineer | Reports waiting for me, overdue first; open, edit, approve / return |
| Report history | Everyone with access | Status trail and every change of a report |
| Daily meeting | Production, management | Yesterday and today per area: stop hours, failures, RF / UF (provisional until validated), open reports |

## What is open

* Shift pattern and hours: seeded as two 12-hour shifts (07:00–19:00, 19:00–07:00) — **confirm**.
* Whether the production values (production, running hours, power, fuel) are also entered on the shift report or only come from the DCS report (Stage 2, waiting for the DCS report).
