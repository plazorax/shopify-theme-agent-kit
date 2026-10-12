# shopify-theme-agent-kit

![CI](https://github.com/plazorax/shopify-theme-agent-kit/actions/workflows/ci.yml/badge.svg)

A Claude Code plugin and an `AGENTS.md` for Shopify Online Store 2.0 theme development. It gives
the agent written theme conventions with sources, a diff reviewer, a section scaffolder, and a hook
that runs Theme Check after every edit to a `.liquid` or `.json` theme file.

**Status:** v0.1.0 - reference implementation.

**Tested with:** Node 22.23.1, 20.20.2 and 24.21.0, npm 10.9.8, Shopify CLI 4.9.3 and 3.51.2 (via the
`--dev-preview` fallback), Claude Code 2.1.282 (`claude plugin validate --strict` and
`claude --plugin-dir . plugin details`), on macOS. The plugin has not yet been exercised in a live
Claude Code session; see [Limitations](#limitations-and-roadmap).

## Why

Coding agents write Liquid that renders but breaks theme conventions: inline scripts, hardcoded
English in schema labels, `img_url` without `srcset`, clickable `<div>`s. Theme Check catches part of
that, but only when someone runs it. This kit puts the rules in the agent's context, runs Theme Check
automatically after each edit so the agent sees errors immediately, and adds a reviewer for the
things Theme Check does not cover.

## Quick start

Inside Claude Code:

```text
/plugin marketplace add plazorax/shopify-theme-agent-kit
/plugin install shopify-theme-agent-kit@plazorax
```

The same from a shell:

```bash
claude plugin marketplace add plazorax/shopify-theme-agent-kit
claude plugin install shopify-theme-agent-kit@plazorax
```

For local development, load a checkout without installing it:

```bash
git clone https://github.com/plazorax/shopify-theme-agent-kit
claude --plugin-dir ./shopify-theme-agent-kit
```

The hook needs Node 20+ and, to do anything useful, the Shopify CLI
(`npm install -g @shopify/cli`). Without the CLI it tells the agent that the check was skipped.

## Usage

| Component | How to use it |
| --- | --- |
| `theme-conventions` skill | Loaded by Claude when it works on theme files. Rules have ids (`SCH-1`, `IMG-3`, ...) and cite shopify.dev, the Theme Store requirements, or Dawn. |
| `new-section` skill | `/shopify-theme-agent-kit:new-section hero-banner` creates `sections/hero-banner.liquid` with schema, `t:` labels, `{% stylesheet %}` and a preset, merges the labels into `locales/en.default.schema.json`, then runs Theme Check. |
| `theme-reviewer` agent | `@agent-shopify-theme-agent-kit:theme-reviewer review my changes` reads the git diff and returns findings ranked critical / high / medium / low, each with `path:line`, the rule, and a fix. It does not edit files. |
| Theme Check hook | Runs automatically after `Write` / `Edit` on `.liquid` or `.json` files inside a theme. |
| `AGENTS.md` | Copy into a theme repository for agents that read `AGENTS.md` instead of Claude Code plugins. |
| `ci/theme-ci.yml` | Copy to `.github/workflows/theme-ci.yml`, and `ci/validate-theme-json.mjs` to `.github/scripts/`, to run Theme Check and the schema validator on every pull request. |

`new-section` is written as a skill with `disable-model-invocation: true` rather than a file in
`commands/`, because the Claude Code docs describe `commands/` as the older format that skills
supersede.

### Example: the hook after an edit

[`examples/bad-section.liquid`](examples/bad-section.liquid) collects common mistakes. When Claude
writes it to `sections/`, the hook exits with code 2 and Claude sees:

```text
Theme Check found 3 error(s) in sections/bad-section.liquid. Fix them before moving on:
  sections/bad-section.liquid:5:1 [error] ParserBlockingScript: Avoid parser blocking scripts by adding `defer` or `async` on this tag
  sections/bad-section.liquid:15:7 [error] ImgWidthAndHeight: Missing width and height attributes on img tag
  sections/bad-section.liquid:20:12 [error] TranslationKeyExists: 'sections.slideshow.pause' does not have a matching entry in 'locales/en.default.json'
Warnings (non-blocking):
  sections/bad-section.liquid:5:9 [warning] RemoteAsset: Asset should be served by the Shopify CDN for better performance.
  sections/bad-section.liquid:15:41 [warning] DeprecatedFilter: Deprecated filter 'img_url', consider using 'image_url'.
Check reference: https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks
```

[`examples/README.md`](examples/README.md) lists what the JSON validator and the reviewer add on
top (duplicate setting id, inline script, clickable `<div>`, global CSS, hardcoded labels, missing
presets).

### Hook settings

| Variable | Effect |
| --- | --- |
| `SHOPIFY_CLI_BIN` | Path to the Shopify CLI. Default: `shopify` on `PATH`. |
| `SHOPIFY_THEME_CHECK_HOOK=off` | Disable the hook. |
| `SHOPIFY_THEME_CHECK_TIMEOUT` | Seconds before the check is abandoned. Default: 90. Keep it below the 120-second `timeout` in `hooks/hooks.json`, which Claude Code enforces. |

## How it works

```text
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   one-plugin marketplace, source "./"
skills/theme-conventions/         rules with ids and sources
skills/new-section/               /new-section scaffolder with a reference template
agents/theme-reviewer.md          read-only reviewer (Read, Grep, Glob, Bash)
hooks/hooks.json                  PostToolUse on Write|Edit|MultiEdit
scripts/theme-check-hook.mjs      the hook (Node, no dependencies)
ci/                               copyable theme CI workflow and JSON/schema validator
```

The hook reads the PostToolUse payload from stdin and takes `tool_input.file_path`. It ignores
anything that is not `.liquid` or `.json`, and anything outside a theme directory (`sections/`,
`templates/`, `locales/`, ... under a folder that has `layout/theme.liquid`, or both `sections/` and
`config/`). It then runs
`shopify theme check --path <theme-root> --output json --fail-level error` and keeps the offenses
for the edited file:

- errors: exit code 2, with `path:line:col [severity] Check: message` lines on stderr, which
  Claude Code shows to the model ([hooks reference](https://code.claude.com/docs/en/hooks));
- warnings only: exit 0 with `hookSpecificOutput.additionalContext`, so the agent sees them
  without being blocked;
- CLI missing, timed out, or not returning JSON: exit 0 with a short note. The hook never blocks
  because of its own failure.

Theme Check reports 0-based rows; the hook prints 1-based lines. Errors in other files are counted
but not listed, since they may predate the edit. Shopify CLI releases that still need Ruby for
`theme check` are retried once with `--dev-preview`.

`ci/validate-theme-json.mjs` runs without the Shopify CLI. It parses theme JSON (allowing the comment
header Shopify writes into JSON templates), checks that each section and block has at most one
`{% schema %}` with valid JSON, unique setting ids and named presets, and that every `t:` key
resolves in `locales/*.default.schema.json`.

### Tests

```bash
npm ci
npm test                # node:test, 60+ tests
npm run lint            # syntax check of the scripts
npm run validate:plugin # needs the claude CLI
```

The unit tests cover the hook's path detection, output parsing, formatting and exit codes, using
an injected runner and a fake `shopify` executable. The integration tests run the real Shopify CLI
on `examples/bad-section.liquid` and on the `new-section` reference template (which must have zero
offenses); they are skipped when no `shopify` binary is found. Static tests validate every JSON
manifest, the frontmatter of skills and agents, and that every rule id the reviewer cites exists.
CI runs all of this on Node 20, 22 and 24 and runs `claude plugin validate --strict`.

### Sources

Rules are taken from [shopify.dev theme docs](https://shopify.dev/docs/storefronts/themes),
the [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements),
[Theme Check](https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks) and
[Dawn](https://github.com/Shopify/dawn); the full list with one citation per rule is at the end of
[`skills/theme-conventions/SKILL.md`](skills/theme-conventions/SKILL.md). Plugin layout and hook
behavior follow the Claude Code
[plugin](https://code.claude.com/docs/en/plugins-reference),
[marketplace](https://code.claude.com/docs/en/plugin-marketplaces) and
[hooks](https://code.claude.com/docs/en/hooks) docs.

## Limitations and roadmap

- Theme Check always scans the whole theme (`--path` takes a directory), so on a large theme each
  edit costs a few seconds. The hook filters the report, it does not narrow the scan.
- The reviewer's findings come from a model and vary between runs. `examples/README.md` lists what
  it is instructed to find, not a recorded transcript.
- The CSS budget (about 4 KB per section) is this kit's choice; Shopify does not publish a
  per-section number. The 10 KB JavaScript figure is the default of Theme Check's opt-in
  `AssetSizeJavaScript` check.
- Shopify's Skeleton theme keeps all CSS in `assets/` instead of `{% stylesheet %}`. The
  conventions say to follow the theme you are in, but the scaffolder always uses `{% stylesheet %}`.
- Theme app extensions are not detected as themes.
- Not tested on Windows.
- Not yet run end to end inside a Claude Code session: the install commands follow the plugin and
  marketplace docs, and the plugin loads with `claude --plugin-dir`, but the agent and the
  `/new-section` skill have not been run against a model in this release.
- The reviewer preloads the conventions skill as `shopify-theme-agent-kit:theme-conventions`. The
  docs do not spell out how a plugin agent names a skill from its own plugin, so the agent prompt
  also tells it to read the skill file directly when the skill is not in context.

Possible next steps: a `/new-block` scaffolder for theme blocks, a schema check that settings
referenced in Liquid exist, and a Lighthouse CI job in the theme workflow.

## License

[MIT](LICENSE) - Copyright (c) 2026 Oleksii Shaposhnikov
