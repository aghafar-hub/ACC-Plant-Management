# Plant-system Apps Script (backend 2.0.0)

The two files to copy into the **plant-system** Apps Script project — the one attached to the *copy* of the database.
Never paste them into the live or the test project.

| File | Where it goes in the Apps Script editor |
|---|---|
| `Code.gs` | Replace the whole content of `Code.gs` |
| `appsscript.json` | Project Settings › tick *Show "appsscript.json"*, then replace its content |

`Code.gs` is generated from `backend/apps-script/` by `node tools/bundle-apps-script.mjs deploy/plant-apps-script/Code.gs`.
Do not edit it by hand: a backend test fails when it is out of date with the source files.

Set-up steps: [docs/plant-system/03-database-v7.md](../../docs/plant-system/03-database-v7.md).

## Updating to a new version

1. Replace `Code.gs` (and `appsscript.json` if it changed) with the files of this folder.
2. Run `ensureSchema`, then `seedDefaults` (they only add what is missing: tables, columns, the page access of new pages, seeds).
3. Deploy › Manage deployments › edit the web app › Version: **New version** › Deploy. The `/exec` address stays the same.

| Version | What it adds | After pasting, run |
|---|---|---|
| 2.0.0 | Responsibilities (Users page) | ensureSchema, seedDefaults |
| 2.1.0 | Shift reports, Review, Daily meeting; posting validated stoppages to the downtime analysis | seedDefaults (adds the Shift reports and Daily meeting page access to every role) |
| 2.2.0 | History import (date only) on the Upload page, Admin only | ensureSchema (adds the `kind` column to upload_batches) |
