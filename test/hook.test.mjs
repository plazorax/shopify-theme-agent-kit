import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  editedFile,
  findThemeRoot,
  parseCheckOutput,
  severityName,
  formatOffense,
  summarize,
  buildReport,
  runHook,
} from '../scripts/theme-check-hook.mjs';
import { ROOT, makeTheme, tempDir, fakeCli } from './helpers.mjs';

const HOOK = path.join(ROOT, 'scripts/theme-check-hook.mjs');

const offense = (check, severity, row = 0, col = 0, message = `${check} message`) => ({
  check, severity, start_row: row, start_column: col, end_row: row, end_column: col + 1, message,
});

function payload(file, cwd) {
  return { hook_event_name: 'PostToolUse', tool_name: 'Edit', cwd, tool_input: { file_path: file } };
}

function runScript(input, env = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('editedFile', () => {
  test('resolves a relative path against cwd', () => {
    assert.equal(editedFile(payload('sections/a.liquid', '/tmp/theme')), path.resolve('/tmp/theme/sections/a.liquid'));
  });
  test('returns null without a file path', () => {
    assert.equal(editedFile({ tool_input: {} }), null);
    assert.equal(editedFile(null), null);
  });
});

describe('findThemeRoot', () => {
  const root = makeTheme({ 'sections/a.liquid': '', 'templates/customers/account.json': '{}' });

  test('finds the root for a section file', () => {
    assert.equal(findThemeRoot(path.join(root, 'sections/a.liquid')), root);
  });
  test('finds the root for a nested template', () => {
    assert.equal(findThemeRoot(path.join(root, 'templates/customers/account.json')), root);
  });
  test('ignores files outside theme directories', () => {
    assert.equal(findThemeRoot(path.join(root, 'package.json')), null);
    assert.equal(findThemeRoot(path.join(root, 'docs/notes.json')), null);
  });
  test('ignores a sections/ folder that is not part of a theme', () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, 'sections'));
    assert.equal(findThemeRoot(path.join(dir, 'sections/a.liquid')), null);
  });
  test('accepts sections/ + config/ without layout/theme.liquid', () => {
    const dir = tempDir();
    mkdirSync(path.join(dir, 'sections'));
    mkdirSync(path.join(dir, 'config'));
    assert.equal(findThemeRoot(path.join(dir, 'sections/a.liquid')), dir);
  });
});

describe('parseCheckOutput', () => {
  test('parses plain JSON', () => {
    assert.deepEqual(parseCheckOutput('[]'), []);
  });
  test('skips notices printed before the JSON', () => {
    const out = 'Update available\n\n[{"path":"a","offenses":[]}]\n';
    assert.deepEqual(parseCheckOutput(out), [{ path: 'a', offenses: [] }]);
  });
  test('returns null when there is no JSON array', () => {
    assert.equal(parseCheckOutput('Ruby environment not found'), null);
    assert.equal(parseCheckOutput('[not json'), null);
    assert.equal(parseCheckOutput(''), null);
  });
});

describe('formatting', () => {
  test('severityName handles strings and numbers', () => {
    assert.equal(severityName('error'), 'error');
    assert.equal(severityName('Warning'), 'warning');
    assert.equal(severityName(0), 'error');
    assert.equal(severityName(1), 'warning');
    assert.equal(severityName(2), 'info');
  });
  test('formatOffense uses 1-based line and column', () => {
    const line = formatOffense('sections/a.liquid', offense('ParserBlockingScript', 'error', 4, 2, 'Add defer'));
    assert.equal(line, 'sections/a.liquid:5:3 [error] ParserBlockingScript: Add defer');
  });
});

describe('summarize and buildReport', () => {
  const root = makeTheme({ 'sections/a.liquid': '', 'sections/b.liquid': '' });
  const file = path.join(root, 'sections/a.liquid');
  const results = [
    { path: path.join(root, 'sections/a.liquid'), offenses: [offense('B', 'error', 9), offense('W', 'warning', 1), offense('A', 'error', 2)] },
    { path: 'sections/b.liquid', offenses: [offense('C', 'error'), offense('D', 'warning')] },
  ];

  test('keeps offenses of the edited file sorted by position and counts other errors', () => {
    const s = summarize(results, root, file);
    assert.deepEqual(s.errors.map((o) => o.check), ['A', 'B']);
    assert.deepEqual(s.warnings.map((o) => o.check), ['W']);
    assert.equal(s.otherErrors, 1);
  });

  test('errors block with exit code 2 and file:line output on stderr', () => {
    const report = buildReport(summarize(results, root, file), 'sections/a.liquid');
    assert.equal(report.exitCode, 2);
    assert.match(report.stderr, /Theme Check found 2 error\(s\) in sections\/a\.liquid/);
    assert.match(report.stderr, /sections\/a\.liquid:3:1 \[error\] A:/);
    assert.match(report.stderr, /Warnings \(non-blocking\):\n  sections\/a\.liquid:2:1 \[warning\] W:/);
    assert.match(report.stderr, /1 error\(s\) in other theme files/);
    assert.equal(report.stdout, '');
  });

  test('warnings only produce non-blocking additionalContext JSON', () => {
    const s = { errors: [], warnings: [offense('RemoteAsset', 'warning', 0)], otherErrors: 0 };
    const report = buildReport(s, 'sections/a.liquid');
    assert.equal(report.exitCode, 0);
    const out = JSON.parse(report.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(out.hookSpecificOutput.additionalContext, /1 warning\(s\)/);
    assert.match(out.hookSpecificOutput.additionalContext, /sections\/a\.liquid:1:1 \[warning\] RemoteAsset/);
  });

  test('a clean file produces no output', () => {
    assert.deepEqual(buildReport({ errors: [], warnings: [], otherErrors: 0 }, 'x'), { exitCode: 0, stdout: '', stderr: '' });
  });

  test('long error lists are truncated', () => {
    const many = Array.from({ length: 20 }, (_, i) => offense(`E${i}`, 'error', i));
    const report = buildReport({ errors: many, warnings: [], otherErrors: 0 }, 'x.liquid');
    assert.match(report.stderr, /\.\.\.and 5 more/);
  });
});

describe('runHook with an injected runner', () => {
  const root = makeTheme({ 'sections/a.liquid': '' });
  const file = path.join(root, 'sections/a.liquid');

  test('skips non-theme extensions without running the CLI', async () => {
    let called = false;
    const res = await runHook(payload(path.join(root, 'assets/app.js'), root), { env: {}, run: async () => { called = true; } });
    assert.equal(res.exitCode, 0);
    assert.equal(called, false);
  });

  test('can be disabled with SHOPIFY_THEME_CHECK_HOOK=off', async () => {
    const res = await runHook(payload(file, root), { env: { SHOPIFY_THEME_CHECK_HOOK: 'off' }, run: async () => assert.fail('ran') });
    assert.equal(res.exitCode, 0);
  });

  test('passes the theme root, JSON output and fail level to the CLI', async () => {
    let seen;
    await runHook(payload(file, root), {
      env: { SHOPIFY_CLI_BIN: 'my-shopify' },
      run: async (bin, args, opts) => { seen = { bin, args, opts }; return { code: 0, stdout: '[]', stderr: '' }; },
    });
    assert.equal(seen.bin, 'my-shopify');
    assert.deepEqual(seen.args, ['theme', 'check', '--path', root, '--output', 'json', '--fail-level', 'error']);
    assert.equal(seen.opts.cwd, root);
    assert.equal(seen.opts.timeoutMs, 90000);
  });

  test('the --dev-preview retry shares the timeout budget of the first run', async () => {
    const calls = [];
    const res = await runHook(payload(file, root), {
      env: { SHOPIFY_THEME_CHECK_TIMEOUT: '10' },
      run: async (bin, args, opts) => {
        calls.push({ args, timeoutMs: opts.timeoutMs });
        if (calls.length === 1) {
          await new Promise((r) => setTimeout(r, 50));
          return { code: 1, stdout: '', stderr: 'Ruby environment not found', error: null };
        }
        return { code: 0, stdout: '[]', stderr: '', error: null };
      },
    });
    assert.equal(res.exitCode, 0);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].timeoutMs, 10000);
    assert.ok(calls[1].args.includes('--dev-preview'));
    assert.ok(calls[1].timeoutMs < 10000, `retry got ${calls[1].timeoutMs}ms`);
  });

  test('reports a timeout as a non-blocking note', async () => {
    const res = await runHook(payload(file, root), {
      env: {},
      run: async () => ({ code: null, stdout: '', stderr: '', error: new Error('timed out after 90s') }),
    });
    assert.equal(res.exitCode, 0);
    assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /timed out/);
  });

  test('reports unparseable output with its tail', async () => {
    const res = await runHook(payload(file, root), {
      env: {},
      run: async () => ({ code: 1, stdout: '', stderr: 'line1\nboom', error: null }),
    });
    assert.equal(res.exitCode, 0);
    assert.match(JSON.parse(res.stdout).hookSpecificOutput.additionalContext, /did not return JSON[\s\S]*boom/);
  });
});

describe('hook script as a process', () => {
  const root = makeTheme({ 'sections/a.liquid': '', 'locales/en.default.schema.json': '{}' });
  const file = path.join(root, 'sections/a.liquid');

  test('ignores invalid stdin', () => {
    const res = runScript('not json');
    assert.equal(res.code, 0);
    assert.equal(res.stdout + res.stderr, '');
  });

  test('ignores files outside a theme', () => {
    const res = runScript(payload(path.join(tempDir(), 'x.liquid'), '/'));
    assert.equal(res.code, 0);
    assert.equal(res.stdout + res.stderr, '');
  });

  test('degrades gracefully when the CLI is missing', () => {
    const res = runScript(payload(file, root), { SHOPIFY_CLI_BIN: path.join(tempDir(), 'missing-shopify') });
    assert.equal(res.code, 0);
    const note = JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
    assert.match(note, /Shopify CLI not found/);
    assert.match(note, /npm install -g @shopify\/cli/);
  });

  test('exits 2 with readable errors for the edited file', () => {
    const cli = fakeCli({
      code: 1,
      stdout: JSON.stringify([{ path: file, offenses: [offense('ParserBlockingScript', 'error', 4, 0, 'Avoid parser blocking scripts')] }]),
    });
    const res = runScript(payload(file, root), { SHOPIFY_CLI_BIN: cli.bin });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /sections\/a\.liquid:5:1 \[error\] ParserBlockingScript: Avoid parser blocking scripts/);
  });

  test('checks a locale JSON file and passes when clean', () => {
    const cli = fakeCli({ stdout: '[]' });
    const res = runScript(payload(path.join(root, 'locales/en.default.schema.json'), root), { SHOPIFY_CLI_BIN: cli.bin });
    assert.equal(res.code, 0);
    assert.equal(res.stdout + res.stderr, '');
    assert.equal(cli.calls().length, 1);
  });

  test('retries with --dev-preview when an old CLI asks for Ruby', () => {
    const cli = fakeCli({ rubyFirst: true, stdout: '[]' });
    const res = runScript(payload(file, root), { SHOPIFY_CLI_BIN: cli.bin });
    assert.equal(res.code, 0);
    const calls = cli.calls();
    assert.equal(calls.length, 2);
    assert.ok(calls[1].includes('--dev-preview'));
  });

  test('accepts a file written with a relative path', () => {
    writeFileSync(path.join(root, 'sections/b.liquid'), '');
    const cli = fakeCli({ stdout: JSON.stringify([{ path: 'sections/b.liquid', offenses: [offense('X', 'error')] }]) });
    const res = runScript(payload('sections/b.liquid', root), { SHOPIFY_CLI_BIN: cli.bin });
    assert.equal(res.code, 2);
    assert.match(res.stderr, /sections\/b\.liquid:1:1 \[error\] X/);
  });
});
