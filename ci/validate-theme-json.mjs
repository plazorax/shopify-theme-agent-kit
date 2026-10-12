#!/usr/bin/env node
// Validate the JSON in a Shopify theme without the Shopify CLI.
//
//   node validate-theme-json.mjs [theme-dir]
//
// Checks:
//   - config/, locales/, templates/ (recursive) and sections/*.json parse as JSON
//     (the comment header Shopify writes at the top of JSON templates is allowed)
//   - sections/*.liquid and blocks/*.liquid have at most one {% schema %} tag,
//     and its body is valid JSON
//   - setting ids are unique within a section and within each block
//   - every preset has a name
//   - every "t:" key in a schema resolves in locales/*.default.schema.json
//
// Exits 1 when a problem is found. No dependencies; Node 20+.

import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_TAG = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g;

/** Strip one leading block comment, as Shopify adds to generated JSON templates. */
export function stripLeadingComment(text) {
  return text.replace(/^﻿?\s*\/\*[\s\S]*?\*\/\s*/, '');
}

export function parseJson(text) {
  return JSON.parse(stripLeadingComment(text));
}

/** Return the bodies of every {% schema %} tag in a Liquid source. */
export function extractSchemas(liquid) {
  return [...liquid.matchAll(SCHEMA_TAG)].map((m) => m[1]);
}

/** Resolve a dotted key such as "sections.hero.name" in a nested object. */
export function lookup(obj, dotted) {
  return dotted.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), obj);
}

/** Collect every string value starting with "t:" in a JSON value. */
export function translationKeys(value, found = []) {
  if (typeof value === 'string') {
    if (value.startsWith('t:')) found.push(value.slice(2));
  } else if (Array.isArray(value)) {
    value.forEach((v) => translationKeys(v, found));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => translationKeys(v, found));
  }
  return found;
}

function duplicateIds(settings) {
  const seen = new Set();
  const dupes = new Set();
  for (const s of Array.isArray(settings) ? settings : []) {
    if (!s || typeof s.id !== 'string') continue;
    if (seen.has(s.id)) dupes.add(s.id);
    seen.add(s.id);
  }
  return [...dupes];
}

/** Check one parsed schema object. Returns problem messages. */
export function checkSchema(schema, schemaLocale) {
  const problems = [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return ['schema must be a JSON object'];
  }
  for (const id of duplicateIds(schema.settings)) problems.push(`duplicate setting id "${id}"`);
  for (const block of Array.isArray(schema.blocks) ? schema.blocks : []) {
    for (const id of duplicateIds(block && block.settings)) {
      problems.push(`duplicate setting id "${id}" in block "${block.type}"`);
    }
  }
  (Array.isArray(schema.presets) ? schema.presets : []).forEach((preset, i) => {
    if (!preset || typeof preset.name !== 'string' || preset.name === '') problems.push(`preset ${i} has no name`);
  });
  const keys = translationKeys(schema);
  if (keys.length > 0 && !schemaLocale) {
    problems.push('uses "t:" keys but locales/*.default.schema.json is missing or invalid');
  } else {
    for (const key of keys) {
      if (typeof lookup(schemaLocale, key) !== 'string') problems.push(`translation key "t:${key}" not found in default schema locale`);
    }
  }
  return problems;
}

function listFiles(dir, ext, recursive) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (recursive) out.push(...listFiles(full, ext, true));
    } else if (name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

/** Validate a theme directory. Returns { checked, problems: [{ file, message }] }. */
export function validateTheme(root) {
  const problems = [];
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');
  const add = (file, message) => problems.push({ file: rel(file), message });

  const jsonFiles = [
    ...listFiles(path.join(root, 'config'), '.json', false),
    ...listFiles(path.join(root, 'locales'), '.json', false),
    ...listFiles(path.join(root, 'sections'), '.json', false),
    ...listFiles(path.join(root, 'templates'), '.json', true),
  ];
  let schemaLocale = null;
  for (const file of jsonFiles) {
    try {
      const data = parseJson(readFileSync(file, 'utf8'));
      if (/\/locales\/[^/]+\.default\.schema\.json$/.test(file.split(path.sep).join('/'))) schemaLocale = data;
    } catch (error) {
      add(file, `invalid JSON: ${error.message}`);
    }
  }

  const liquidFiles = [
    ...listFiles(path.join(root, 'sections'), '.liquid', false),
    ...listFiles(path.join(root, 'blocks'), '.liquid', false),
  ];
  for (const file of liquidFiles) {
    const schemas = extractSchemas(readFileSync(file, 'utf8'));
    if (schemas.length > 1) add(file, `has ${schemas.length} {% schema %} tags; only one is allowed`);
    if (schemas.length === 0) continue;
    let schema;
    try {
      schema = JSON.parse(schemas[0]);
    } catch (error) {
      add(file, `invalid schema JSON: ${error.message}`);
      continue;
    }
    for (const message of checkSchema(schema, schemaLocale)) add(file, message);
  }

  return { checked: jsonFiles.length + liquidFiles.length, problems };
}

function main() {
  const root = path.resolve(process.argv[2] || '.');
  const { checked, problems } = validateTheme(root);
  for (const p of problems) console.error(`${p.file}: ${p.message}`);
  console.log(`Checked ${checked} file(s) in ${root}: ${problems.length} problem(s).`);
  process.exitCode = problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
