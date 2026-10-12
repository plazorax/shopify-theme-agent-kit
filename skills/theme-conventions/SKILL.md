---
name: theme-conventions
description: Conventions for Shopify Online Store 2.0 theme code - section and block schema, setting ids, translation keys, JavaScript as custom elements, responsive images, accessibility and per-section CSS/JS budgets. Use when writing, editing or reviewing .liquid files, section or block schema, theme JSON templates, locales, or theme CSS/JS.
---

# Shopify theme conventions (Online Store 2.0)

Rules have ids (for example `SCH-1`) so reviews can cite them. Each rule names its source;
`[Sx]` refers to the list at the end. "Kit default" marks a choice this kit makes where Shopify
does not publish a number or a rule. Run `shopify theme check --fail-level error` before you
finish; it enforces part of this list automatically [S12].

## Sections and blocks schema

- **SCH-1** One `{% schema %}` tag per section or block file, containing only valid JSON, not
  nested inside another Liquid tag. Liquid inside it is not rendered. [S1]
- **SCH-2** Setting ids are unique within the section, and within each block. Block `type`
  and `name` are unique within the section. [S1]
- **SCH-3** Give every section that merchants should be able to add a `presets` entry with a
  `name`; files without presets cannot be added from the theme editor and must be placed in
  JSON templates by hand. Theme blocks (`blocks/*.liquid`) need presets for the same
  reason. [S1] [S15]
- **SCH-4** Use `enabled_on` or `disabled_on` (never both) to limit where a section can be
  added, for example `"disabled_on": { "groups": ["header", "footer"] }`. [S1]
- **SCH-5** Set `max_blocks` when the layout breaks past a known count (the hard limit is 50
  blocks per section). [S1]
- **SCH-6** Prefer theme blocks (`blocks/`, `"type": "@theme"`, rendered with
  `{% content_for 'blocks' %}`) for content reused across sections. [S2]

## Settings and translations

- **SET-1** Setting ids are `snake_case` and describe the value, not the control:
  `heading`, `image`, `show_vendor`, `padding_block`. Kit default following Dawn [S13].
- **SET-2** `range` settings need numeric `min`, `max`, `step` and a required `default`;
  string values are an error. [S3] Keep the `default` on a `step`, because the editor rounds
  values to the closest step (kit default).
- **I18N-1** Every merchant-facing schema string (`name`, `label`, `info`, option labels,
  preset names) is a `t:` key that resolves in `locales/en.default.schema.json`, for
  example `"label": "t:sections.hero-banner.settings.heading.label"`. [S4]
- **I18N-2** Key path = `sections.<file-name>.settings.<setting-id>.label` (blocks:
  `sections.<file-name>.blocks.<type>...`, theme blocks: `blocks.<file-name>...`). Kit
  default following Dawn's locale layout [S13].
- **I18N-3** Storefront text that is not a merchant setting goes through the `t` filter with
  keys in `locales/en.default.json` (`{{ 'sections.cart.empty' | t }}`); no hardcoded
  English in markup. [S5] Theme Check reports missing keys (`TranslationKeyExists`). [S12]

## JavaScript and CSS

- **JS-1** No inline `<script>` with behavior and no `on*=""` attributes. Put behavior in
  `assets/<name>.js` as a custom element (`class HeroBanner extends HTMLElement`,
  `customElements.define('hero-banner', ...)`) and wrap the markup in `<hero-banner>`.
  Pattern used throughout Dawn's `assets/` [S13]; API [S14].
- **JS-2** Load scripts with `defer` (or `async` for independent third-party scripts);
  parser-blocking scripts are a Theme Check error (`ParserBlockingScript`). [S8] [S12]
- **JS-3** Pass per-instance data through `data-*` attributes, not Liquid inside JavaScript.
  Liquid is not rendered inside `{% javascript %}` or `{% stylesheet %}`. [S6] For larger
  data, Dawn uses a `<script type="application/json">` block read by the custom element. [S13]
- **JS-4** Host scripts on Shopify's CDN (`asset_url`); remote assets are a Theme Check
  warning (`RemoteAsset`) and the Theme Store only allows approved third-party
  libraries. [S11] [S12]
- **CSS-1** Section CSS lives in the section's single `{% stylesheet %}` tag, with every
  selector prefixed by the section's class (`.hero-banner__heading`), never bare element or
  global selectors. [S7] [S6] Shopify's Skeleton theme instead keeps all CSS and JS in
  `assets/` and avoids `{% stylesheet %}` [S13]; if the theme you are editing does that,
  follow the theme and use `assets/section-<name>.css`. Consistency wins.
- **CSS-2** Instance-specific values (colors, spacing from settings) go into a small inline
  `<style>` tag [S6], scoped to `#shopify-section-{{ section.id }}`, or into CSS custom
  properties on the section element (`style="--hero-banner-padding: 36px"`), as Dawn
  does. [S13]
- **BUD-1** Budget per section (kit default): at most ~4 KB of uncompressed CSS in
  `{% stylesheet %}` and at most 10 KB of compressed JavaScript per asset file. The JS figure
  matches the default threshold of Theme Check's opt-in `AssetSizeJavaScript` check; enable
  it in `.theme-check.yml` to enforce it. [S12]

## Images

- **IMG-1** Render images with `image_url` + `image_tag`, never hand-built CDN URLs or the
  deprecated `img_url`. `image_tag` adds `width`, `height`, `alt` and `srcset`. [S9] [S8]
- **IMG-2** Pass `widths` (four to six values) and a `sizes` that matches the layout
  (`'100vw'`, `'(min-width: 990px) 50vw, 100vw'`). [S8] [S9] `sizes: 'auto'` only works
  with `loading: 'lazy'`. [S14]
- **IMG-3** Lazy-load images below the fold; never lazy-load the LCP image. Give the first
  section's hero `loading: 'eager'` and `fetchpriority: 'high'`. [S8] [S9]
- **IMG-4** Every `<img>` has an `alt`; use `alt: ''` only for decorative images. [S10] [S11]

## Accessibility checklist

- **A11Y-1** Interactive elements are `<a>` or `<button>`, reachable and operable by
  keyboard, including dropdown navigation. No clickable `<div>`. [S10] [S11]
- **A11Y-2** Visible focus state on every focusable element (`:focus-visible`). [S11]
- **A11Y-3** Text contrast at least 4.5:1 for body text; icons at least 3:1; color is not the
  only signal. [S10] [S11]
- **A11Y-4** Headings in sequence; a section heading is usually `h2`. [S10]
- **A11Y-5** Form fields have labels; required inputs use `required`. [S10]
- **A11Y-6** Touch targets on primary controls at least 44 x 44 px. [S10]
- **A11Y-7** Collapsibles expose `aria-expanded`; dynamic updates (cart count, errors) use
  `aria-live`. [S10]
- **A11Y-8** Media does not autoplay; auto-advancing slideshows can be paused. [S10]

## Sources

- [S1] Section schema - https://shopify.dev/docs/storefronts/themes/architecture/sections/section-schema
- [S2] Theme blocks - https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks
- [S3] Input settings - https://shopify.dev/docs/storefronts/themes/architecture/settings/input-settings
- [S4] Schema locale files - https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files
- [S5] Storefront locale files - https://shopify.dev/docs/storefronts/themes/architecture/locales/storefront-locale-files
- [S6] JavaScript and stylesheet tags - https://shopify.dev/docs/storefronts/themes/best-practices/javascript-and-stylesheet-tags
- [S7] `stylesheet` tag - https://shopify.dev/docs/api/liquid/tags/stylesheet
- [S8] Performance best practices - https://shopify.dev/docs/storefronts/themes/best-practices/performance
  (see "Use defer and async", "Serve correctly sized images with srcset and sizes",
  "Never lazy-load the LCP image")
- [S9] `image_url` / `image_tag` - https://shopify.dev/docs/api/liquid/filters/image_url,
  https://shopify.dev/docs/api/liquid/filters/image_tag
- [S10] Accessibility best practices - https://shopify.dev/docs/storefronts/themes/best-practices/accessibility
- [S11] Theme Store requirements - https://shopify.dev/docs/storefronts/themes/store/requirements
- [S12] Theme Check checks - https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks
- [S13] Dawn - https://github.com/Shopify/dawn ; Skeleton theme - https://github.com/Shopify/skeleton-theme
- [S14] MDN: using custom elements - https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements ;
  `<img sizes>` - https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#sizes
- [S15] Sections (presets) - https://shopify.dev/docs/storefronts/themes/architecture/sections
