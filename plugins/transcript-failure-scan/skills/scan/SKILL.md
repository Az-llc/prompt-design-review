---
name: scan
description: Counts the failures that recur across all local Claude Code conversation records (hook stops, permission denials, command failures, tool errors, slow calls), lists the hook registrations and instruction files with mechanical facts about them, and then analyses the counts by owner and proposes mechanical fixes for the user to choose from. Run by the user with /transcript-failure-scan:scan.
license: Complete terms in LICENSE (MIT)
disable-model-invocation: true
---

## What this skill does

A script counts; you analyse what it counted. The script `scripts/improvement.mjs` reads every conversation record under the Claude Code configuration folder, groups failed and stopped tool calls into patterns, and writes an index. You then follow a brief that the same script writes: open the records behind each pattern, decide who owns the cause (the user's setup, the repository's code, Claude Code itself), and propose fixes that are mechanisms (a hook, a setting, a script change) for the user to choose from.

The script is the scan tool of LAISORA (a VS Code extension by the same author), shipped here unchanged. It needs Node.js 20 or later and nothing else. It makes no network request: it reads local files, runs `git log` to date the instruction files, and writes only into the output folder you give it.

Until the user chooses findings, change none of the user's settings, instruction files, hook scripts or project files through any tool, shell tools included. Writing into the output folder, and into the temporary probe folders the brief asks for, is not such a change. This stays in text because the procedure spans several turns and needs a shell, so no tool restriction can cover it.

## Limits to tell the user

- The scan sees only the records that still exist. Claude Code deletes a conversation's record file once it has not been modified for longer than its `cleanupPeriodDays` setting (30 days unless the user changed it), so a count covers only the conversations still on disk, and the index header gives the date range of their records. Say that range in the report.
- A hook that passes silently leaves no record. No stops in the records is never evidence that a hook is unneeded; the brief allows a removal only with a failed file check, a probe, or a contradiction with the official documentation.
- The output folder holds excerpts from every local project's conversations. Do not copy from it beyond what a finding needs.

## Procedure

1. If this conversation already holds other work before this skill was started, tell the user to run the skill in a new conversation and stop. The next scan recognises an analysis conversation by the output of step 5 near the start of its record and leaves the whole conversation out; in a conversation with earlier work, that work is left out too, or the analysis is counted as friction. Then run `node --version`. If Node.js is missing or older than 20, tell the user and stop.
2. Create the output folder with this command, which prints its path in the form the operating system uses; use that printed path, unchanged, in every later step:
   `node -e "console.log(require('fs').mkdtempSync(require('path').join(require('os').tmpdir(),'transcript-failure-scan-')))"`
   If it prints no path or exits nonzero, report the error and stop.
3. Run the scan in the foreground of the Bash tool with timeout 600000:
   `node "${CLAUDE_SKILL_DIR}/scripts/improvement.mjs" scan --out "<output folder>"`
   It prints one JSON object. `"type": "done"` with exit 0 means the index was written; `"type": "failed"` or a nonzero exit means it was not: report the `error` text and stop. A cut-off run counts as not run.
4. Read `<output folder>/index.md` from its first line through the line that starts with `Accounting:`. Tell the user how many conversations were scanned, the date range of the records, and how many entries that line says the analysis needs, by section. Say that the analysis opens at least one record per entry and may start subagents, so its cost grows with that number, and ask whether to analyse everything or only named sections (for example hooks and gates only). Stop and wait for the answer.
5. Write the brief. For everything:
   `node "${CLAUDE_SKILL_DIR}/scripts/improvement.mjs" brief --out "<output folder>" --language "<the user's language, in English, for example Japanese>"`
   For named sections, add `--scope "<the sections the user chose, in English>"`; the brief then ends with that scope and how to treat the rest. Run this command alone in one Bash call, not chained with another command and without redirecting its output: the next scan recognises this conversation by this command's exact output. This stays in text because the plugin ships no hook. The command writes `brief.md` into the output folder and prints which files to read; on a nonzero exit it prints the reason instead: report that reason and stop. Read `brief.md` completely and follow it.
6. The brief tells you to stop for the user's choice of findings. Before that choice, the rule above on what not to change applies.
7. After the user chooses, apply only the chosen fixes. Confirm each one with a check that can fail, using harmless probes in a temporary folder as the brief describes for probes: one call that was wrongly stopped or failed before and should now pass, and one call the mechanism must still stop. Report both results. If a check cannot be run, say so and leave that finding open.
8. When the user says the analysis is over, delete the output folder and say that you did. Delete only the path printed in step 2, whose last part starts with `transcript-failure-scan-`; if you are not sure of that path, ask the user instead of deleting. After an analysis of everything, the verdicts block that the brief asks for at the end of your reply stays in this conversation's record; the next scan reads it from there, so it does not depend on the output folder. An analysis of named sections writes no verdicts block, as its brief says.
