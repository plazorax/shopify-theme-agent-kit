# Examples

[`bad-section.liquid`](bad-section.liquid) is a deliberately broken slideshow section. It packs
common theme mistakes into one file so you can see which ones each tool catches. Do not copy it
into a theme.

## What Theme Check reports

Recorded with Shopify CLI 4.9.3 after copying the file to `sections/bad-section.liquid` in a
minimal theme (the integration test in `test/integration.test.mjs` repeats this run). This is
the PostToolUse hook's output, which Claude sees after editing the file:

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

## What `ci/validate-theme-json.mjs` adds

```text
sections/bad-section.liquid: duplicate setting id "color"
```

Theme Check 4.9.3 did not report the duplicate setting id on line 35, although the section
schema docs require setting ids to be unique within a section.

## What the theme-reviewer agent should add

Theme Check does not look at conventions, so these are left to the
[`theme-reviewer`](../agents/theme-reviewer.md) agent. This is the list the agent is
instructed to find, not a recorded run; model output varies between runs.

| Line | Severity | Rule | Problem |
| ---- | -------- | ---- | ------- |
| 35 | critical | SCH-2 | Setting id `color` is declared twice. |
| 5 | high | JS-2, JS-4 | Parser-blocking script from a third-party host. |
| 19 | high | A11Y-1 | Clickable `<div onclick>` is not keyboard operable; use a `<button>`. |
| 15 | high | IMG-4 | `<img>` without `alt`. |
| 20 | high | I18N-3 | Translation key `sections.slideshow.pause` is missing from `locales/en.default.json`. |
| 23-27 | high | JS-1, JS-3, A11Y-8 | Inline script with Liquid inside JavaScript; the slideshow advances on its own with no pause control. |
| 15 | medium | IMG-1, IMG-2 | Deprecated `img_url` without `srcset`/`sizes`; use `image_url` + `image_tag`. |
| 7-10 | medium | CSS-1 | Global `.button` and `h2` selectors leak into the rest of the page. |
| 19 | medium | I18N-3 | Hardcoded English text "Next". |
| 31-35 | medium | I18N-1 | Schema name and labels are plain strings instead of `t:` keys. |
| 29-48 | medium | SCH-3 | No `presets`, so the section cannot be added from the theme editor. |
| 34 | low | SET-1 | Setting id `autoPlaySpeed` is camelCase; use `autoplay_speed`. |
| 16 | low | A11Y-4 | Every slide renders an `h2` with no section heading; check heading order. |

Run it yourself from a theme with this file in `sections/`:

```text
@agent-shopify-theme-agent-kit:theme-reviewer review sections/bad-section.liquid
```
