# transcript-failure-scan

A Claude Code plugin that counts the failures that recur across your local Claude Code conversation records, and then has Claude analyse the counts and propose fixes for you to choose from.

[日本語版 README](README.ja.md)

## What it does

A script counts, and Claude analyses what it counted.

- The script reads every conversation record under your Claude Code configuration folder and groups stopped and failed tool calls into patterns: hook stops, permission denials, command failures, tool errors, slow calls. For each pattern it gives the count, the number of conversations, the dates, how often the same call was retried, and how many calls it took to recover.
- It also lists mechanical facts about your setup: every hook registration and whether its script exists, tool names in hook matchers that never appear in the records, the Claude Code versions seen in the records, and when each hook script, rule and CLAUDE.md was added.
- Claude then opens the records behind each pattern, decides who owns the cause (your setup, the repository's code, or Claude Code itself), and proposes fixes that are mechanisms: a hook, a setting, a change to a script. It changes nothing until you choose.

Separating the owners matters. A failure that Claude Code itself causes cannot be fixed by adding another rule to CLAUDE.md, and the count shows when a written rule has not prevented the failure it forbids.

## Limits

- The scan sees only the records that still exist. Claude Code deletes a conversation's record file once it has not been modified for longer than `cleanupPeriodDays` (30 days by default), so the counts cover roughly the last month unless you changed that setting.
- A hook that passes silently leaves no record. The analysis therefore does not treat "no stops in the records" as a reason to remove a hook; it proposes a removal only with a failed file check, a probe, or a contradiction with the official documentation.
- The analysis opens at least one record per listed entry, so its cost grows with the number of entries. After the scan, the skill tells you that number and asks whether to analyse everything or only some sections.
- The output folder holds excerpts from all your local projects' conversations. The skill writes it under the system temporary folder and deletes it when you say the analysis is over.

## Install

```text
/plugin marketplace add Az-llc/prompt-design-review
/plugin install transcript-failure-scan@az-llc
```

This plugin is version 0.10 and will not be updated. It is published as a snapshot, and the scan tool in it stays as it was at release. LAISORA's own copy of the tool keeps changing, so the two can differ later.

## Usage

```text
/transcript-failure-scan:scan
```

Run it in a new conversation. The skill runs only when you type this command; Claude does not start it on its own.

The reason for a new conversation is how the next count treats it. A conversation that ran an analysis is left out of the next count as a whole. If you run the skill in the middle of other work, either that work's records are left out with it, or the analysis itself is counted.

Claude is instructed to stop after the findings and change nothing until you choose. That is an instruction, not a mechanism that removes the tools.

## Prerequisites

- Claude Code
- Node.js 20 or later

The script makes no network request. It reads local files, runs `git log` to date the instruction files, and writes only into the output folder.

## Where the script comes from

`skills/scan/scripts/improvement.mjs` is the scan tool of [LAISORA](https://github.com/Az-llc/LAISORA), a VS Code extension by the same author, shipped unchanged as of this release. LAISORA runs its scan from its menu. If LAISORA is installed, the script finds it and names the stops that LAISORA itself made; a stop whose text it cannot find in any hook script is listed with the event and tool it stopped and the hooks registered on them as candidates. In both, an earlier analysis conversation is left out of the next count, and the verdicts of an analysis of everything are shown beside the same patterns the next time. An analysis limited to some sections does not carry its verdicts.

## Provider

Az LLC — https://www.az-llc.com/ (MIT License)
