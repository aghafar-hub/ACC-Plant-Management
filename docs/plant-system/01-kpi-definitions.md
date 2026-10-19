# Stage 0 — KPI definitions (draft for review)

Each KPI below was read from the NRS reporting workbook (sheets MS.KPIS, CR, RM, FM, K, CM) and set against what the app calculates today.
The same list is seeded in the database (`kpi_definitions`, status `draft`) so the review result is stored next to the data.
Nothing here changes how the current app calculates; the agreed definitions are applied in later stages.

## How to review

For each row: confirm the **formula**, answer the **open point**, and name the **owner** who approves it.
An approved KPI gets status `approved`, the approver and the date in `kpi_definitions`.

## Rules that apply to every KPI

1. **Ratio of sums.** A month, year, line or plant value is the ratio of the summed numerator and denominator, never the average of daily or area ratios. The NRS workbook mixes both, which makes month values disagree with the days they come from.
2. **No silent zeros.** NRS sets some values to 0 when they pass a limit (SHC above 1500, SWC above 500, kiln SPC above 100). The app keeps the value and raises a data check for review instead.
3. **No value is not the target.** NRS returns the target when MTBF or MTTR cannot be calculated (no failures). The app shows “no failures” instead.
4. **One source of targets.** Targets live in `kpi_targets` (scope × KPI × year × month). NRS has hard-coded targets in MS.KPIS that disagree with its own target sheets.
5. **Every correction has a reason.** NRS adds `*_Corr` columns without a reason or approver. In the app a correction is a row in `production_corrections` (old value, new value, reason, requested by, approved by).
6. **Overlaps once.** Stops of one area that overlap are counted once (priority PL > INC > CIR), so stoppage hours can be lower than the NRS sum of rows.

## The KPIs

### Downtime and reliability

| KPI | Unit | Proposed formula | NRS today | App today | Open point |
|---|---|---|---|---|---|
| **Scheduled hours** (`T_H`) | h | Calendar hours of the period x scheduled hours per day ÷ 24 (today 24 h a day, 7 days a week) | Available RRHH = days in month x 24 | scheduled_hours_per_day x scheduled days | Same today. Decide whether an area that is not needed (e.g. a mill with full silos) is still scheduled. |
| **Stoppage hours** (`STOP_H`) | h | Hours stopped in the period; stops that overlap in one area are counted once | SUMIFS of TOTAL STOPPAGE DURATION (h) - overlapping rows are added twice | Merged per area, so overlaps count once (priority PL > INC > CIR) | Use the app rule (overlaps once). NRS hours can be higher where rows overlap. |
| **Running hours** (`RUN_H`) | h | Scheduled hours − stoppage hours | Available RRHH − Stoppage Time | T − (PL + INC + CIR), overlaps once | Same idea. Later compare with DCS running hours (see RH_DCS) as a data check. |
| **Incident hours** (`INC_H`) | h | Hours of stops with criticality INC (PRO, MEC, ELE, AUT) | SUMIFS ... CRITICALITY = "INC" | Classification PRO/MEC/ELE/AUT | Same. |
| **Planned hours** (`PL_H`) | h | Hours of planned stops (PL) | SUMIFS ... classification PL | Classification PL | Same. |
| **Circumstantial hours** (`CIR_H`) | h | Hours of circumstantial stops (CIR: power cut, gas or water shortage, full silos ...) | SUMIFS ... classification CIR | Classification CIR | Same. |
| **Stop frequency (failures)** (`FAILURES`) | count | Number of failure events: Freq = 1, Failure = YES and not PL or CIR | COUNTIFS Failure = "YES" (every row, including continuation rows and PL/CIR rows marked YES) | Freq = 1, Failure = YES, not PL/CIR | Use the app rule. NRS counts continuation rows and dirty YES labels, so its frequency is higher. |
| **Utilization factor (UF)** (`UF`) | % | Running hours ÷ scheduled hours | Run ÷ (Run + Stop) = Run ÷ RRHH | Run ÷ T (availability basis A) | Same formula. Month and year values must be ratio of sums, never the average of daily ratios. |
| **Reliability factor (RF)** (`RF`) | % | Running hours ÷ (running hours + incident hours) | IFERROR(Run ÷ (Run + INC), 0) | Run ÷ (Run + INC) (availability basis C) | Same formula. NRS shows 0 when there is no running and no incident; the app shows no value (—). |
| **Equipment availability (EA)** (`EA`) | % | (Running hours + circumstantial hours) ÷ scheduled hours | (Run + CIR) ÷ (Run + Stop) | Not in the app yet | New for the app. Note that planned stops count as lost time in EA; agree that this is intended. |
| **Mean time between failures (MTBF)** (`MTBF`) | h | Running hours ÷ failure events | IFERROR(Run ÷ Stop Frequency, MTBF TARGET) | Run ÷ failure events; no failures = no value | Use the app rule: with no failures show "no failures", never the target (NRS shows the target, which looks like the target was met exactly). |
| **Mean time to repair (MTTR)** (`MTTR`) | h | Failure-event hours ÷ failure events | IFERROR(INC hours ÷ Stop Frequency, MTTR TARGET) | Duration of failure events ÷ failure events | Decide the numerator: NRS uses all INC hours (also INC rows that are not failures); the app uses the hours of the failure events only. |

### Production

| KPI | Unit | Proposed formula | NRS today | App today | Open point |
|---|---|---|---|---|---|
| **Production** (`PROD_T`) | t | Tons produced by the area in the period (DCS weigh feeders + recorded correction) | CR: crusher feed + correction. RM: weigh feeders split OPC/SRC by the mix of the day, dry basis. FM: WF450 + WF550 by coal/petcoke mix. K: see CLK_T. CM: weigh feeders to each silo x running-hour factor | Not in the app yet | Each area keeps the NRS method; every correction gets a reason and an approver (production_corrections). |
| **Clinker production** (`CLK_T`) | t | (Kiln feed + correction) ÷ clinker factor + ash from fuels | Prod WO Ash = (kiln feed + correction ...) ÷ CF (PLG-CF, Manual-CF or Calculated-CF); Prod = Prod WO Ash + fuel ash tons | Not in the app yet | Agree which clinker factor is used and who may change it; store it per day with its source. |
| **Running hours (DCS)** (`RH_DCS`) | h | Running hours counted by the DCS + recorded correction | Tag + correction table | Not in the app yet | Compare every day with RUN_H from the stoppage log; a gap above a set limit raises a data check. |
| **Production rate** (`RATE`) | t/h | Production ÷ DCS running hours | Prod ÷ R H (0 when RH = 0) | Not in the app yet | Ratio of sums for month and year. |
| **Performance factor (PF)** (`PF`) | % | Actual rate ÷ target rate | Actual rate ÷ target rate | Not in the app yet | Target rate per area and month in kpi_targets. |
| **Overall equipment effectiveness (OEE)** (`OEE`) | % | UF x PF x quality rate | Not in NRS | Not in the app | Optional. Needs an agreed quality rate (e.g. 1 − isolated clinker ÷ clinker). |

### Energy and water

| KPI | Unit | Proposed formula | NRS today | App today | Open point |
|---|---|---|---|---|---|
| **Specific power consumption (SPC)** (`SPC`) | kWh/t | Total power (process + auxiliary) x 1000 ÷ production | Total Pwr x 1000 ÷ Prod; kiln sets values above 100 to 0 | Not in the app yet | Values outside the limit are flagged for review, never set to 0. |
| **Specific water consumption (SWC)** (`SWC`) | l/t | Water (m³) x 1000 ÷ production | Water x 1000 ÷ Prod; kiln sets values above 500 to 0 | Not in the app yet | Flag above the limit instead of 0. |

### Fuel and heat

| KPI | Unit | Proposed formula | NRS today | App today | Open point |
|---|---|---|---|---|---|
| **Specific heat consumption (SHC)** (`SHC`) | kcal/kg clinker | (Fossil heat + alternative-fuel heat) ÷ (clinker x 1000) | SUM(fossil, AF heat) ÷ (Prod x 1000); values above 1500 set to 0 | Not in the app yet | Flag above the limit instead of 0. Check the Diesel heat column, which uses the calciner natural-gas volume. |
| **Thermal substitution rate (TSR)** (`TSR`) | % | Alternative-fuel heat ÷ total heat | AF heat ÷ (fossil + AF heat) | Not in the app yet | Same. |

### Cement

| KPI | Unit | Proposed formula | NRS today | App today | Open point |
|---|---|---|---|---|---|
| **Grinding aid dosage** (`GA`) | g/t | Grinding aid grams ÷ cement tons | Dosage g/day ÷ tons to the silos | Not in the app yet | Same. |
| **Clinker in cement** (`CLK_FACTOR`) | % | Clinker tons ÷ cement tons | From the cement mill material balance | Not in the app yet | Same. |

## Issues found in the NRS workbook

| # | Where | Issue | Effect | Proposal |
|---|---|---|---|---|
| 1 | K.1 heat input, Diesel column | Diesel heat is calculated from the **calciner natural-gas volume** × the diesel calorific value | SHC and TSR of kiln 1 may be wrong on days with calciner gas | Check with the process team; in the app each fuel uses its own volume |
| 2 | Cement mill SPC | The brackets of the power sum (silo 1 + silo 2) look misplaced — to be confirmed with the owner of the sheet | SPC may count only part of the power | Recalculate from the raw values and compare a few days |
| 3 | Kiln SHC, SWC, SPC | Values above a limit are set to 0 | Bad days disappear from the averages | Flag, do not zero (rule 2) |
| 4 | MS.KPIS MTBF / MTTR | IFERROR returns the target | A month without failures shows exactly the target | Rule 3 |
| 5 | MS.KPIS targets | Hard-coded and different from the target sheets | Two answers to “what is the target?” | Rule 4 |
| 6 | Several sheets | About 2,000 error cells (#REF!, #DIV/0!, #VALUE!), some hidden | Some totals silently skip days | Values imported only after checks |
| 7 | Power Query sources | Paths point to a folder on one personal computer | The workbook refreshes only on that computer | DCS report uploaded to the app (Stage 2) |
| 8 | MS.Downtime | Date only (no stop or restart times), labels written in different ways (Yes / YES, leading spaces), 66 duplicate rows | Overlaps and shift split cannot be checked | History import with `time_precision = day`, labels cleaned on import, duplicates reported |
| 9 | Stop frequency | Counts every row with Failure = YES, including continuation rows and PL / CIR rows | Frequency too high, MTBF too low | App rule (Freq = 1, not PL / CIR) |

## What the app shows today (unchanged)

RF = Run ÷ (Run + INC), UF = Run ÷ T, availability (basis B) = (T − PL − INC − CIR) ÷ (T − PL), MTBF = Run ÷ failure events, MTTR = failure-event hours ÷ failure events. These stay until the review is approved.
