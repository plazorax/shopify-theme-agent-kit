# Limitations and roadmap

- Theme Check always scans the whole theme (`--path` takes a directory), so on a large theme each
  edit costs a few seconds. The hook filters the report, it does not narrow the scan.
- The reviewer's findings come from a model and vary between runs.
  [`examples/README.md`](../examples/README.md) lists what it is instructed to find, not a recorded
  transcript.
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
