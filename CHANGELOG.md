# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-13

### Added

- Claude Code plugin manifest (`.claude-plugin/plugin.json`) and a single-plugin
  marketplace (`.claude-plugin/marketplace.json`).
- `theme-conventions` skill: sourced rules for section and block schema, settings and
  translation keys, JavaScript as custom elements, responsive images, accessibility and
  per-section CSS/JS budgets.
- `theme-reviewer` agent: reviews a theme diff and returns findings ranked by severity with
  `file:line` and a fix.
- `new-section` skill (`/shopify-theme-agent-kit:new-section <name>`): scaffolds a section
  with schema, schema translations, `{% stylesheet %}` and a preset.
- PostToolUse hook that runs `shopify theme check` after edits to `.liquid` and `.json` theme
  files and reports errors for the edited file.
- `AGENTS.md` with the same conventions for other coding agents.
- `examples/bad-section.liquid` with the expected findings.
- `ci/theme-ci.yml` and `ci/validate-theme-json.mjs`: copyable theme CI.
- Tests (node:test) and GitHub Actions CI for this repository.
