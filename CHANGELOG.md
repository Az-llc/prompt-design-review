# Changelog

## 1.0.0 (2026-10-22) — Initial release

- `prompt-design-review` skill: reviews SKILL.md, CLAUDE.md, rules, subagent definitions and system prompts, and merges the result with Claude Code's built-in `/doctor prompt-audit` into one report.
- Seven design criteria the built-in audit does not cover: compatible constraints, delegation instructions, approval and autonomy boundaries, verification and stop conditions, tool-call contracts, connection to external verification, and proposed enforcement points for machine-checkable rules.
- Substitute checks when the built-in audit is unavailable or the target is meant for another vendor's model.
- `skills/prompt-design-review/scripts/check.py` mechanical check (Python standard library only): instruction and prohibition line counts in English and Japanese, unresolved paths, duplicated sentences, version comments and frontmatter, with `--strict` for hooks and CI and a `--self-test`.
- Targets are rewritten only for the findings the user selects; the report is written in the user's language.
- Distributed as a Claude Code plugin with its own marketplace.
