# osman-plugins

A Claude Code plugin marketplace. Two free, MIT-licensed plugins.

```
/plugin marketplace add Osman19702/claude-plugins
/plugin install elastishot@osman-plugins
/plugin install promptfixer-lint@osman-plugins
```

If the install summary says `Run /reload-plugins to activate`, run it.

## Plugins

| Plugin | What it gives Claude | Needs |
|---|---|---|
| [**elastishot**](https://github.com/Osman19702/elastishot-claude-plugin) | Compare two screenshots or two page URLs and report the regions **and DOM locators** that changed, even when the layout shifted, zoomed or collapsed. Plus config-driven baselines per target and viewport, redesign approval, and a JUnit CI gate. | `npx` (Node 20+); Playwright only for page URLs |
| [**promptfixer-lint**](plugins/promptfixer-lint) | Score a prompt file 0–100 across clarity, specificity, context, format and structure, with each defect named, severity-ranked and paired with a fix. | Node 18+. Nothing else — no model, no network, no API key, no install |

Each plugin's own README covers usage, prerequisites and the failure paths.

## Relationship to the upstream projects

The plugins are thin, versioned wrappers; the tools they drive live in their own repositories.

- **elastishot** is published on npm, so the plugin vendors no code — its skills invoke `npx elastishot@^0.2.0`. Source: [Osman19702/elastishot](https://github.com/Osman19702/elastishot). The plugin itself lives in its own repository, [Osman19702/elastishot-claude-plugin](https://github.com/Osman19702/elastishot-claude-plugin); this marketplace references it as a `github` source rather than carrying a copy.
- **promptfixer-lint** ships the deterministic linter out of [Osman19702/PromptFixer](https://github.com/Osman19702/PromptFixer) — two dependency-free files, vendored verbatim so the plugin runs standalone. The desktop app, its bundled local model and its cloud providers are **not** part of this plugin. Attribution is in [NOTICE](plugins/promptfixer-lint/NOTICE); `scripts/check-vendored.mjs` fails on any drift from upstream beyond three enumerated rename edits.

## Developing

Test a plugin without installing it:

```bash
claude --plugin-dir ./plugins/promptfixer-lint
```

Validate before publishing — the same check the community review pipeline runs:

```bash
claude plugin validate . --strict
claude plugin validate ./plugins/promptfixer-lint --strict
```

Bump a plugin's `version` in its `.claude-plugin/plugin.json` to ship an update; installs are pinned to that value.

## Licence

MIT — see [LICENSE](LICENSE).
