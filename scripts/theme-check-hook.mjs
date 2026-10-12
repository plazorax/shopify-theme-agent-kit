#!/usr/bin/env node
// PostToolUse hook: run `shopify theme check` after Claude edits a .liquid or
// .json file inside a Shopify theme, and report offenses in the edited file.
//
// Exit codes follow the Claude Code hooks contract
// (https://code.claude.com/docs/en/hooks):
//   0  nothing to report, or a non-blocking note printed as JSON on stdout
//   2  errors in the edited file; stderr is shown to Claude
//
// Environment:
//   SHOPIFY_CLI_BIN               path to the Shopify CLI (default: "shopify")
//   SHOPIFY_THEME_CHECK_HOOK=off  disable the hook
//   SHOPIFY_THEME_CHECK_TIMEOUT   seconds before giving up (default: 90)

import { spawn } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const THEME_DIRS = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const CHECKED_EXTENSIONS = new Set(['.liquid', '.json']);
const DOCS_URL = 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks';
const MAX_LISTED = 15;

/** Return the edited file path from a PostToolUse payload, or null. */
export function editedFile(payload) {
  const input = payload && payload.tool_input;
  const file = input && (input.file_path || input.path);
  if (typeof file !== 'string' || file === '') return null;
  return path.resolve(payload.cwd || process.cwd(), file);
}

/** True if `dir` looks like a theme root. */
export function isThemeRoot(dir) {
  if (existsSync(path.join(dir, 'layout', 'theme.liquid'))) return true;
  return isDir(path.join(dir, 'sections')) && isDir(path.join(dir, 'config'));
}

/**
 * Find the theme root that contains `file`, or null. The file must live under
 * one of the standard theme directories (sections/, templates/customers/, ...).
 */
export function findThemeRoot(file) {
  let dir = path.dirname(file);
  while (true) {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    if (THEME_DIRS.includes(path.basename(dir)) && isThemeRoot(parent)) return parent;
    dir = parent;
  }
}

/**
 * Parse `shopify theme check --output json`. The CLI can print notices before
 * the JSON array, so parse from the first line that starts with "[".
 * Returns an array of { path, offenses } or null when there is no JSON.
 */
export function parseCheckOutput(stdout) {
  const text = String(stdout || '');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith('[')) continue;
    try {
      const parsed = JSON.parse(lines.slice(i).join('\n'));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not the JSON payload; keep looking.
    }
  }
  return null;
}

/** Severity may be a string ("error") or a number (0 = error). */
export function severityName(severity) {
  if (typeof severity === 'number') return ['error', 'warning', 'info'][severity] || 'info';
  return String(severity || 'info').toLowerCase();
}

/** Format one offense as `relpath:line:col [severity] Check: message` (1-based). */
export function formatOffense(relPath, offense) {
  const line = (offense.start_row ?? 0) + 1;
  const col = (offense.start_column ?? 0) + 1;
  return `${relPath}:${line}:${col} [${severityName(offense.severity)}] ${offense.check}: ${offense.message}`;
}

/** Split results into offenses for `file` and an error count for every other file. */
export function summarize(results, themeRoot, file) {
  const target = canonical(file);
  const own = [];
  let otherErrors = 0;
  for (const entry of results) {
    const entryPath = canonical(path.resolve(themeRoot, entry.path || ''));
    for (const offense of entry.offenses || []) {
      if (entryPath === target) own.push(offense);
      else if (severityName(offense.severity) === 'error') otherErrors++;
    }
  }
  const byPosition = (a, b) => (a.start_row ?? 0) - (b.start_row ?? 0) || (a.start_column ?? 0) - (b.start_column ?? 0);
  return {
    errors: own.filter((o) => severityName(o.severity) === 'error').sort(byPosition),
    warnings: own.filter((o) => severityName(o.severity) !== 'error').sort(byPosition),
    otherErrors,
  };
}

/** Build the hook result ({ exitCode, stdout, stderr }) from a summary. */
export function buildReport(summary, relPath) {
  const { errors, warnings, otherErrors } = summary;
  const elsewhere = otherErrors > 0
    ? `Note: ${otherErrors} error(s) in other theme files (not caused by this edit unless you changed locales or schema).`
    : '';

  if (errors.length > 0) {
    const lines = [
      `Theme Check found ${errors.length} error(s) in ${relPath}. Fix them before moving on:`,
      ...errors.slice(0, MAX_LISTED).map((o) => '  ' + formatOffense(relPath, o)),
    ];
    if (errors.length > MAX_LISTED) lines.push(`  ...and ${errors.length - MAX_LISTED} more`);
    if (warnings.length > 0) {
      lines.push(`Warnings (non-blocking):`, ...warnings.slice(0, MAX_LISTED).map((o) => '  ' + formatOffense(relPath, o)));
    }
    if (elsewhere) lines.push(elsewhere);
    lines.push(`Check reference: ${DOCS_URL}`);
    return { exitCode: 2, stdout: '', stderr: lines.join('\n') + '\n' };
  }

  if (warnings.length > 0) {
    const lines = [
      `Theme Check: no errors in ${relPath}, ${warnings.length} warning(s):`,
      ...warnings.slice(0, MAX_LISTED).map((o) => '  ' + formatOffense(relPath, o)),
    ];
    if (elsewhere) lines.push(elsewhere);
    return context(lines.join('\n'));
  }

  return elsewhere ? context(`Theme Check: ${relPath} is clean. ${elsewhere}`) : { exitCode: 0, stdout: '', stderr: '' };
}

/** Non-blocking note for Claude, as PostToolUse JSON output. */
export function context(text) {
  const body = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } };
  return { exitCode: 0, stdout: JSON.stringify(body) + '\n', stderr: '' };
}

/** Run a command and collect its output. Resolves { code, stdout, stderr, error }. */
export function runCommand(bin, args, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(bin, args, { cwd, shell: process.platform === 'win32', env: { ...process.env, NO_COLOR: '1' } });
    } catch (error) {
      resolve({ code: null, stdout, stderr, error });
      return;
    }
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: null, stdout, stderr, error }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, error: signal ? new Error(`timed out after ${timeoutMs / 1000}s`) : null });
    });
  });
}

/**
 * Hook entry point, separated from stdin/stdout so it can be unit tested.
 * `run` defaults to runCommand and can be replaced in tests.
 */
export async function runHook(payload, { env = process.env, run = runCommand } = {}) {
  const none = { exitCode: 0, stdout: '', stderr: '' };
  if (String(env.SHOPIFY_THEME_CHECK_HOOK || '').toLowerCase() === 'off') return none;

  const file = editedFile(payload);
  if (!file || !CHECKED_EXTENSIONS.has(path.extname(file).toLowerCase())) return none;
  const themeRoot = findThemeRoot(file);
  if (!themeRoot) return none;
  const relPath = path.relative(themeRoot, file).split(path.sep).join('/');

  const bin = env.SHOPIFY_CLI_BIN || 'shopify';
  const timeoutMs = (Number(env.SHOPIFY_THEME_CHECK_TIMEOUT) || 90) * 1000;
  const args = ['theme', 'check', '--path', themeRoot, '--output', 'json', '--fail-level', 'error'];

  const deadline = Date.now() + timeoutMs;
  let result = await run(bin, args, { cwd: themeRoot, timeoutMs });
  // Shopify CLI releases before the Node-based Theme Check became the default
  // need Ruby unless --dev-preview is passed. The retry shares the same budget
  // so the hook stays inside the timeout declared in hooks/hooks.json.
  if (!result.error && /Ruby environment not found/i.test(result.stdout + result.stderr)) {
    const remainingMs = deadline - Date.now();
    result = remainingMs > 1000
      ? await run(bin, [...args, '--dev-preview'], { cwd: themeRoot, timeoutMs: remainingMs })
      : { code: null, stdout: '', stderr: '', error: new Error(`timed out after ${timeoutMs / 1000}s`) };
  }

  if (result.error && result.error.code === 'ENOENT') {
    return context(
      `Theme Check skipped for ${relPath}: Shopify CLI not found ("${bin}"). ` +
      'Install it with `npm install -g @shopify/cli` or set SHOPIFY_CLI_BIN.'
    );
  }
  if (result.error) {
    return context(`Theme Check skipped for ${relPath}: ${result.error.message}.`);
  }

  const results = parseCheckOutput(result.stdout);
  if (!results) {
    const tail = (result.stderr || result.stdout).trim().split('\n').slice(-5).join('\n');
    return context(`Theme Check did not return JSON for ${relPath} (exit ${result.code}). Last output:\n${tail}`);
  }
  return buildReport(summarize(results, themeRoot, file), relPath);
}

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function canonical(p) {
  try { return realpathSync(p); } catch { return path.resolve(p); }
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    process.exit(0); // Not a hook payload; nothing to check.
  }
  const { exitCode, stdout, stderr } = await runHook(payload);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exitCode = exitCode;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
