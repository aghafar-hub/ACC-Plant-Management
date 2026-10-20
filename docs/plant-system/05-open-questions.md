# Open questions

Questions waiting for an answer. Each answer is written here with the date and who gave it.

## QCX (laboratory system)

Ask the laboratory or whoever runs QCX.

| # | Question | Why it matters | Answer |
|---|---|---|---|
| Q1 | Can QCX export **each laboratory result with its sample time**, or only one average per day? | With only daily averages the app cannot count out-of-spec results correctly, and the stability figures (standard deviation) look better than they are. | |
| Q2 | If yes: in what format (Excel, CSV, a report you can schedule), and can it be sent automatically every day? | Decides whether results are uploaded by hand or arrive by themselves. | |
| Q3 | How often is each material sampled (raw meal, kiln feed, hot meal, clinker, coal / petcoke, cement)? E.g. every hour, every 2 hours, once a shift. | Sets the expected samples per day; too few raises a check. | |
| Q4 | Does each result carry the **product** (OPC, SRC …) and, for cement, the **silo**? | Quality figures must be given per product, never mixed. | |
| Q5 | Are the **specification limits and aims** kept in QCX? If yes, can they be exported? | They could be loaded once instead of typed in Settings › Quality limits. | |
| Q6 | Are cement **strength** results (2, 7, 28 days) in QCX? | Strength is the main cement quality figure but is not in the daily QCX sheet. | |
| Q7 | Are values like "--" (no analysis) and repeated results (same value carried over) normal in the export? | Decides whether they are treated as "no sample" or as an error. | |
| Q8 | Is "Volatility" in the hot meal columns the sulphur volatility (a ratio from 0 to 1)? And are the sieve residues at 90 µm (raw meal, coal) and 45 µm (cement)? | Confirms the units shown in the app. | |

## Other open points

| # | Question | Answer |
|---|---|---|
| O1 | The DCS automated report (PLG_1 / PLG_2): a sample file. | Owner will send it |
| O2 | OEE: is it wanted, and what counts as good quality (e.g. 1 − isolated clinker ÷ clinker)? | |
| O3 | Names of the engineer and manager of each section (downtime, production, quality) and the plant manager, for the month-end closing. | Entered on the Users page later |
| O4 | Quality specification limits and aims. | Entered later in Settings › Quality limits |
| O5 | December 2025 downtime: missing (the NRS file ends on 30 Nov 2025, the database starts on 1 Jan 2026). Shown as "not uploaded", so it does not distort the figures. Owner will add the file later: a monthly workbook goes through the normal Upload; from a newer NRS file, Upload › History import now lets you tick December 2025 only (2.3.0). | Later |
| O6 | Quality limits are kept per mill (CM.1 … CM.4), not per product. If OPC and SRC have different cement limits, the parameters need a product (see Q4). | |
| O7 | Month closing for production and quality: those sections have no data in the app yet, so their closing records the sign-off only. Their locks start when production and quality data are entered in the app (Stage 2). | |
