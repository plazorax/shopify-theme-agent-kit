# Shopify Theme Agent Kit

![CI](https://github.com/plazorax/shopify-theme-agent-kit/actions/workflows/ci.yml/badge.svg)

A Claude Code plugin and an `AGENTS.md` for Shopify Online Store 2.0 theme development: sourced
theme conventions, a diff reviewer, a section scaffolder, and a hook that runs Theme Check after
every edit to a `.liquid` or `.json` theme file.

## Why

- Coding agents write Liquid that renders but breaks theme conventions: inline scripts, hardcoded
  English in schema labels, `img_url` without `srcset`, clickable `<div>`s.
- Theme Check catches part of that, but only when someone runs it. This kit runs it after each
  edit, so the agent sees errors immediately.
- A reviewer agent covers what Theme Check does not.

## Install

Inside Claude Code:

```text
/plugin marketplace add plazorax/shopify-theme-agent-kit
/plugin install shopify-theme-agent-kit@plazorax
```

The hook needs Node 20+ and the Shopify CLI (`npm install -g @shopify/cli`); without the CLI it
reports that the check was skipped. Shell and local-checkout installs: [docs/usage.md](docs/usage.md).

## Usage

Scaffold a section, then let the reviewer check your diff:

```text
/shopify-theme-agent-kit:new-section hero-banner
@agent-shopify-theme-agent-kit:theme-reviewer review my changes
```

When Claude writes a file with errors, such as
[`examples/bad-section.liquid`](examples/bad-section.liquid), the hook blocks and Claude sees:

```text
Theme Check found 3 error(s) in sections/bad-section.liquid. Fix them before moving on:
  sections/bad-section.liquid:5:1 [error] ParserBlockingScript: Avoid parser blocking scripts by adding `defer` or `async` on this tag
  sections/bad-section.liquid:15:7 [error] ImgWidthAndHeight: Missing width and height attributes on img tag
  ... (full output in docs/usage.md)
```

## What's inside

- [`theme-conventions`](skills/theme-conventions/SKILL.md) skill: rules with ids (`SCH-1`, `IMG-3`, ...), each citing shopify.dev, the Theme Store requirements or Dawn.
- [`new-section`](skills/new-section/SKILL.md) skill: creates a section with schema, `t:` labels, `{% stylesheet %}` and a preset, then runs Theme Check.
- [`theme-reviewer`](agents/theme-reviewer.md) agent: read-only diff review, findings ranked by severity with `path:line`, rule and fix.
- [Theme Check hook](scripts/theme-check-hook.mjs): blocks on errors in the edited file, passes warnings as context.
- [`AGENTS.md`](AGENTS.md): the same conventions for agents that do not use Claude Code plugins.
- [`ci/`](ci/): copyable theme CI workflow and a JSON/schema validator that runs without the Shopify CLI.

Docs: [usage](docs/usage.md) · [configuration](docs/configuration.md) · [how it works](docs/how-it-works.md) · [development](docs/development.md) · [limitations](docs/limitations.md)

## Status

v0.1.0 — reference implementation. The plugin passes `claude plugin validate --strict` and loads
with `--plugin-dir`, but the reviewer agent and `/new-section` have not yet been run end to end
in a live Claude Code session. Not tested on Windows. See [docs/limitations.md](docs/limitations.md).

## License

[MIT](LICENSE) © 2026 Oleksii Shaposhnikov
