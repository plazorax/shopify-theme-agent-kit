import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LAYOUT = `<!doctype html>
<html lang="{{ request.locale.iso_code }}">
  <head>{{ content_for_header }}</head>
  <body>{{ content_for_layout }}</body>
</html>
`;

/** Create a temporary directory (realpath, so macOS /var -> /private/var is resolved). */
export function tempDir(prefix = 'stak-') {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** Write `files` ({ relPath: content }) into a new temp theme and return its root. */
export function makeTheme(files = {}) {
  const root = tempDir('stak-theme-');
  const all = {
    'layout/theme.liquid': LAYOUT,
    'config/settings_schema.json': '[{"name":"theme_info","theme_name":"Test","theme_version":"0.0.1","theme_author":"Test","theme_documentation_url":"https://example.com","theme_support_url":"https://example.com"}]\n',
    'locales/en.default.json': '{}\n',
    ...files,
  };
  for (const [rel, content] of Object.entries(all)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

/** Extract fenced code blocks that carry a title="path" info string. */
export function titledCodeBlocks(markdown) {
  const out = {};
  for (const m of markdown.matchAll(/```\w+ title="([^"]+)"\n([\s\S]*?)\n```/g)) out[m[1]] = m[2] + '\n';
  return out;
}

/** The files the /new-section skill uses as its reference scaffold. */
export function scaffoldFiles() {
  return titledCodeBlocks(readFileSync(path.join(ROOT, 'skills/new-section/SKILL.md'), 'utf8'));
}

/**
 * Write an executable fake Shopify CLI that prints `stdout` and exits with `code`.
 * With `rubyFirst`, it fails like old CLI releases unless --dev-preview is passed.
 */
export function fakeCli({ stdout = '[]', code = 0, rubyFirst = false } = {}) {
  const dir = tempDir('stak-cli-');
  const bin = path.join(dir, 'shopify');
  writeFileSync(path.join(dir, 'out.txt'), stdout);
  writeFileSync(bin, `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync(path.join(__dirname, 'calls.log'), JSON.stringify(process.argv.slice(2)) + '\\n');
if (${rubyFirst} && !process.argv.includes('--dev-preview')) {
  console.error('Ruby environment not found');
  process.exit(1);
}
process.stdout.write(fs.readFileSync(path.join(__dirname, 'out.txt'), 'utf8'));
process.exit(${code});
`);
  chmodSync(bin, 0o755);
  const calls = () => {
    try {
      return readFileSync(path.join(dir, 'calls.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  };
  return { bin, calls };
}

/** Path of a working Shopify CLI for integration tests, or null. */
export function realCli() {
  const bin = process.env.SHOPIFY_CLI_BIN || 'shopify';
  const res = spawnSync(bin, ['version'], { encoding: 'utf8', timeout: 60000, shell: process.platform === 'win32' });
  return res.status === 0 ? bin : null;
}
