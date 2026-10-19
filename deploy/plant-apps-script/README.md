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
