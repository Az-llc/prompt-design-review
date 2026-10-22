# prompt-design-review

A Claude Code plugin that reviews how prompts, CLAUDE.md files and skills are written, and reports the result together with Claude Code's built-in audit (`/doctor prompt-audit`) in one report. It is not a tool for reviewing software design.

[日本語版 README](README.ja.md)

## What it does

Claude Code 2.1.283 and later include a built-in audit that looks for outdated writing in prompt assets. This plugin runs that audit, adds the design gaps it does not check, and reports both side by side.

- The built-in audit, shown as "Claude Code's standard prompt diagnosis": whatever it reports (outdated or over-emphasized wording, nonexistent references, contradictions between files, and anything Anthropic adds later). The plugin shows its findings and its own reasons as they are, so new kinds of findings appear without updating the plugin.
- This plugin's own viewpoints: compatible constraints (within the asset, and between the asset and the CLAUDE.md files and rules that apply to it), delegation instructions, approval and autonomy boundaries, verification and stop conditions, tool-call contracts, connection to external verification, and proposed enforcement points (hooks, permissions, check scripts) for rules a machine can judge
- This plugin's mechanical check (`skills/prompt-design-review/scripts/check.py`): referenced files, the skill header, leftover version notes, and an estimate of how many rules the asset and the files loaded with it contain
- Reported with low confidence: an expert role standing in for context, boundary structure

The report is written in your language for a reader who does not know the plugin's internals, and every item says where it comes from (a paper, an Anthropic document, the standard prompt diagnosis, or this plugin's own check or judgment) so that you can judge it yourself:

- Header and conclusion: an overall verdict (needs fixing / minor findings only / no findings / no findings in what could be checked), notes on anything that limits the report, a caution when too many rules apply at the same time, and what happens if the asset is used as it is.
- This plugin's viewpoints: one row per viewpoint, with why it matters, its evidence, the verdict with its impact, and the location and action.
- Claude Code's standard prompt diagnosis: one row per finding it reported, with its own reason. When both flag the same spot, the finding is numbered once.
- Recommended timing ("before using it", "when there is time", and "your call" for low-confidence findings), the details of each finding (quote, problem, proposed diff, confidence), and the sentences that should be kept.
- Next action: numbered choices (apply "before using it", apply that and "when there is time", pick findings yourself, or see the full improved text first without changing any file), with the number of findings that would remain for each. Reply with a number; "your call" findings are applied only when you name them.

When too many rules apply at the same time, some of them are likely not to be followed. When the asset's own mechanical count is over the guide, the review reads each counted sentence in context, decides whether it is a rule and in which stage of the asset's work it applies (while working, when checking, only when applying, and so on), and reports the rules of the busiest stage (marked as this plugin's judgment, which may be higher because it starts from sentences found by wording; files loaded with the asset are not added). If that count is over the guide, a caution says that the more rules apply at the same time, the less reliably all are followed (Eliav 2026, a preprint); that where this starts differs between models (the same study) and, in this plugin's judgment, with the difficulty of the rules, so the guide of 40 is this plugin's own choice; that counting by stage is this plugin's inference; and suggests moving machine-judgeable rules into scripts or hooks, or splitting the stage. The report gives no study numbers; [docs/rule-count-experiment.md](docs/rule-count-experiment.md) records a small experiment on current Claude models as background. Separately, when the instruction files Claude Code loads with the asset push the total over the guide, a short note names them with their counts, which are not judged by stage.

This review only reads documents. It cannot show that following a finding improves behavior; confirming an effect needs a behavioral test.

## Install

In Claude Code:

```text
/plugin marketplace add Az-llc/prompt-design-review
/plugin install prompt-design-review@az-llc
```

On Claude Code 2.1.275 or later, one line also works:

```text
/plugin install prompt-design-review --marketplace Az-llc/prompt-design-review
```

From a shell:

```bash
claude plugin marketplace add Az-llc/prompt-design-review
claude plugin install prompt-design-review@az-llc
```

### Update

Background auto-update is off by default for this marketplace, as for every third-party marketplace. To get a new version, run in a shell:

```bash
claude plugin update prompt-design-review@az-llc
```

or, in a session, open the plugin on the **Installed** tab of `/plugin` and select **Update now**. The new version loads in the next session, or after `/reload-plugins`. To update automatically, open **Marketplaces** in `/plugin`, select `az-llc`, and select **Enable auto-update**.

## Usage

Plugin skills are namespaced by the plugin name, so the skill runs as:

```text
/prompt-design-review:prompt-design-review <path of the SKILL.md / CLAUDE.md / rule to review>
```

Claude also uses the skill on its own when you ask it to review or audit a prompt, skill or CLAUDE.md, or to check one after writing or editing it.

- Given a file, it looks at that file only (CLAUDE.md files and rules that apply to the asset are read only to check for conflicts).
- Given a folder, it looks at every instruction file in it.
- Given nothing, it asks for the target and stops; run the command again with the target.
- Only when you ask for "all" does it look at the instruction files of the project and of `~/.claude`. Unless you already consented in the conversation, it shows the number of files, asks for consent and stops; run the command again with "all" after consenting. The built-in audit cost about 0.7 to 1.3 USD per file, and about 1.3 to 1.8 USD for a whole project in one call (measured 2026-10 in the author's environment; it changes with pricing and model).

The target is rewritten only for the findings you select from the report. The turn the command starts cannot use the edit tools. To apply findings, reply with a number from the report's next-action table or name the findings in a plain message; do not run the command again, because that removes the edit tools again. If applying them adds text, the plugin rechecks the changed lines for conflicts and proposes running the built-in audit again on the changed asset. After any applied change, it runs `skills/prompt-design-review/scripts/check.py --strict` on the changed files.

## Prerequisites

- Claude Code 2.1.283 or later (for the built-in audit). Where `claude -p` cannot be used, or for prompts meant for GPT or Gemini, the diagnosis section says it did not run, the plugin checks prohibitions without reasons in its place, and the seven viewpoints still apply.
- The built-in audit is run by `skills/prompt-design-review/scripts/run-audit.py`: from an empty temporary folder, in safe mode (`--safe-mode`), with the target's folder passed by `--add-dir`, only reading tools (so it cannot change the target or run commands, and it does not look at git history), and a time limit that stays under the Bash tool's 10 minutes. Safe mode keeps your own `~/.claude` CLAUDE.md, rules, skills and plugins, and those of the project you are working in, out of the diagnosis, so your personal rules do not color its judgment; conflicts with the CLAUDE.md files that apply to the asset are checked by this plugin's first viewpoint instead. If it fails, the report says so in plain words and marks what was not checked.
- Python 3 (standard library only).

## check.py

```text
python skills/prompt-design-review/scripts/check.py [--warn-rules N] [--root DIR] [--strict] [--no-context] PATH [PATH ...]
python skills/prompt-design-review/scripts/check.py --self-test
```

The paths here are relative to a clone of this repository. The installed plugin's copy lives in a folder whose path changes with each version, so for hooks and CI use a clone pinned to a tag or commit, or copy check.py into your own repository.

For each file it reports the estimated number of rules (directive sentences, English and Japanese phrasing) together with the instruction files Claude Code would load with it (`rule_load`), prohibition lines, referenced paths that do not exist and references it did not probe, duplicated sentences (informational), version comments in the body, and the frontmatter (presence and form of name and description). Line 1 of the output is JSON, followed by a human-readable summary. A file that cannot be read as UTF-8 gets an `error` in its own entry, and the remaining checks continue.

- Rules are estimated from wording, so some are missed or miscounted. `rule_load` adds the files Claude Code loads at start-up for a session in the target's folder, as this tool reads the Claude Code memory documentation (the project root is an assumption): CLAUDE.md and CLAUDE.local.md in that folder and every parent folder; `.claude/CLAUDE.md` and `.claude/rules/**/*.md` without `paths` at the project root (the nearest folder with `.git`); `~/.claude/CLAUDE.md` and `~/.claude/rules/**/*.md` without `paths`; the managed policy CLAUDE.md if present; and `@path` imports up to four hops. Each entry gives its `source` (managed, user, ancestor, project, import), and `rule_load.not_counted` lists what is left out (auto memory, AGENTS.md, rules that load on demand, and so on). `--no-context` leaves them out (use it in CI and hooks, where they differ from your machine).
- The guide (default 40, changed with `--warn-rules`) is this tool's own choice, not a value from a study. Eliav (2026, preprint, arXiv 2607.19257) shows that compliance falls as more rules apply to one response and that where it starts differs between models; that it also shifts with rule difficulty is this tool's judgment (see [docs/rule-count-experiment.md](docs/rule-count-experiment.md)). `instruction_lines` (the older line count) is still reported.
- One version comment line for the latest version is allowed in the body; the second and later lines are reported.
- Exit codes: 0 means it ran (0 even with findings); with `--strict`, 1 if there are findings; 2 for wrong arguments, a nonexistent path or an unreadable `--root` (line 1 is a JSON `error`, followed by usage). `--strict` returns 1 for nonexistent references, too many version comments, frontmatter problems and unreadable files. Exceeding the guide and duplicated sentences are warnings and information and do not count.
- A Claude Code hook that blocks by exit code blocks only when it returns 2, and what reaches Claude is stderr. In a hook, wrap it like `python <absolute path to check.py> --strict <path> 1>&2 || exit 2`. In CI, the 1 from `--strict` can be used as a failure directly.
- Any .md file or folder can be passed. The name and description checks apply to SKILL.md and to files whose frontmatter has name or description.
- Inside a plugin (a folder with `.claude-plugin/plugin.json`), paths and LICENSE resolve only up to the plugin folder; pass `--root` to resolve against the repository instead.

## Evidence

The evidence for each criterion is written in SKILL.md as short sentences whose sources have been checked.

## Files

- `.claude-plugin/plugin.json` plugin manifest
- `.claude-plugin/marketplace.json` marketplace that lists this plugin
- `skills/prompt-design-review/SKILL.md` the skill
- `skills/prompt-design-review/scripts/check.py` mechanical check
- `skills/prompt-design-review/scripts/run-audit.py` runs the built-in audit in safe mode and returns one JSON line (`status` ok / failed / not_run, `reason`, `result`, `other_denials`, `cost_usd`; exit 2 for argument errors; `--self-test` needs no network). Each real run is billed like any `claude -p` call
- `skills/prompt-design-review/scripts/fixtures/` self-test sample and expected values (the sample is not named SKILL.md or *.md so that it is neither loaded as a skill nor picked up by folder scans)
- `docs/rule-count-experiment.md` background: a small experiment on how many rules current Claude models follow at the same time (not cited in reports)
- `CHANGELOG.md` change summary

## Distribution

- This GitHub repository: https://github.com/Az-llc/prompt-design-review
- Az LLC portal: https://www.az-llc.com/portal/skills-prompts/

If you got this plugin from anywhere else, check its contents before use.

## Provider

- Developed and provided by Az LLC (https://www.az-llc.com/)
- License: MIT License (see [LICENSE](LICENSE))
