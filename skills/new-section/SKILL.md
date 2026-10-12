---
description: Scaffold a new Online Store 2.0 section with a schema, schema translations, a {% stylesheet %} block and a preset. Run as /new-section <name>, where <name> is kebab-case.
argument-hint: <section-name>
disable-model-invocation: true
---

# Scaffold a section: `$0`

Create the section `$0` in the current Shopify theme. Follow the `theme-conventions`
skill of this plugin for every rule referenced below.

## Steps

1. **Validate the name.** `$0` must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. If it does not,
   or if no name was given, stop and ask for one.
2. **Find the theme root.** It is the nearest directory that contains `layout/theme.liquid`
   (or both `sections/` and `config/`). If there is none, stop and say so.
3. **Refuse to overwrite.** If `sections/$0.liquid` already exists, stop and report it.
4. **Write `sections/$0.liquid`** from the reference template below. Replace every
   `hero-banner` / `HeroBanner` / `Hero banner` with the new name in the matching case.
   Keep the structure, then adapt settings and markup to what the user asked for. Keep:
   - one `{% schema %}` with `"name"` and every label as a `t:` key (SCH-1, I18N-1);
   - snake_case setting ids (SET-1) and a `presets` entry (SCH-3);
   - CSS only inside `{% stylesheet %}` with classes prefixed by the section name (CSS-1);
   - no inline `<script>`; if behavior is needed, create `assets/$0.js` as a custom element
     and load it with `defer` (JS-1);
   - images through `image_url` + `image_tag` with `widths` and `sizes` (IMG-1).
5. **Merge the schema translations** into `locales/en.default.schema.json` (create it if
   missing) under `sections.$0`. Do not remove existing keys. If other `*.schema.json`
   locales exist, add the same keys with the English text and tell the user they need
   translating.
6. **Verify.** Run `shopify theme check --path <theme-root> --fail-level error` if the CLI is
   available and fix any error in the new files. Report the files you created or changed.

## Reference template

```liquid title="sections/hero-banner.liquid"
{%- liquid
  assign loading = 'lazy'
  assign fetchpriority = 'auto'
  if section.index == 1
    assign loading = 'eager'
    assign fetchpriority = 'high'
  endif
-%}

<div
  class="hero-banner"
  style="--hero-banner-padding: {{ section.settings.padding_block }}px;"
>
  <div class="hero-banner__media">
    {%- if section.settings.image != blank -%}
      {{
        section.settings.image
        | image_url: width: 2400
        | image_tag:
          class: 'hero-banner__image',
          widths: '750, 1100, 1500, 1800, 2400',
          sizes: '100vw',
          loading: loading,
          fetchpriority: fetchpriority
      }}
    {%- else -%}
      {{ 'hero-apparel-1' | placeholder_svg_tag: 'hero-banner__image' }}
    {%- endif -%}
  </div>

  <div class="hero-banner__content">
    {%- if section.settings.heading != blank -%}
      <h2 class="hero-banner__heading">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- if section.settings.text != blank -%}
      <div class="hero-banner__text">{{ section.settings.text }}</div>
    {%- endif -%}

    {%- for block in section.blocks -%}
      {%- case block.type -%}
        {%- when 'button' -%}
          {%- if block.settings.label != blank and block.settings.link != blank -%}
            <a class="hero-banner__button" href="{{ block.settings.link }}" {{ block.shopify_attributes }}>
              {{- block.settings.label | escape -}}
            </a>
          {%- endif -%}
      {%- endcase -%}
    {%- endfor -%}
  </div>
</div>

{% stylesheet %}
  .hero-banner {
    display: grid;
    padding-block: var(--hero-banner-padding, 36px);
  }

  .hero-banner__media,
  .hero-banner__content {
    grid-area: 1 / 1;
  }

  .hero-banner__image {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  .hero-banner__content {
    align-self: center;
    justify-self: center;
    max-width: 40rem;
    padding: 1.5rem;
    text-align: center;
  }

  .hero-banner__button {
    display: inline-block;
    min-height: 44px;
    padding: 0.75rem 1.5rem;
  }

  .hero-banner__button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }
{% endstylesheet %}

{% schema %}
{
  "name": "t:sections.hero-banner.name",
  "tag": "section",
  "class": "section-hero-banner",
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    {
      "type": "image_picker",
      "id": "image",
      "label": "t:sections.hero-banner.settings.image.label"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "t:sections.hero-banner.settings.heading.label",
      "default": "Hero banner"
    },
    {
      "type": "richtext",
      "id": "text",
      "label": "t:sections.hero-banner.settings.text.label"
    },
    {
      "type": "range",
      "id": "padding_block",
      "label": "t:sections.hero-banner.settings.padding_block.label",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "default": 36
    }
  ],
  "blocks": [
    {
      "type": "button",
      "name": "t:sections.hero-banner.blocks.button.name",
      "settings": [
        {
          "type": "text",
          "id": "label",
          "label": "t:sections.hero-banner.blocks.button.settings.label.label",
          "default": "Shop now"
        },
        {
          "type": "url",
          "id": "link",
          "label": "t:sections.hero-banner.blocks.button.settings.link.label"
        }
      ]
    }
  ],
  "max_blocks": 2,
  "presets": [
    {
      "name": "t:sections.hero-banner.presets.name",
      "blocks": [{ "type": "button" }]
    }
  ]
}
{% endschema %}
```

Keys to merge into `locales/en.default.schema.json`:

```json title="locales/en.default.schema.json"
{
  "sections": {
    "hero-banner": {
      "name": "Hero banner",
      "settings": {
        "image": { "label": "Image" },
        "heading": { "label": "Heading" },
        "text": { "label": "Text" },
        "padding_block": { "label": "Vertical padding" }
      },
      "blocks": {
        "button": {
          "name": "Button",
          "settings": {
            "label": { "label": "Label" },
            "link": { "label": "Link" }
          }
        }
      },
      "presets": {
        "name": "Hero banner"
      }
    }
  }
}
```
