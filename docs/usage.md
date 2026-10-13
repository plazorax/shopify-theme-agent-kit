# Usage

| Component | How to use it |
| --- | --- |
| `theme-conventions` skill | Loaded by Claude when it works on theme files. Rules have ids (`SCH-1`, `IMG-3`, ...) and cite shopify.dev, the Theme Store requirements, or Dawn. See [`skills/theme-conventions/SKILL.md`](../skills/theme-conventions/SKILL.md). |
| `new-section` skill | `/shopify-theme-agent-kit:new-section hero-banner` creates `sections/hero-banner.liquid` with schema, `t:` labels, `{% stylesheet %}` and a preset, merges the labels into `locales/en.default.schema.json`, then runs Theme Check. |
| `theme-reviewer` agent | `@agent-shopify-theme-agent-kit:theme-reviewer review my changes` reads the git diff and returns findings ranked critical / high / medium / low, each with `path:line`, the rule, and a fix. It does not edit files. |
| Theme Check hook | Runs automatically after `Write` / `Edit` / `MultiEdit` on `.liquid` or `.json` files inside a theme. Settings: [configuration.md](configuration.md). |
| [`AGENTS.md`](../AGENTS.md) | Copy into a theme repository for agents that read `AGENTS.md` instead of Claude Code plugins. |
| [`ci/theme-ci.yml`](../ci/theme-ci.yml) | Copy to `.github/workflows/theme-ci.yml`, and [`ci/validate-theme-json.mjs`](../ci/validate-theme-json.mjs) to `.github/scripts/`, to run Theme Check and the schema validator on every pull request. |

## Installing from a shell or a local checkout

The same install as the `/plugin` commands in the README, from a shell:

```bash
claude plugin marketplace add plazorax/shopify-theme-agent-kit
claude plugin install shopify-theme-agent-kit@plazorax
```

For local development, load a checkout without installing it:

```bash
git clone https://github.com/plazorax/shopify-theme-agent-kit
claude --plugin-dir ./shopify-theme-agent-kit
```

## Example: the hook after an edit

[`examples/bad-section.liquid`](../examples/bad-section.liquid) collects common mistakes. When
Claude writes it to `sections/`, the hook exits with code 2 and Claude sees:

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

[`examples/README.md`](../examples/README.md) lists what the JSON validator and the reviewer add on
top (duplicate setting id, inline script, clickable `<div>`, global CSS, hardcoded labels, missing
presets).
