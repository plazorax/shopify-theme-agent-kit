# Configuration

## Requirements

The hook needs Node 20+ and, to do anything useful, the Shopify CLI
(`npm install -g @shopify/cli`). Without the CLI it tells the agent that the check was skipped.

## Hook settings

Set these as environment variables for the Claude Code session.

| Variable | Effect |
| --- | --- |
| `SHOPIFY_CLI_BIN` | Path to the Shopify CLI. Default: `shopify` on `PATH`. |
| `SHOPIFY_THEME_CHECK_HOOK=off` | Disable the hook. |
| `SHOPIFY_THEME_CHECK_TIMEOUT` | Seconds before the check is abandoned. Default: 90. Keep it below the 120-second `timeout` in [`hooks/hooks.json`](../hooks/hooks.json), which Claude Code enforces. |
