# Stage 0 — KPI definitions

Each KPI below was read from the NRS reporting workbook (sheets MS.KPIS, CR, RM, FM, K, CM) and set against what the app calculates today.
The same list is seeded in the database (`kpi_definitions`, status `draft`) so the review result is stored next to the data.
**Status:** the 24 reliability, production, energy and fuel KPIs were approved on 2026-10-19 as proposed (MTTR: failure-event hours ÷ failure events; EA: planned stops count as lost time, as NRS). OEE stays open. The quality, materials, stock and data KPIs were added after the review and are drafts. Nothing here changes how the current app calculates until the new screens use it.

## How to review

For each row: confirm the **formula**, answer the **open point**, and name the **owner** who approves it.
An approved KPI gets status `approved`, the approver and the date in `kpi_definitions`.

## Calculation rules for every KPI

The data-check rules of every section (downtime, production, energy, fuel, water, stocks, materials, quality) are in [04-rules-all-sections.md](04-rules-all-sections.md).

1. **Ratio of sums.** A month, year, line or plant value is the ratio of the summed numerator and denominator, never the average of daily or area ratios. The NRS workbook mixes both, which makes month values disagree with the days they come from.
2. **No silent zeros.** NRS sets some values to 0 when they pass a limit (SHC above 1500, SWC above 500, kiln SPC above 100). The app keeps the value and raises a data check for review instead.
3. **No value is not the target.** NRS returns the target when MTBF or MTTR cannot be calculated (no failures). The app shows “no failures” instead.
4. **One source of targets.** Targets live in `kpi_targets` (scope × KPI × year × month). NRS has hard-coded targets in MS.KPIS that disagree with its own target sheets.
5. **Every correction has a reason.** NRS adds `*_Corr` columns without a reason or approver. In the app a correction is a row in `production_corrections` (old value, new value, reason, requested by, approved by).
6. **Overlaps once.** Stops of one area that overlap are counted once (priority PL > INC > CIR), so stoppage hours can be lower than the NRS sum of rows.
7. **Quality statistics on samples.** Averages, standard deviations and in-spec shares are worked out from each laboratory result, weighted equally. Where only the QCX daily average exists the figure is marked *daily basis*, because the spread of daily averages hides most of the real variation.
8. **One product per figure.** Cement and raw-meal figures are given per product (OPC, SRC …); a month that mixes products shows each one, never a blend.
9. **Running days only.** Specific consumptions and quality figures of an area use the days or samples when it ran; a stopped day is not a zero.

## The KPIs

### Downtime and reliability

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Scheduled hours** (`T_H`) | h | Calendar hours of the period x scheduled hours per day ÷ 24 (today 24 h a day, 7 days a week) | sum | Available RRHH = days in month x 24 | **approved** — Agreed as proposed. Same today. Decide whether an area that is not needed (e.g. a mill with full silos) is still scheduled. |
| **Stoppage hours** (`STOP_H`) | h | Hours stopped in the period; stops that overlap in one area are counted once | sum | SUMIFS of TOTAL STOPPAGE DURATION (h) - overlapping rows are added twice | **approved** — Agreed: overlaps counted once. |
| **Running hours** (`RUN_H`) | h | Scheduled hours − stoppage hours | sum | Available RRHH − Stoppage Time | **approved** — Agreed as proposed. Same idea. Later compare with DCS running hours (see RH_DCS) as a data check. |
| **Incident hours** (`INC_H`) | h | Hours of stops with criticality INC (PRO, MEC, ELE, AUT) | sum | SUMIFS ... CRITICALITY = "INC" | **approved** — Agreed as proposed. Same. |
| **Planned hours** (`PL_H`) | h | Hours of planned stops (PL) | sum | SUMIFS ... classification PL | **approved** — Agreed as proposed. Same. |
| **Circumstantial hours** (`CIR_H`) | h | Hours of circumstantial stops (CIR: power cut, gas or water shortage, full silos ...) | sum | SUMIFS ... classification CIR | **approved** — Agreed as proposed. Same. |
| **Stop frequency (failures)** (`FAILURES`) | count | Number of failure events: Freq = 1, Failure = YES and not PL or CIR | sum | COUNTIFS Failure = "YES" (every row, including continuation rows and PL/CIR rows marked YES) | **approved** — Agreed: app rule (Freq = 1, Failure = YES, not PL/CIR). |
| **Utilization factor (UF)** (`UF`) | % | Running hours ÷ scheduled hours | ratio of sums | Run ÷ (Run + Stop) = Run ÷ RRHH | **approved** — Agreed: ratio of sums. |
| **Reliability factor (RF)** (`RF`) | % | Running hours ÷ (running hours + incident hours) | ratio of sums | IFERROR(Run ÷ (Run + INC), 0) | **approved** — Agreed: no value (—) when there is nothing to divide. |
| **Equipment availability (EA)** (`EA`) | % | (Running hours + circumstantial hours) ÷ scheduled hours | ratio of sums | (Run + CIR) ÷ (Run + Stop) | **approved** — Agreed as NRS: planned stops count as lost time. |
| **Mean time between failures (MTBF)** (`MTBF`) | h | Running hours ÷ failure events | ratio of sums | IFERROR(Run ÷ Stop Frequency, MTBF TARGET) | **approved** — Agreed: "no failures" instead of the target. |
| **Mean time to repair (MTTR)** (`MTTR`) | h | Failure-event hours ÷ failure events | ratio of sums | IFERROR(INC hours ÷ Stop Frequency, MTTR TARGET) | **approved** — Agreed: failure-event hours ÷ failure events (same events as MTBF). Incident hours stay visible as INC_H. |

### Production

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Production** (`PROD_T`) | t | Tons produced by the area in the period (DCS weigh feeders + recorded correction) | sum | CR: crusher feed + correction. RM: weigh feeders split OPC/SRC by the mix of the day, dry basis. FM: WF450 + WF550 by coal/petcoke mix. K: see CLK_T. CM: weigh feeders to each silo x running-hour factor | **approved** — Agreed as proposed. Each area keeps the NRS method; every correction gets a reason and an approver (production_corrections). |
| **Clinker production** (`CLK_T`) | t | (Kiln feed + correction) ÷ clinker factor + ash from fuels | sum | Prod WO Ash = (kiln feed + correction ...) ÷ CF (PLG-CF, Manual-CF or Calculated-CF); Prod = Prod WO Ash + fuel ash tons | **approved** — Agreed as proposed. Agree which clinker factor is used and who may change it; store it per day with its source. |
| **Running hours (DCS)** (`RH_DCS`) | h | Running hours counted by the DCS + recorded correction | sum | Tag + correction table | **approved** — Agreed as proposed. Compare every day with RUN_H from the stoppage log; a gap above a set limit raises a data check. |
| **Production rate** (`RATE`) | t/h | Production ÷ DCS running hours | ratio of sums | Prod ÷ R H (0 when RH = 0) | **approved** — Agreed as proposed. Ratio of sums for month and year. |
| **Performance factor (PF)** (`PF`) | % | Actual rate ÷ target rate | ratio of sums | Actual rate ÷ target rate | **approved** — Agreed as proposed. Target rate per area and month in kpi_targets. |
| **Overall equipment effectiveness (OEE)** (`OEE`) | % | UF x PF x quality rate | ratio of sums | Not in NRS | **draft** — Optional, still open: needs an agreed quality rate (e.g. 1 − isolated clinker ÷ clinker). |

### Energy

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Specific power consumption (SPC)** (`SPC`) | kWh/t | Total power (process + auxiliary) x 1000 ÷ production | ratio of sums | Total Pwr x 1000 ÷ Prod; kiln sets values above 100 to 0 | **approved** — Agreed: flag above the limit, never 0. |

### Fuel and heat

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Specific heat consumption (SHC)** (`SHC`) | kcal/kg clinker | (Fossil heat + alternative-fuel heat) ÷ (clinker x 1000) | ratio of sums | SUM(fossil, AF heat) ÷ (Prod x 1000); values above 1500 set to 0 | **approved** — Agreed: flag above the limit, never 0; each fuel uses its own volume. |
| **Thermal substitution rate (TSR)** (`TSR`) | % | Alternative-fuel heat ÷ total heat | ratio of sums | AF heat ÷ (fossil + AF heat) | **approved** — Agreed as proposed. Same. |

### Water

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Specific water consumption (SWC)** (`SWC`) | l/t | Water (m³) x 1000 ÷ production | ratio of sums | Water x 1000 ÷ Prod; kiln sets values above 500 to 0 | **approved** — Agreed: flag above the limit, never 0. |

### Materials and cement

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Grinding aid dosage** (`GA`) | g/t | Grinding aid grams ÷ cement tons | ratio of sums | Dosage g/day ÷ tons to the silos | **approved** — Agreed as proposed. Same. |
| **Clinker in cement** (`CLK_FACTOR`) | % | Clinker tons ÷ cement tons | ratio of sums | From the cement mill material balance | **approved** — Agreed as proposed. Same. |
| **Clinker balance gap** (`MAT_CLK_BAL`) | % | (Clinker produced − clinker used by the mills − change in clinker stock) ÷ clinker produced | ratio of sums | Not in NRS | **draft** — Shows whether kiln production, mill consumption and stock agree; a large gap means one of them is wrong. |

### Stocks

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Clinker stock cover** (`STK_CLK_DAYS`) | days | Clinker stock ÷ average daily clinker use of the last 30 days | last | Not in NRS | **draft** — Value at the end of the period. |

### Quality

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Raw meal LSF standard deviation** (`Q_LSF_SD`) | - | Standard deviation of the raw meal LSF results of the period | std dev | Not in NRS (QCX daily averages only) | **draft** — Needs each sample (hourly), not daily averages: the spread of daily averages hides most of the variation. |
| **Kiln feed LSF standard deviation** (`Q_KF_LSF_SD`) | - | Standard deviation of the kiln feed LSF results | std dev | Not in NRS (QCX daily averages only) | **draft** — Main measure of kiln feed stability. |
| **Clinker free lime** (`Q_FL_AVG`) | % | Average of the clinker free lime results | average | Not in NRS (QCX daily averages only) | **draft** — Too high = under-burnt, too low = over-burnt (fuel lost). |
| **Clinker free lime in specification** (`Q_FL_IN_SPEC`) | % | Results inside the free lime limits ÷ all results | share in spec | Not in NRS (QCX daily averages only) | **draft** — Limits from quality_parameters. |
| **Clinker C3S** (`Q_C3S_AVG`) | % | Average of the clinker C3S results | average | Not in NRS (QCX daily averages only) | **draft** —  |
| **Hot meal SO3** (`Q_HM_SO3`) | % | Average of the hot meal SO3 results | average | Not in NRS (QCX daily averages only) | **draft** — Early warning of build-up in the preheater. |
| **Isolated (off-spec) clinker** (`Q_ISO_CLK`) | % | Isolated clinker tons ÷ clinker tons | ratio of sums | Not in NRS (QCX daily averages only) | **draft** — From the kiln isolated-clinker value (NRS column Isolated Clinker). |
| **Coal and petcoke fineness** (`Q_FUEL_FINE`) | % residue | Average sieve residue of the ground coal / petcoke | average | Not in NRS (QCX daily averages only) | **draft** —  |
| **Cement Blaine standard deviation** (`Q_BLAINE_SD`) | cm²/g | Standard deviation of the cement Blaine results, per product | std dev | Not in NRS (QCX daily averages only) | **draft** — Per cement type: OPC and SRC must not be mixed in one figure. |
| **Cement SO3 in specification** (`Q_CEM_SO3_IN_SPEC`) | % | Cement SO3 results inside the limits ÷ all results | share in spec | Not in NRS (QCX daily averages only) | **draft** —  |
| **Quality conformance** (`Q_CONFORMANCE`) | % | All results inside their specification ÷ all results with a specification | share in spec | Not in NRS (QCX daily averages only) | **draft** — One summary figure per area for the daily meeting. |

### Data and reporting

| KPI | Unit | Formula | How periods add up | NRS today | Status and decision |
|---|---|---|---|---|---|
| **Data on time** (`DQ_ON_TIME`) | % | Required values and reports entered and approved by their deadline ÷ all required | ratio of sums | Not in NRS | **draft** — Measures the reporting itself; shown per area and per duty. |
| **Open data checks** (`DQ_OPEN_CHECKS`) | count | Data checks still open at the end of the period | last | Not in NRS | **draft** —  |

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
