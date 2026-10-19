# Rules for every section of the plant

The first version of the rules covered downtime and reliability only. This page adds production, energy, fuel, water, stocks, materials and quality, and the checks that tie the sections together.

## How the rules work (all sections)

1. **Enter once, at the source.** Each value has one owner: stoppages the shift leader, production values the DCS report (corrections by the production team), laboratory results the quality team.
2. **A check never changes a value.** A rule raises a *data check* (table `data_checks`). The duty named on the rule reviews it and either **accepts** the value (with a comment), **corrects** it (old and new value kept) or **dismisses** the check.
3. **Three levels.** `block` — must be fixed before the report or day can be approved. `warn` — needs a fix or a comment before approval. `info` — shown, nothing required.
4. **Two reviews before a value is final.** Every section goes through the same steps as the shift report: entered → reviewed by production (or quality for lab results) → validated. Dashboards show provisional values with a mark until then.
5. **Limits live in the database.** Every threshold below is a row in `check_rules`, and the limits of each measured value are rows in `production_metrics` or `quality_parameters`. They are changed in the app by the duty `master_data` (or `targets`), with the change logged — never in a formula.
6. **Deadlines per section.** Shift report 2 h after the shift, production review 12 h, reliability and quality validation 48 h (settings). Anything late appears in the daily meeting and counts in the *Data on time* KPI.

## Who reviews what

| Section | Entered by | Reviewed by | Validated by |
|---|---|---|---|
| Downtime | Shift leader (`shift_entry`) | Production manager (`production_review`) | Reliability engineer (`reliability_validation`) |
| Production, energy, fuel, water, stocks, materials | DCS report import; corrections by `production_data` | Production manager (`production_review`) | Production manager closes the day; monthly figures signed off by the plant manager |
| Quality | Laboratory / QCX import (`quality_validation`) | Quality engineer (`quality_validation`) | Quality manager (`quality_validation`, scope plant) |
| Targets and limits | `targets` / `master_data` | — | Logged with who and when |

## The checks, section by section

Thresholds are starting values to confirm with each section owner. A blank threshold means the limit comes from the metric or parameter itself (its min / max or specification).

### Downtime

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `DT-ORDER` **Restart before stop** | The restart time is before the stop time | all | from the limits | block | shift_entry |
| `DT-CLASS` **No classification** | PRO, MEC, ELE, AUT, PL or CIR is missing | all | from the limits | block | shift_entry |
| `DT-CODE` **Unknown equipment code** | The code is not in the equipment master of the area | all | from the limits | warn | reliability_validation |
| `DT-REASON` **No reason** | The reason is blank or not in the reason list | all | from the limits | warn | reliability_validation |
| `DT-OVERLAP` **Overlapping stops** | Two stops of one area overlap; the hours are counted once | all | from the limits | info | reliability_validation |
| `DT-OPEN` **Long open stop** | A stop is still open after this many hours; the current shift confirms it is still stopped | all | 24 h | warn | shift_entry |
| `DT-DUP` **Same stop twice** | Same area, equipment and stop time entered twice | all | from the limits | block | shift_entry |

### Production

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `PR-MISSING` **Value missing** | A required production value is missing for the day | all | from the limits | warn | production_data |
| `PR-NEG` **Negative value** | Production, running hours, power, fuel and water cannot be negative | all | 0 | block | production_data |
| `PR-RANGE` **Outside the limits** | The value is outside the min / max of the metric (production_metrics) | all | from the limits | warn | production_data |
| `PR-RH24` **Running hours above the day** | Running hours of an area above 24 h in a day | all | 24 h | block | production_data |
| `PR-NORH` **Production without running** | Production above 0 while the running hours are 0, or the opposite | all | from the limits | warn | production_data |
| `PR-RATE` **Rate far from target** | Production rate differs from the target rate by more than this | all | 25 % | warn | production_review |
| `PR-JUMP` **Sudden change** | The value changed by more than this against the day before | all | 50 % | info | production_data |
| `PR-CORR` **Large correction** | A correction above this share of the raw value needs a reason and the production manager's approval | all | 5 % | warn | production_review |

### Energy

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `EN-SPC` **SPC above the limit** | Specific power above the metric limit: flagged for review, never set to 0 | all | from the limits | warn | production_data |
| `EN-NOPROD` **Power without production** | Process power used while production is 0 (standby losses) | all | from the limits | info | production_data |
| `EN-METER` **Meters do not add up** | Sum of the area meters differs from the transformer meters by more than this | all | 5 % | warn | production_data |

### Fuel and heat

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `FU-SHC` **SHC above the limit** | Specific heat above the limit: flagged, never set to 0 | K.1,K.2 | 1500 kcal/kg | warn | production_data |
| `FU-CV` **No calorific value** | A fuel was used on a day that has no calorific value | K.1,K.2 | from the limits | block | production_data |
| `FU-TSR` **TSR outside 0-100 %** | Thermal substitution rate below 0 or above 100 % | K.1,K.2 | from the limits | block | production_data |

### Water

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `WA-SWC` **SWC above the limit** | Specific water above the limit: flagged, never set to 0 | all | 500 l/t | warn | production_data |

### Stocks (silos and tanks)

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `ST-LEVEL` **Level outside 0-100 %** | A silo or tank level below 0 or above 100 % | all | from the limits | block | production_data |
| `ST-JUMP` **Level jump** | A level changed by more than this in a day without matching production or use | all | 30 points | warn | production_data |
| `ST-BAL` **Stock does not balance** | Opening + in − out differs from closing stock by more than this | all | 5 % | warn | production_review |

### Materials and cement recipes

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `MA-CLK` **Clinker balance gap** | Clinker produced − used by the mills − change in stock, above this share of production | K.1,K.2,CM.1,CM.2,CM.3,CM.4 | 3 % | warn | production_review |
| `MA-MIX` **Mix does not add up** | Raw mix or cement recipe shares do not add up to 100 % | RM.1,RM.2,CM.1,CM.2,CM.3,CM.4 | 0.5 % | block | production_data |
| `MA-CF` **Clinker factor out of range** | The clinker factor used for the day is outside this range (1.50 - 1.75) | K.1,K.2 | from the limits | warn | production_review |

### Quality

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `QU-VALID` **Impossible result** | Result outside the valid range of the parameter: most likely a typing or analyser error | all | from the limits | block | quality_validation |
| `QU-SPEC` **Out of specification** | Result outside the specification limits; counted in the in-spec KPIs and shown in the daily meeting | all | from the limits | warn | quality_validation |
| `QU-COUNT` **Too few samples** | Fewer results than samples_per_day while the area was running | all | from the limits | warn | quality_validation |
| `QU-STUCK` **Same value repeated** | The same value this many times in a row: analyser or copy error | all | 4 results | info | quality_validation |
| `QU-STOPPED` **Results while stopped** | Results recorded for an area that was stopped the whole day | all | from the limits | info | quality_validation |

### Across sections

| Rule | Check | Applies to | Threshold | Level | Reviewed by |
|---|---|---|---|---|---|
| `XS-RH` **Running hours disagree** | DCS running hours differ from scheduled minus stoppage hours by more than this | all | 1 h/day | warn | reliability_validation |
| `XS-STOPPROD` **Production during a stop** | Production recorded while the stoppage log shows the area stopped the whole day | all | from the limits | warn | production_review |
| `XS-LATE` **Report late** | A shift report, production value or lab result is past its deadline | all | from the limits | info | daily_meeting |

## Quality section design

### What is measured

`quality_parameters` is seeded with the 52 columns of the QCX export (raw meal, kiln feed, hot meal, clinker, coal / petcoke and cement of each area). Each parameter has:

* **Specification limits** (`spec_min`, `spec_max`) and **aim** (`target`) — to be entered by the quality department; they drive the in-spec KPIs and the `QU-SPEC` check.
* **Valid range** (`valid_min`, `valid_max`) — physically possible values (e.g. LSF 80–120). A result outside it is almost certainly a typing or analyser error and blocks approval (`QU-VALID`). Seeded with starting values to confirm.
* **Samples per day** — how many results are expected while the area runs (`QU-COUNT`).

| Material | Area | Parameters (from QCX) |
|---|---|---|
| Raw meal | RM.1, RM.2 | LSF, SM, AM, sieve residue, MgO, SO3, Cl |
| Kiln feed | K.1, K.2 | LSF, SO3, Cl |
| Hot meal | K.1, K.2 | SO3, Cl, SO3 volatility |
| Clinker | K.1, K.2 | LSF, SO3, free lime, C3S, C2S |
| Coal, petcoke | FM.1, FM.2 | Sieve residue |
| Cement | CM.1 – CM.4 | Sieve residue, SO3, Blaine |

### How results come in

1. **Now:** the QCX daily averages are imported (basis `daily_avg`), the same file the Daily Shift Report uses.
2. **Better:** each laboratory result with its sample time (basis `sample`), from a QCX export per sample or entered by the laboratory. Standard deviations and in-spec shares are only meaningful on individual samples.
3. Results are linked to the shift by their sample time, so the daily meeting can show quality next to the stoppages of the same shift.

### Quality KPIs (draft)

| KPI | Formula | Why |
|---|---|---|
| **Raw meal LSF standard deviation** | Standard deviation of the raw meal LSF results of the period | Needs each sample (hourly), not daily averages: the spread of daily averages hides most of the variation. |
| **Kiln feed LSF standard deviation** | Standard deviation of the kiln feed LSF results | Main measure of kiln feed stability. |
| **Clinker free lime** | Average of the clinker free lime results | Too high = under-burnt, too low = over-burnt (fuel lost). |
| **Clinker free lime in specification** | Results inside the free lime limits ÷ all results | Limits from quality_parameters. |
| **Clinker C3S** | Average of the clinker C3S results |  |
| **Hot meal SO3** | Average of the hot meal SO3 results | Early warning of build-up in the preheater. |
| **Isolated (off-spec) clinker** | Isolated clinker tons ÷ clinker tons | From the kiln isolated-clinker value (NRS column Isolated Clinker). |
| **Coal and petcoke fineness** | Average sieve residue of the ground coal / petcoke |  |
| **Cement Blaine standard deviation** | Standard deviation of the cement Blaine results, per product | Per cement type: OPC and SRC must not be mixed in one figure. |
| **Cement SO3 in specification** | Cement SO3 results inside the limits ÷ all results |  |
| **Quality conformance** | All results inside their specification ÷ all results with a specification | One summary figure per area for the daily meeting. |

### Links with the other sections

* **Quality ↔ downtime:** a stop with reason *material chemistry* or *high free lime* is shown next to the results of the hours before it.
* **Quality ↔ production:** isolated (off-spec) clinker is subtracted from good clinker; cement results are given per product and silo.
* **Quality ↔ fuel:** free lime and C3S are shown with SHC, because burning harder to fix free lime costs heat.

## Still to agree

1. Specification limits and aims for each quality parameter (quality department).
2. Starting thresholds of the checks above (each section owner).
3. Whether QCX can export each sample with its time, or only daily averages.
4. Who signs off the month for each section (proposed: production manager for production, quality manager for quality, reliability for downtime).
