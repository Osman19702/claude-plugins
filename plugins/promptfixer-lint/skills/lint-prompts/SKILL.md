---
name: lint-prompts
description: Diagnose an existing prompt file before rewriting it - score it 0-100 and list its concrete defects with PromptFixer's deterministic rules. Use when the user asks why the model keeps ignoring half of a prompt, wants a CLAUDE.md, an agent system prompt, a prompt template or the instruction body of a slash command checked before committing, wants two versions of a prompt compared objectively, wants a directory of prompts triaged worst-first, or wants a CI gate on a prompts/ directory. Also use when a prompt file sets no length or scope bound, asks for citations or statistics without pasting the source material, or points at "the text below" with no delimiter around it - named rules catch each of those. Offline regex checklist, no model call, no network, no install.
when_to_use: User says "is this prompt any good", "improve this prompt", "review my system prompt and tighten it", "what's wrong with this prompt file", "audit our prompts", "why does it ignore half of what I ask", "lint my prompts", "check this prompt before I commit", "which of these two prompts is worse", "gate our prompts in CI", or pastes a prompt into the chat and asks what is wrong with it. Prompt files only - not READMEs, docs or non-English text.
argument-hint: "[path...] [--intent id]"
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/promptfixer-lint.js" *)
---

# Lint prompts

A regex checklist, not a model. Same numbers every run. Diagnose with it, then rewrite the prompt yourself.

## Run

Needs `node` 18 or newer on `PATH`; nothing else is installed. `node: command not found` (or `'node' is not recognized`) means Node is missing - report that, do not retry and do not fall back to another tool.

If the invocation supplied arguments (`$ARGUMENTS`), lint exactly those paths and flags. Otherwise ask which path to lint - never default to `.`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/promptfixer-lint.js" <path...>
```

Paths are files and/or directories, any number, mixed. Directories are walked recursively for `*.md`, `*.txt` and `*.prompt` (case-insensitive; `.mdx` and `.markdown` are not collected). A file named explicitly is linted whatever its extension. `node_modules` and dot-directories are skipped while descending, so a dot-directory has to be named directly: `.claude/commands` works, while `.` walks the whole working tree without ever reaching `.claude/`. Do not pass `.` - it lints every `.md` in the repo, which is the whole-repo run warned against below.

Flags, and there are no others:

- `--intent <id>` - fallback ruleset for files with no directive: `general`, `code`, `writing`, `analysis`, `agent`, `extraction`, `image`. Default `general`. Pick the one that matches the file; it changes which rules fire.
- `--min-score <n>` - fail any file scoring below `n`, integer 0-100. Default `0`, so by default the score never fails anything.
- `--fail-on <sev>` - fail any file with an issue at or above `high`, `medium`, `low`, or `none` to disable. Default `high`.
- `--json` - one JSON object on stdout and nothing else. Overrides `--quiet`.
- `--quiet` / `-q` - summary line only.
- `--help` / `-h` - usage, exit 0. (Its usage text names the upstream path `scripts/lint-prompts.js`; use the command above.)
- `--` - everything after it is a path, flags included.

`--flag value` and `--flag=value` both work for the three value flags. `--json`, `--quiet` and `--help` take no value: `--json=true` is a usage error.

Typical calls:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/promptfixer-lint.js" .claude/commands/deploy.md --intent agent
node "${CLAUDE_PLUGIN_ROOT}/scripts/promptfixer-lint.js" prompts/ --intent code --min-score 70 --fail-on medium
node "${CLAUDE_PLUGIN_ROOT}/scripts/promptfixer-lint.js" prompts/ --json
```

**A prompt pasted into the chat.** There is no stdin, so the text has to reach a file first. If it is longer than about 15 words, write it to a temp file, lint that, delete the file, and report against the name the user knows it by rather than the temp path. If it is shorter, the score ceiling below makes the number meaningless - read it yourself and say so instead of running the linter.

## Read the output

One line per file, then a summary:

```
PASS  prompts/good.md  score  96  high 0  medium 0  low 2  top: Prompt is thin on detail; No success criteria or constraints
FAIL  prompts/draft.md  score  30  high 3  medium 1  low 1  top: Prompt is very short; Unfilled placeholders left in the prompt
2 files, 1 passed, 1 failed (min score 0, fail on high)
```

`top:` names the worst two issues and is omitted when a file has none. Paths are relative to the working directory when inside it, otherwise absolute, so keep the cwd fixed if you compare runs.

Files print in walk order - alphabetical by path, not by score - so sort by the score column yourself when triaging a directory worst-first, or use `--json` and sort `files[].score`.

`--json` gives `{ files: [{ path, intent, score, categories, issues, passed }], summary: {...} }`. Each issue has `id`, `title`, `category`, `severity`, `detail`, `suggestion`, `evidence`, sorted high to low. Read `suggestion` - it is the actionable part, and it is intent-aware. `categories` are clarity, specificity, context, format, structure; the overall score is their weighted mean (clarity 25, specificity 25, format 20, context 15, structure 15).

## Common jobs

- **Compare two versions.** Lint both in one invocation with `--json` and compare `score` plus the five `categories` - the plain output prints severity counts and two issue titles, never the per-category breakdown. Name which category moved and by how much.
- **Triage a directory.** Output is ordered by filename, not by score. Sort the lines yourself, lowest score first (or by `high` count), before reporting, and name the worst three.

## Exit codes

- `0` - every file passed (or `--help`).
- `1` - at least one file scored below `--min-score` or carries an issue at or above `--fail-on`. Results still print. A Node stack trace on stderr with exit 1 means a crash (e.g. an unreadable subdirectory), not a lint failure - check stderr before reporting.
- `2` - usage error, printed to stderr as `lint-prompts: <message>`. Causes include an unknown flag or intent, a missing path, no prompt files under a directory, an unreadable file, or a typo in a file's intent directive. The last few abort the whole run: nothing is printed for the files that already passed.

## On failure

Report the failing files, their scores and the high-severity issue titles. Then fix the prompt against each issue's `suggestion` and re-run to confirm. Do not loosen `--fail-on` or `--min-score` to make it pass unless the rule genuinely does not apply to that file - say so if it does not.

Per-file intent beats a global flag. Add this as the **very first line** of a file (anywhere else it is silently ignored):

```
<!-- promptfixer: intent=code -->
```

The line is stripped before scoring. A typo in the intent id fails the entire run with exit 2.

## Do not use it for

- **Repo roots, `docs/`, READMEs, CHANGELOGs.** It lints every `.md` it walks as a prompt, and ordinary docs reliably trip `no-task-verb`, `placeholders` (a literal TODO/TBD/FIXME) and `conflict-*` ("concise" and "detailed" in one file). Always pass a narrow path.
- **Judging whether a prompt will actually work**, or its prose quality, correctness or facts. It cannot tell a brilliant prompt from a well-formatted empty one.
- **Rewriting.** Diagnose here, rewrite yourself - you are the better rewriter, and the linter scores an honest rewrite's `[unknown]` markers as high-severity placeholders.
- **Non-English prompts.** The task-verb list is 52 English verbs; anything else scores `no-task-verb` at high severity and the score is meaningless.
- **Short prompts with a score floor.** The ceiling is `min(100, 50 + 5 * max(0, words - 5))` - 50 for anything up to 5 words, then 5 points per word to 100 at 15 words - so a 5-word prompt caps at 50 and a 10-word one at 75. `--min-score 80` fails every good one-line command.
- **Piped text, strings or heredocs.** There is no stdin and no `-`. For a prompt pasted into the chat, follow the rule under **Run** instead.
- **A whole-repo pre-commit hook.** Without a narrow path and a considered `--fail-on` it blocks commits on documentation.

### Known false positive: Claude Code command files

A `.claude/commands/*.md` file whose frontmatter carries `argument-hint: [pr-number]` scores a **high** `placeholders` issue with `[pr-number]` as its evidence. Frontmatter is not stripped before scoring and the bracket-slot rule cannot tell a documented argument hint from `[insert topic]`. That is correct Claude Code syntax, not a defect.

When every `placeholders` evidence token is an argument hint or an `$ARGUMENTS`-style slot, say so and ignore that one issue rather than editing the frontmatter - this is the case the `--fail-on` rule above means by "the rule genuinely does not apply". Judge the file on its remaining issues. Use `--json` to read the `evidence` array when the plain output does not show you the tokens.

Also worth knowing: each file is scored as one whole prompt - YAML frontmatter counts as prompt text, though fenced and inline code is stripped before the wording rules (shouting, filler, intensifiers, run-on, placeholders) and still counts toward the word count - and an empty or whitespace-only `.md` in a walked directory scores 0 with a high issue, failing the run on its own. Nothing is ever written to disk; results go to stdout, usage errors and the usage block to stderr.
