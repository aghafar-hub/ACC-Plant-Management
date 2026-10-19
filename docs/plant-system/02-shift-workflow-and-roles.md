# Stage 1 — Shift reports, review chain and responsibilities

**Status (backend 2.1.0, branch `claude/plant-system`):** built. Settings › Users › Responsibilities and "Who does what" (2.0.0);
Shift reports (My shift · Review · All reports) and Daily meeting (2.1.0). What was decided while building is listed at the end.

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

One report = one **date × shift × area**. Shifts: **Day 08:00–20:00** and **Night 20:00–08:00**; the night shift belongs to the date it starts.

## Long stoppages (across shifts)

A stoppage is entered **once**, by the shift in which it started, with its stop time. If the equipment is still stopped when that shift ends, the stoppage stays **open** (no restart time):

```
Day 18 (08–20)        Night 18 (20–08)        Day 19 (08–20)
stop 15:40 ──────────────── still stopped ──────────── restart 10:25
entered here          confirms "still stopped"   enters the restart time
(open)                (open)                     (closed)
```

* Every later shift report of the area lists the **open stoppages** at the top. The shift leader either enters the restart time or confirms “still stopped”. This is the only change allowed on a stoppage that belongs to an earlier report, and it is recorded (`closed_report_id`, `closed_by`, `closed_at`).
* The report of the starting shift can be submitted and reviewed with the stoppage still open. The stoppage itself is posted to the downtime analysis only when it is **closed and the closing report is validated**, so the restart time also passes the production and reliability reviews.
* Hours are split by shift and by day from the stop and restart times (the app already counts hours inside any period), so each shift's and each day's figures are right without entering continuation rows. This replaces today's practice of a new row with Freq = 0 on every shift or day.
* While open, the daily meeting counts the stop up to the current time and shows it as **still stopped**.
* An open stoppage older than 24 h without a confirmation raises check `DT-OPEN`.

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

1. **Role** (as today): which tabs they see and whether they can edit them. Four roles are added: **Shift leader**, **Production manager**, **Reliability engineer**, **Quality engineer**.
2. **Responsibilities** (new, table `responsibilities`): which duty they hold **for which part of the plant**.

| Duty | Meaning |
|---|---|
| `shift_entry` | Enters shift reports for the scope |
| `production_review` | Reviews and approves shift reports for the scope |
| `reliability_validation` | Validates shift reports for the scope |
| `production_data` | Enters and corrects production, power, fuel, water and stock values for the scope |
| `quality_validation` | Enters and validates laboratory results and quality limits for the scope |
| `month_review` | Section engineer: reviews the month of a section (downtime, production, quality) |
| `month_signoff` | Section manager: signs off and locks the month of a section; plant manager for the plant report |
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

* Whether the production values (production, running hours, power, fuel) are also entered on the shift report or only come from the DCS report (Stage 2, waiting for the DCS report).

## Decided while building (2.1.0)

* **The Admin role may do every step** (enter, approve, validate) for any area, for set-up and testing. Everyone else needs the duty for the area on the report date.
* **Nobody approves their own report:** the person who entered or submitted a report cannot give it the production approval (the Admin role aside).
* **A reliability return goes back to production**, not to the shift leader; production may then return it to the shift leader.
* **Draft first, then submit.** A draft may hold unfinished rows. Submitting, approving and validating are refused while a stoppage has a blocking problem (no classification, an unknown classification, a restart before the stop).
* **PL and CIR are never failures**; criticality follows the classification (PRO, MEC, ELE, AUT = INC).
* **Times:** a stop must start inside the shift; a restart typed in a shift may not be after its end (leave it blank, the later shift enters it); nothing in the future.
* **Posting:** a stoppage goes into the downtime analysis when it is closed and both its own report and the report that entered its restart are validated. It becomes an event with origin `shift`, its batch is the report id. When the same stop is already stored (for example the month's workbook was also uploaded) the two are linked and nothing is added twice. A report whose stoppages are all posted becomes *In the downtime analysis*.
* **Daily meeting:** one production day runs from 08:00 to 08:00. Figures come from the shift reports at whatever step they are, marked provisional until validated. An area counts as "in use" once it has a shift report in the last 7 days; areas not in use are listed but not counted as late.
