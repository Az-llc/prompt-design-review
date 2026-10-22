# prompt-design-review

A Claude Code plugin that reviews how prompts, CLAUDE.md files and skills are written, and merges the result with Claude Code's built-in audit (`/doctor prompt-audit`) into one report. It is not a tool for reviewing software design.

[日本語版 README](README.ja.md)

## What it does

Claude Code 2.1.283 and later include a built-in audit that looks for outdated writing in prompt assets. This plugin splits the work with that audit and looks only at the design gaps the built-in audit does not check.

- Left to the built-in audit: emphasis words, CoT and scaffolding instructions, wording aimed at older models, over-specified procedures, prohibitions without reasons, nonexistent references, rules nobody verifies, rules made from a single incident
- Checked by this plugin: compatible constraints (within the asset, and between the asset and the CLAUDE.md files and rules that apply to it), delegation instructions, approval and autonomy boundaries, verification and stop conditions, tool-call contracts, connection to external verification, and proposed enforcement points (hooks, permissions, check scripts) for rules a machine can judge
- Reported with low confidence: an expert role standing in for context, boundary structure
- Counted mechanically: `skills/prompt-design-review/scripts/check.py`

The three results are merged into one report. Each finding has a location, a quote, the problem, a proposed diff, a confidence level and its source, and a "Keep" section lists sentences that should not be removed. The report is written in your language.

This review is a static inspection that only reads documents. It cannot show that following a finding improves behavior; confirming an effect needs a behavioral test.

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

The target is rewritten only for the findings you select from the report. The turn the command starts cannot use the edit tools. To apply findings, name them in a plain message; do not run the command again, because that removes the edit tools again. If applying them adds text, the plugin rechecks the changed lines for conflicts and proposes running the built-in audit again on the changed asset. After any applied change, it runs `skills/prompt-design-review/scripts/check.py --strict` on the changed files.

## Prerequisites

- Claude Code 2.1.283 or later (for the built-in audit). Where `claude -p` cannot be used, or for prompts meant for GPT or Gemini, it checks prohibitions without reasons and nonexistent references in place of the built-in audit, and the seven criteria still apply.
- The built-in audit is called in the foreground of the Bash tool from an empty temporary folder with a 10-minute limit, and `--add-dir` gets the narrowest folder that contains the target (for a file, its parent folder). The skills and CLAUDE.md of the project you are working in are not loaded, but those in `~/.claude` are. If the folder passed contains `.claude/skills`, those skills (which may include this one) are also loaded and independence is only partial; it still runs and says so in the report. "All" lists every path in one call. If the audit does not finish within 10 minutes (it is cut off), or reading the target is denied by permissions, it reports "Built-in: failed" and switches to the substitute checks. If only other operations are denied, such as commands that inspect git history, it notes that in the report and uses the result.
- Python 3 (standard library only). If check.py is missing or does not run, it writes "Mechanical check: not run" and continues.
- When the built-in audit is called from Git Bash, `MSYS_NO_PATHCONV=1` is required.

## check.py

```text
python skills/prompt-design-review/scripts/check.py [--warn-rules N] [--root DIR] [--strict] PATH [PATH ...]
python skills/prompt-design-review/scripts/check.py --self-test
```

The paths here are relative to a clone of this repository. The installed plugin's copy lives in a folder whose path changes with each version, so for hooks and CI use a clone pinned to a tag or commit, or copy check.py into your own repository.

For each file it reports the number of instruction lines and prohibition lines (English and Japanese phrasing), referenced paths that do not exist, duplicated sentences (informational), version comments in the body, and the frontmatter (presence and form of name and description). Line 1 of the output is JSON, followed by a human-readable summary. A file that cannot be read as UTF-8 gets an `error` in its own entry, and the remaining checks continue.

- The instruction-line count is an estimate of the number of rules, not the number of rules itself. The threshold (default 40, changed with `--warn-rules`) is a warning guide set with a margin below the number (80) at which compliance with all rules reached 0 in a study. The evidence is cited in step 3 of SKILL.md.
- One version comment line for the latest version is allowed in the body; the second and later lines are reported.
- Exit codes: 0 means it ran (0 even with findings); with `--strict`, 1 if there are findings; 2 for wrong arguments, a nonexistent path or an unreadable `--root` (line 1 is a JSON `error`, followed by usage). `--strict` returns 1 for nonexistent references, too many version comments, frontmatter problems and unreadable files. Exceeding the instruction-line threshold and duplicated sentences are warnings and information and do not count.
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
- `skills/prompt-design-review/scripts/fixtures/` self-test sample and expected values (the sample is not named SKILL.md or *.md so that it is neither loaded as a skill nor picked up by folder scans)
- `CHANGELOG.md` change summary

## Distribution

- This GitHub repository: https://github.com/Az-llc/prompt-design-review
- Az LLC portal: https://www.az-llc.com/portal/skills-prompts/

If you got this plugin from anywhere else, check its contents before use.

## Provider

- Developed and provided by Az LLC (https://www.az-llc.com/)
- License: MIT License (see [LICENSE](LICENSE))
