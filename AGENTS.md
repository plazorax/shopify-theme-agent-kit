# AGENTS.md - Shopify theme conventions

Instructions for coding agents working on a Shopify Online Store 2.0 theme. Copy this file to
the root of your theme repository. It is a condensed version of
[`skills/theme-conventions/SKILL.md`](skills/theme-conventions/SKILL.md), which lists the
source for every rule.

## Before you finish

- Run `shopify theme check --fail-level error` and fix every error in files you touched.
- Run `node .github/scripts/validate-theme-json.mjs .` if the theme uses the CI template from
  this kit.

## Schema

- One `{% schema %}` per section/block file, valid JSON only, not inside another Liquid tag.
- Setting ids are unique within a section and within each block; use `snake_case`.
- Sections merchants can add need a `presets` entry with a `name`. Theme blocks need presets too.
- Use `enabled_on` or `disabled_on` (not both); set `max_blocks` when the layout has a limit.

## Translations

- Every schema string (`name`, `label`, `info`, option labels, preset names) is a `t:` key in
  `locales/en.default.schema.json`, path `sections.<file-name>.settings.<id>.label`.
- Storefront text uses `{{ 'key' | t }}` with keys in `locales/en.default.json`. No hardcoded
  English in markup.

## JavaScript and CSS

- No inline `<script>` behavior and no `onclick=`-style attributes. Write a custom element in
  `assets/<name>.js` and load it with `defer`. Pass data via `data-*` attributes.
- No parser-blocking or remotely hosted scripts; use `asset_url`.
- Section CSS goes in one `{% stylesheet %}` tag with selectors prefixed by the section class.
  If the theme keeps all CSS in `assets/`, follow the theme instead.
- No Liquid inside `{% stylesheet %}` or `{% javascript %}`; use CSS custom properties set on
  the section element for per-instance values.
- Budget per section: about 4 KB of CSS and at most 10 KB of compressed JavaScript.

## Images

- Use `image_url` + `image_tag` (never `img_url` or hand-built URLs), with 4-6 `widths` and a
  `sizes` that matches the layout.
- Lazy-load below the fold only; the first section's main image uses `loading: 'eager'` and
  `fetchpriority: 'high'`.
- Every image has `alt`; decorative images use `alt: ''`.

## Accessibility

- Interactive elements are `<a>` or `<button>` and work with the keyboard.
- Visible `:focus-visible` styles; body text contrast at least 4.5:1, icons 3:1.
- Headings in order (sections usually start at `h2`); form fields have labels.
- Touch targets at least 44 x 44 px; `aria-expanded` on toggles, `aria-live` for live updates.
- No autoplaying media; slideshows that advance on their own can be paused.
