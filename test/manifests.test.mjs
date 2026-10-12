// Static checks for the plugin layout: JSON manifests, hook wiring, and the
// frontmatter of skills and agents.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import { ROOT } from './helpers.mjs';

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Split a Markdown file into { data, body }; throws if the frontmatter is missing. */
function frontmatter(rel) {
  const text = read(rel);
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${rel} has no frontmatter block`);
  return { data: parseYaml(m[1]), body: m[2] };
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (['node_modules', '.git'].includes(name)) return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('JSON files', () => {
  for (const file of walk(ROOT).filter((f) => f.endsWith('.json'))) {
    const rel = path.relative(ROOT, file);
    test(`${rel} parses`, () => assert.doesNotThrow(() => JSON.parse(readFileSync(file, 'utf8'))));
  }
});

describe('plugin manifest', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  const pkg = readJson('package.json');

  test('has a kebab-case name and the required metadata', () => {
    assert.match(plugin.name, KEBAB);
    assert.ok(!/^(claude|anthropic)/.test(plugin.name), 'reserved name prefix');
    for (const key of ['version', 'description', 'license']) assert.ok(plugin[key], `missing ${key}`);
    assert.ok(plugin.author && plugin.author.name, 'missing author.name');
  });

  test('version matches package.json and the CHANGELOG', () => {
    assert.equal(plugin.version, pkg.version);
    assert.match(read('CHANGELOG.md'), new RegExp(`## \\[${plugin.version.replace(/\./g, '\\.')}\\]`));
  });

  test('component directories sit at the plugin root, not in .claude-plugin/', () => {
    assert.deepEqual(readdirSync(path.join(ROOT, '.claude-plugin')).sort(), ['marketplace.json', 'plugin.json']);
    for (const dir of ['skills', 'agents', 'hooks']) assert.ok(existsSync(path.join(ROOT, dir)), `${dir}/ missing`);
  });
});

describe('marketplace manifest', () => {
  const market = readJson('.claude-plugin/marketplace.json');
  const plugin = readJson('.claude-plugin/plugin.json');

  test('has name, owner and a plugin entry that points at this repo', () => {
    assert.match(market.name, KEBAB);
    assert.ok(market.owner && market.owner.name);
    assert.equal(market.plugins.length, 1);
    const [entry] = market.plugins;
    assert.equal(entry.name, plugin.name, 'entry name must equal plugin.json name');
    assert.equal(entry.source, './');
  });
});

describe('hooks/hooks.json', () => {
  const { hooks } = readJson('hooks/hooks.json');

  test('runs the bundled script after Write and Edit', () => {
    const [group] = hooks.PostToolUse;
    const matcher = group.matcher.split('|');
    assert.ok(matcher.includes('Write') && matcher.includes('Edit'));
    const [hook] = group.hooks;
    assert.equal(hook.type, 'command');
    assert.ok(hook.timeout >= 60 && hook.timeout <= 600);
    const m = hook.command.match(/"\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)"/);
    assert.ok(m, 'command must reference a quoted ${CLAUDE_PLUGIN_ROOT} path');
    assert.ok(existsSync(path.join(ROOT, m[1])), `${m[1]} does not exist`);
  });

  test('declares only known events', () => {
    assert.deepEqual(Object.keys(hooks), ['PostToolUse']);
  });
});

describe('skills', () => {
  const names = readdirSync(path.join(ROOT, 'skills'));

  for (const name of names) {
    test(`skills/${name}/SKILL.md frontmatter`, () => {
      assert.match(name, KEBAB);
      const { data, body } = frontmatter(`skills/${name}/SKILL.md`);
      assert.equal(typeof data.description, 'string');
      assert.ok(data.description.length >= 40, 'description too short to trigger reliably');
      assert.ok(data.description.length <= 1536, 'description is truncated above 1536 characters');
      if (data.name !== undefined) assert.equal(data.name, name);
      if (data['disable-model-invocation'] !== undefined) assert.equal(typeof data['disable-model-invocation'], 'boolean');
      assert.ok(body.trim().length > 0, 'empty body');
    });
  }

  test('new-section is user-invoked and takes a name argument', () => {
    const { data, body } = frontmatter('skills/new-section/SKILL.md');
    assert.equal(data['disable-model-invocation'], true);
    assert.equal(data['argument-hint'], '<section-name>');
    assert.match(body, /\$0/);
  });

  test('every rule id cited by the agent exists in theme-conventions', () => {
    const conventions = read('skills/theme-conventions/SKILL.md');
    const agent = read('agents/theme-reviewer.md');
    const ids = new Set(conventions.match(/\*\*([A-Z0-9]+-\d+)\*\*/g).map((s) => s.slice(2, -2)));
    assert.ok(ids.size >= 25);
    for (const ref of agent.match(/\b(SCH|SET|I18N|JS|CSS|BUD|IMG|A11Y)-\d+\b/g) || []) assert.ok(ids.has(ref), ref);
  });

  test('theme-conventions cites a source for every rule', () => {
    const text = read('skills/theme-conventions/SKILL.md');
    const rules = text.split(/\n- \*\*/).slice(1).filter((r) => /^[A-Z0-9]+-\d+\*\*/.test(r));
    for (const rule of rules) assert.match(rule, /\[S\d+\]/, `rule without source: ${rule.slice(0, 40)}`);
    for (const ref of new Set(text.match(/\[S\d+\]/g))) {
      assert.ok(text.includes(`- ${ref} `), `${ref} is cited but not listed under Sources`);
    }
  });
});

describe('agents', () => {
  const ALLOWED = new Set(['name', 'description', 'model', 'effort', 'maxTurns', 'tools', 'disallowedTools', 'skills', 'memory', 'background', 'omitClaudeMd', 'isolation', 'color']);
  const TOOLS = new Set(['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch']);

  for (const file of readdirSync(path.join(ROOT, 'agents'))) {
    test(`agents/${file} frontmatter`, () => {
      const { data, body } = frontmatter(`agents/${file}`);
      assert.match(data.name, KEBAB);
      assert.equal(data.name, path.basename(file, '.md'));
      assert.equal(typeof data.description, 'string');
      for (const key of Object.keys(data)) assert.ok(ALLOWED.has(key), `field "${key}" is ignored for plugin agents`);
      for (const tool of String(data.tools).split(',').map((t) => t.trim())) assert.ok(TOOLS.has(tool), `unknown tool ${tool}`);
      assert.ok(!/\b(Edit|Write)\b/.test(String(data.tools)), 'the reviewer must stay read-only');
      assert.ok(body.includes('Location: <path>:<line>'), 'output format must include file:line');
    });
  }
});

describe('CI workflow template', () => {
  test('ci/theme-ci.yml is valid YAML that runs Theme Check and the JSON validator', () => {
    const wf = parseYaml(read('ci/theme-ci.yml'));
    assert.ok(wf.on && wf.jobs);
    const steps = Object.values(wf.jobs).flatMap((job) => job.steps || []);
    const runs = steps.map((s) => s.run || '').join('\n');
    assert.match(runs, /shopify theme check[\s\S]*--fail-level error/);
    assert.match(runs, /validate-theme-json\.mjs/);
  });

  test('this repo CI runs the test suite and plugin validation', () => {
    const wf = parseYaml(read('.github/workflows/ci.yml'));
    const runs = Object.values(wf.jobs).flatMap((job) => job.steps || []).map((s) => s.run || '').join('\n');
    assert.match(runs, /npm test/);
    assert.match(runs, /claude plugin validate/);
  });
});
