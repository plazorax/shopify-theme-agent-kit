# Development

## Tests

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
CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs all of this on Node 20, 22 and
24 and runs `claude plugin validate --strict`.

## Tested with

Node 22.23.1, 20.20.2 and 24.21.0, npm 10.9.8, Shopify CLI 4.9.3 and 3.51.2 (via the
`--dev-preview` fallback), Claude Code 2.1.282 (`claude plugin validate --strict` and
`claude --plugin-dir . plugin details`), on macOS. The plugin has not yet been exercised in a live
Claude Code session; see [limitations.md](limitations.md).
