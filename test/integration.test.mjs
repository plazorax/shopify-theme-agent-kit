// Runs the hook and the scaffold against the real Shopify CLI.
// Skipped when no working `shopify` binary is found (set SHOPIFY_CLI_BIN to override).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { runHook } from '../scripts/theme-check-hook.mjs';
import { ROOT, makeTheme, scaffoldFiles, realCli } from './helpers.mjs';

const cli = realCli();
const skip = cli ? false : 'Shopify CLI not available';
const env = { ...process.env, SHOPIFY_CLI_BIN: cli || 'shopify' };
const TIMEOUT = 180000;

const edit = (root, rel) => ({ hook_event_name: 'PostToolUse', tool_name: 'Write', cwd: root, tool_input: { file_path: path.join(root, rel) } });

describe('real Shopify CLI', { skip, timeout: TIMEOUT }, () => {
  test('the hook blocks on examples/bad-section.liquid', async () => {
    const root = makeTheme({ 'sections/bad-section.liquid': readFileSync(path.join(ROOT, 'examples/bad-section.liquid'), 'utf8') });
    const res = await runHook(edit(root, 'sections/bad-section.liquid'), { env });
    assert.equal(res.exitCode, 2, res.stdout + res.stderr);
    for (const check of ['ParserBlockingScript', 'ImgWidthAndHeight', 'TranslationKeyExists']) {
      assert.match(res.stderr, new RegExp(`sections/bad-section\\.liquid:\\d+:\\d+ \\[error\\] ${check}`));
    }
  });

  test('the /new-section reference scaffold passes Theme Check with no offenses', () => {
    const root = makeTheme(scaffoldFiles());
    const res = spawnSync(cli, ['theme', 'check', '--path', root, '--output', 'json', '--fail-level', 'error'], {
      encoding: 'utf8', timeout: TIMEOUT, shell: process.platform === 'win32',
    });
    let out = res.stdout;
    if (/Ruby environment not found/.test(res.stdout + res.stderr)) {
      out = spawnSync(cli, ['theme', 'check', '--path', root, '--output', 'json', '--dev-preview'], { encoding: 'utf8', timeout: TIMEOUT }).stdout;
    }
    const json = JSON.parse(out.slice(out.indexOf('[')));
    const offenses = json.flatMap((f) => f.offenses.map((o) => `${f.path}: ${o.check} ${o.message}`));
    assert.deepEqual(offenses, []);
  });

  test('the hook stays quiet for the clean scaffold', async () => {
    const root = makeTheme(scaffoldFiles());
    const res = await runHook(edit(root, 'sections/hero-banner.liquid'), { env });
    assert.deepEqual(res, { exitCode: 0, stdout: '', stderr: '' });
  });
});
