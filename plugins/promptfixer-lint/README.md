# PromptFixer Lint

A Claude Code plugin that scores a prompt file and tells you, concretely, what is wrong with it.

It is a deterministic regex checklist from [PromptFixer](https://github.com/Osman19702/PromptFixer): no model call, no server, no API key, no network, nothing to install. The same prompt gets the same score every run; the analysis itself is under a millisecond per file, so a run costs about what `node` costs to start.

## Install

```
/plugin marketplace add Osman19702/claude-plugins
/plugin install promptfixer-lint@osman-plugins
```

Then restart Claude Code, or run `/reload-plugins`.

Claude picks the skill up on its own from what you ask; you can also invoke it by name as `/promptfixer-lint:lint-prompts`.

Requires Node.js 18 or newer on your `PATH`. That is the only prerequisite.

## What it does

Once installed, ask Claude things like:

- "Why does the model keep ignoring half of this prompt?"
- "Lint `.claude/commands` before I commit."
- "Which of these two prompt versions is worse, and why?"
- "Set up a CI gate on our `prompts/` directory."

Claude runs the linter, reads the issues and fixes the prompt with you.

To run it yourself outside Claude Code, clone the repo once — the linter is two dependency-free files, so nothing needs installing after the clone:

```bash
git clone --depth 1 https://github.com/Osman19702/claude-plugins ~/claude-plugins
LINT=~/claude-plugins/plugins/promptfixer-lint/scripts/promptfixer-lint.js

node "$LINT" prompts/
node "$LINT" .claude/commands --intent agent
node "$LINT" prompts/ --intent code --min-score 70 --fail-on medium
node "$LINT" prompts/ --json
```

Output is one line per file plus a summary:

```
PASS  prompts/good.md  score  96  high 0  medium 0  low 2  top: Prompt is thin on detail; No success criteria or constraints
FAIL  prompts/draft.md  score  30  high 3  medium 1  low 1  top: Prompt is very short; Unfilled placeholders left in the prompt
2 files, 1 passed, 1 failed (min score 0, fail on high)
```

Each file scores 0-100 as a weighted mean of five categories (clarity 25, specificity 25, format 20, context 15, structure 15), and every issue carries a severity, a detail and a suggested fix. Nothing is written to disk.

### Flags

| Flag | Meaning |
| --- | --- |
| `--intent <id>` | Ruleset for files without a directive: `general`, `code`, `writing`, `analysis`, `agent`, `extraction`, `image`. Default `general`. |
| `--min-score <n>` | Fail any file scoring below `n` (0-100). Default `0`, so the score alone never fails a file. |
| `--fail-on <sev>` | Fail any file with an issue at or above `high`, `medium`, `low`, or `none` to disable. Default `high`. |
| `--json` | One JSON object with every file's score, categories and issues, and nothing else. |
| `--quiet`, `-q` | Summary line only. |
| `--help`, `-h` | Usage, exit 0. |

Exit codes: `0` all passed, `1` at least one file failed, `2` usage error. `--json` still sets the exit code, so it is safe to pipe in CI.

A file can pick its own ruleset with a first-line comment, which is stripped before scoring:

```
<!-- promptfixer: intent=code -->
```

### CI

```yaml
- run: git clone --depth 1 https://github.com/Osman19702/claude-plugins /tmp/cp
- run: node /tmp/cp/plugins/promptfixer-lint/scripts/promptfixer-lint.js prompts/ --intent code --fail-on high
```

Directories are walked recursively for `*.md`, `*.txt` and `*.prompt`. `node_modules` and dot-directories are skipped while descending, so pass a dot-directory explicitly (`.claude/commands`) rather than relying on `.`.

## What it is not

- Not a judge of whether a prompt will work. It cannot tell a brilliant prompt from a well-formatted empty one.
- Not a rewriter. The rewrite half of PromptFixer is a desktop app and is not part of this plugin; inside Claude Code you already have a better model for the rewrite.
- Not a markdown or docs linter. Point it at a `README` or a `docs/` folder and ordinary prose will trip high-severity rules (no task verb, a literal TODO, "concise" and "detailed" in one file). Always pass a narrow path.
- Not usable on non-English prompts: the task-verb list is 52 English verbs.
- Not a stdin tool. There is no `-` and no piping; lint a file.

Short prompts are capped by design: the ceiling is `min(100, 50 + 5 * max(0, words - 5))` — 50 for anything up to 5 words, then 5 points per word up to 100 at 15 words — so a 10-word prompt can never score above 75. Do not set `--min-score` high and expect one-line commands to pass.

One known false positive: a Claude Code command file with `argument-hint: [issue-number]` in its frontmatter scores a high-severity `placeholders` issue on `[issue-number]`. Frontmatter is scored as prompt text and the bracket-slot rule cannot tell a documented argument hint from `[insert topic]`. That is correct syntax — ignore that issue rather than editing the frontmatter.

## Vendored code

`scripts/analyze.js` and `scripts/promptfixer-lint.js` are copied from PromptFixer (`server/analyze.js` and `scripts/lint-prompts.js`), MIT, same author. See [NOTICE](NOTICE). To check them against an upstream checkout:

```bash
node scripts/check-vendored.mjs /path/to/PromptFixer
```

## Licence

MIT. See [LICENSE](LICENSE).
