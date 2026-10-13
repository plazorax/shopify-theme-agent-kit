# How it works

## Layout

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

`new-section` is written as a skill with `disable-model-invocation: true` rather than a file in
`commands/`, because the Claude Code docs describe `commands/` as the older format that skills
supersede.

## The Theme Check hook

[`scripts/theme-check-hook.mjs`](../scripts/theme-check-hook.mjs) reads the PostToolUse payload
from stdin and takes `tool_input.file_path`. It ignores anything that is not `.liquid` or `.json`,
and anything outside a theme directory (`sections/`, `templates/`, `locales/`, ... under a folder
that has `layout/theme.liquid`, or both `sections/` and `config/`). It then runs
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

## The JSON and schema validator

[`ci/validate-theme-json.mjs`](../ci/validate-theme-json.mjs) runs without the Shopify CLI. It
parses theme JSON (allowing the comment header Shopify writes into JSON templates), checks that
each section and block has at most one `{% schema %}` with valid JSON, unique setting ids and named
presets, and that every `t:` key resolves in `locales/*.default.schema.json`.

## Sources

Rules are taken from [shopify.dev theme docs](https://shopify.dev/docs/storefronts/themes),
the [Theme Store requirements](https://shopify.dev/docs/storefronts/themes/store/requirements),
[Theme Check](https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks) and
[Dawn](https://github.com/Shopify/dawn); the full list with one citation per rule is at the end of
[`skills/theme-conventions/SKILL.md`](../skills/theme-conventions/SKILL.md). Plugin layout and hook
behavior follow the Claude Code
[plugin](https://code.claude.com/docs/en/plugins-reference),
[marketplace](https://code.claude.com/docs/en/plugin-marketplaces) and
[hooks](https://code.claude.com/docs/en/hooks) docs.
