import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BACKEND_DIR } from './harness.mjs';

const ROOT = resolve(BACKEND_DIR, '../..');

test('deploy/plant-apps-script holds the current backend (regenerate with tools/bundle-apps-script.mjs)', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'bundle-')), 'Code.gs');
  execFileSync(process.execPath, [resolve(ROOT, 'tools/bundle-apps-script.mjs'), out], { stdio: 'ignore' });
  assert.equal(readFileSync(resolve(ROOT, 'deploy/plant-apps-script/Code.gs'), 'utf8'), readFileSync(out, 'utf8'),
    'deploy/plant-apps-script/Code.gs is out of date: run node tools/bundle-apps-script.mjs deploy/plant-apps-script/Code.gs');
  assert.equal(readFileSync(resolve(ROOT, 'deploy/plant-apps-script/appsscript.json'), 'utf8'), readFileSync(resolve(BACKEND_DIR, 'appsscript.json'), 'utf8'));
});
