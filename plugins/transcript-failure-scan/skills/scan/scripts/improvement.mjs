import { createRequire as __l10nCreateRequire } from "node:module"; const require = __l10nCreateRequire(import.meta.url);

// src/improvement-cli.ts
import fs3 from "node:fs";
import os2 from "node:os";
import path3 from "node:path";

// src/claude-env.ts
import { homedir } from "node:os";
import { join } from "node:path";
function claudeConfigDir() {
  const configured = process.env.CLAUDE_CONFIG_DIR;
  return (configured ? configured : join(homedir(), ".claude")).normalize("NFC");
}
function claudeSettingsFiles(projectDir, configDir = claudeConfigDir()) {
  const directory = projectDir === void 0 ? configDir : join(projectDir, ".claude");
  return [join(directory, "settings.json"), ...projectDir === void 0 ? [] : [join(directory, "settings.local.json")]];
}
var NESTED_SESSION_MARKERS = ["CLAUDECODE", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SSE_PORT"];
var MCP_AUTO_BACKGROUND_ENV = {
  CLAUDE_AUTO_BACKGROUND_TASKS: "true",
  CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS: "1000"
};
var LAISORA_OWNED_ENV = new Set(Object.keys(MCP_AUTO_BACKGROUND_ENV));
var CLAUDE_SESSION_ENV = /* @__PURE__ */ new Set([...NESTED_SESSION_MARKERS, "AI_AGENT", "CLAUDE_PID", "CLAUDE_EFFORT"]);

// src/improvement-brief.ts
var IMPROVEMENT_BRIEF_FILE = "brief.md";
var IMPROVEMENT_INDEX_FILE = "index.md";
var IMPROVEMENT_PATTERNS_FILE = "patterns.json";
var IMPROVEMENT_RETRY_WINDOW = 3;
var IMPROVEMENT_CANDIDATE_RETRY_WINDOW = 2;
var IMPROVEMENT_MIN_CONVERSATIONS = 2;
var IMPROVEMENT_INDEX_LOCATIONS = 3;
var IMPROVEMENT_BRIEF = `# LLM improvement analysis: brief

You analyse the user's own Claude Code setup for recurring friction across all of their local conversations, and propose fixes for the user to choose from. {{WRITER}} wrote this brief. Re-read this file ({{BRIEF}}) whenever your context has been compacted.

Reply to the user in {{LANGUAGE}}. The user does not read code: explain each finding and each option by its behaviour and trade-offs, not by code.

## Inputs

- {{INDEX}}: the pattern index. Dynamic parts of texts are normalised; retries = the same call re-sent within {{RETRY}} calls; days are MM-DD:n; each line ends with up to {{LOCATIONS}} representative locations. Sections:
  - Hooks and gates (H): every stop and every hook failure (timeout, non-blocking error), any count. Lines: id, refusal text, count, conversations, retries (same input / changed input), first..last date, main/subagent split, tool split, per-day counts. Stops whose texts match the same source literal for most of its fixed part are one gate entry, with each text, its id and its dates under it (the entry has no id of its own); "stopped operations" breaks an entry down by tool and command shape (path kind for edits; programs, git subcommands, stash round trip, recursive delete, redirect for shell) with a count and one location each. Judge each shape: one shape can be an intended stop while another is a false positive.
  - Auto mode classifier denials (C), permission prompts not granted (P), Claude Code safety checks (Y): every kind, any count; same fields.
  - MCP tool errors (M, {{MINCONV}}+ conversations): same fields.
  - Causes (X, {{MINCONV}}+ conversations): one line per cause (an error class with its decisive token, a FAIL id prefix, or a program's diagnostic prefix), rolled up across command failures, masked and one-off results: results, conversations, days and the last date, the ids of the lines it spans, two locations.
  - Command failures and other failed results (E, O, {{MINCONV}}+ conversations): same fields without per-day counts; the owner is the command the failure was attributed to. "covered by X\u2026" names the Causes lines that hold every result of the line.
  - Masked failures and one-off command failures by owner (U, {{MINCONV}}+ conversations): results not marked as errors whose output shows a failure, plus command, MCP and other failures whose own pattern is in fewer conversations, one line per attributed owner command. Results, conversations, number of distinct reasons, markers, and the top reasons each with its pattern id, count, conversations and one location; a compact tail names further owners in 3+ conversations.
  - MCP and external tool results that report failure inside an ok result: every owner, same fields as the owner lines.
  - Slow or backgrounded shell calls (S, {{MINCONV}}+ conversations): count, conversations, calls moved to the background, calls checked by the auto mode classifier, median and max duration, dates, split; "chain:" lines list every heavy command when the slow one could not be told.
  - Claude Code built-in tool errors (B, {{MINCONV}}+ conversations): errors that Claude Code's own tools returned, same fields as the command failures.
  - Ids: a letter for the kind of item and a hash of the key the scanner groups it by. Pattern letters: H hook stop or failure (also the header of a hook source), C, P, Y, M, E, O, B as above, R masked result, S slow call; line letters: U owner line, X cause, K failure class (patterns.json); inventory letters: I hook registration, T matcher tool name lead, F hook script, rule or CLAUDE.md file. The id depends on that key only, not on the section or the rank, so a pattern keeps its id when it moves between an owner line's reasons and its own line; the same key gives the same id in every run. The order of the lines is the rank.
  - Inventory for removal and correction candidates: mechanical facts only, no judgement. The Claude Code versions seen in the records with the first and last date of each; every hook registration in the settings files read (I: event, matcher, type with its if condition and shell when set, settings file, the command and args or the other hook content, \xD7n when the same registration repeats in one file, and for command hooks whether each absolute script path in the command or args exists); matcher tool names of the tool events never seen as a tool_use name in any scanned record (T, a lead); when each hook script, rule and CLAUDE.md file was added (F: author date of the first git commit touching it at that path, else its modification time labelled mtime). A script in a hooks folder whose path no registration resolves to is marked "named by no registration's command": it may be a helper that another hook imports, or a registration through a form the scanner does not resolve; check before calling it dead. See "Removal and correction candidates".
  - Previous verdicts: the last verdicts block in the assistant text of an earlier analysis conversation, from the conversation whose last block is the most recent, matched by id. "prev:" beside an id gives that verdict, owner group, status and reason, its fix commit with the occurrences before and after the fix time counted by the scanner from the record timestamps, the count in this scan and the last date seen. Previous findings whose id is not shown in this index are listed in that section with the same fields. The section says when there is no earlier analysis conversation, when the newer ones ended without a block, and when a block could not be read.
- {{PATTERNS}}: the same patterns with every location (absolute path, line, timestamp, actor, tool). Search it for a pattern id or a conversation prefix; do not read it whole.
- The raw records. Open a location with the Bash tool (the command starts with an environment variable assignment, which PowerShell does not accept):
  {{RECORD}} <location> [--around N] [--max CHARS]
  <location> is the \`<conversation prefix>:<parent | agent-\u2026>:<line>\` form from the index, or \`<absolute .jsonl path>:<line>\`. It prints the record(s) with tool inputs, tool results, is_error, actor and timestamps, plus the tool call a result answers. \`<prefix>:<agent-\u2026>:1\` is the delegation prompt that subagent received. Do not open .jsonl files with Read, Get-Content, cat or python: they are large and their lines are long.
- Earlier improvement-analysis conversations are left out of the index; its header says how many. Their verdicts reach you only through the previous verdicts section.

## What counts as a finding

A finding needs all three:
1. The cause is owned by something the user can change: their hooks, permission settings (the allow/deny rules and which settings file holds them), scripts, MCP tools, CLAUDE.md / rules / skills / agent definitions, or LAISORA's code and the instructions LAISORA injects. A defect of Claude Code itself (a tool changes what was sent or what it returns, reports a wrong result, or breaks its documented behaviour) is a finding in the Claude Code group, even if a Claude Code update may fix it later. Only the rules of "Already fixed?" exclude it, as for every other owner: fixed and not recurring, or a fix too recent to judge.
2. The fix is a mechanism: a hook (including one that returns updatedInput), a setting or permission rule, a schema or validator, the behaviour of a script or tool (for example exiting nonzero when it refuses or when a step fails, or checking its precondition and stopping with the reason), or LAISORA code. For a Claude Code defect, the fix is such a mechanism on the user's side that avoids or stops the affected form when one exists, and otherwise the defect report with a minimal reproduction. Prose is a fix in three cases only: (i) writing the requirement a hook or gate enforces where the stopped actor reads it, keeping the hook; (ii) correcting a wrong fact or path in an instruction file; (iii) deleting or correcting an instruction sentence as a category 1, 2 or 3 finding of "Removal and correction candidates". Removing a hook registration, a gate or a rule as such a finding is also a fix. Advice to be careful, reminders and recovery tips are not fixes.
3. The fix keeps every protection. The only exception is removing or correcting a hook registration, a gate, a rule or an instruction sentence backed by evidence of one of the three kinds in "Removal and correction candidates"; without that evidence, never propose removing a hook, a gate or a rule.

Not findings (put them in the excluded list with the reason):
- The agent's own misuse of a Claude Code built-in tool that the tool reports correctly (Edit before Read, string not found, file too large). A Claude Code defect as in criterion 1 (for example the Bash tool reducing a doubled backslash to a single one) is not misuse.
- The auto mode classifier's internal judgement. The user's side of a classifier denial IS a finding: an allow rule whose wording does not match the commands actually run (exact-match rules against \`cd ... &&\` prefixes, redirects, wrappers), a rule placed in a settings file that the session does not load, or a routine command denied again and again with no allow rule that matches it (propose the exact rule and list what else it would let through).
- Patterns that were fixed and have not recurred since, and fixes too recent to judge (see "Already fixed?").
- Patterns whose only fix would be prose outside cases (i), (ii) and (iii): excluded as "no mechanism", with what you checked. A wrong path, command form or fact in an instruction file that led to the failure is case (ii) and is a finding, not "prose, no mechanism".

## Recovery cost

Causes, owner, hook/gate and MCP lines show the recovery cost: how many tool calls it took until the same command next succeeded (median/p75), how often agents explored (read files or searched) in between, and how many never recovered within the window. An intended stop or a correct failure is a finding when its recovery is costly (a median of several calls, exploration common, or many unrecovered): the mechanical fix is that the message names the missing item or the remedy, the tool prints what it checked, the hook returns the exact correction, or the precondition is checked earlier. Cheap recovery (the next call succeeds) supports excluding a stop as intended.

## Hook and gate stops

A stop is the hook doing its job; it is never waste in itself. A stop is a finding only when one of these holds:
- (a) The correction after the stop is mechanical (always the same rewrite) -> the hook can make it itself (for example return updatedInput, or add the missing part), keeping the check.
- (b) False positive -> narrow the condition. Show from the records that the stopped operation was outside the rule's intent. Loosening a protection also needs a measurement in this environment (run the case and show the result) before you propose it.
- (c) The requirement the hook enforces is not written in, or not delivered to, the instruction text of the actor that was stopped -> write it where that actor actually reads it (prose case (i)), and keep the hook.
- (d) The hook or gate is dead or replaced, with category 1, 2 or 3 evidence from "Removal and correction candidates" -> remove or correct it as a removal finding (stops alone are never that evidence).

Also look for:
- Instructions that contradict each other or contradict a gate (for example a policy that tells the agent to do exactly what a gate refuses).
- A tool input schema that allows what its validator rejects, or the reverse.
- A failure that an instruction file already forbids, recurring across conversations: the written rule did not prevent it. Quote the rule and its file; the fix is a hook or check that enforces that rule and returns the rule's remedy, not more prose and not a rewrite the rule does not ask for.

## Procedure for each hook/gate pattern

1. Find the hook source. The index names it when the refusal text could be matched to a source; otherwise search the hook scripts and settings files listed at the end of the index for the refusal text. Read the condition that produced the refusal, and the refusal text.
2. Owner LAISORA is a gate inside the LAISORA extension. If the current workspace is the LAISORA source repository (package.json "name": "laisora" with src/claudeHost.ts), read and change it there. Otherwise the extension is installed at {{EXTENSION}} (bundled, read-only): search dist/extension.js for the refusal text to read the condition, and present the fix as a change request to LAISORA. When the source the index matched and the installed bundle disagree, the source the index matched wins.
3. Determine who was stopped (main conversation or subagent; the index gives the split) and read the instruction text that actor receives. Main conversation: the CLAUDE.md files and rules of that project and of the user, the system prompt text LAISORA injects, settings such as LAISORA's conductor policy. Subagent: its agent definition, its delegation prompt (line 1 of its file), any SubagentStart hook context. Quote the sentence where the enforced requirement is written, or state where it is missing.
4. Open 2-3 representative stops with the record command and look at what the actor did next (re-sent the same call, rewrote it, gave up, did something else). Decide between (a), (b), (c) and no finding from that.
5. Name the exact part to change: file, and symbol or setting key, as you read it. Follow the proposed change through the rest of the hook or function: a later check may stop the same input again. Say so when it does.

## Removal and correction candidates

A hook, rule or instruction that is no longer needed is a finding only with evidence of one of these kinds. Each candidate needs a record, a mechanical check or a probe; a Claude Code changelog entry alone is only a lead (a changelog entry can imply a tool or behaviour is gone while the records show it still in use).
1. Dead: a registration's command script does not exist (the inventory marks it MISSING; check the path again with a file test); a matcher names a tool that no longer exists (a T lead: confirm with the current tool list, the \`tools\` of a headless run's system/init, and say which list you used; a T lead may be the old name of a renamed tool that Claude Code still accepts in matchers, so before calling it dead check the tools reference (https://code.claude.com/docs/en/tools-reference) for its removal or rename note and, when the note is missing, probe a matcher with that name as in category 2); an instruction or rule points at a file, command or setting that does not exist (test the path, run the command's help, or find the setting key in the current documentation).
2. Replaced by a Claude Code native mechanism (a setting, a permission rule form, a hook feature, built-in behaviour). It needs a probe in this environment showing the native mechanism alone stops or does the same case that the hook, rule or instruction handles. Probe isolation: a fresh empty temporary folder outside the user's projects; the settings under test passed with \`--settings <file>\` (do not create a .claude folder in the probe folder); flags \`--setting-sources project,local --strict-mcp-config --disable-slash-commands\`; environment CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 and CLAUDE_CODE_DISABLE_AUTO_MEMORY=1, with every inherited CLAUDE* and ANTHROPIC* variable unset; a small model; never an empty CLAUDE_CONFIG_DIR and never copied credentials; delete the temporary folder afterwards. Report the command and the observed result. No probe: list it as not investigated (\u672A\u8ABF\u67FB), not as a removal.
3. An instruction states Claude Code behaviour that the official changelog (https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md) or the documentation now contradicts: correct or delete that sentence. Bound the changelog window with the versions in the inventory and the file's added date; quote the changelog or documentation text and the sentence. Where the records can show the behaviour (a tool still used, a stop still happening), check them too: the records win over the changelog.

Not findings:
- No stops, or no records of a hook. A hook that passes silently leaves no record in the transcripts, so zero stops is never evidence that a hook is unneeded.
- "The model is smarter now" or similar judgements about instruction text in general. Point the user to Claude Code's \`/doctor prompt-audit\` for that instead.

Report a removal or correction as a finding with the same fields; "Already fixed?" applies (for example the registration was already removed after the records were written). Name the category (1, 2 or 3) and its evidence in Cause, and use the inventory id (I, T or F) or the id of the related pattern in the verdicts block. A removal changes what a gate allows: give the options with their behaviour and trade-offs, and say that it needs the user's decision (see "What a good fix looks like").

## Already fixed?

For each candidate finding, read the current code, rule or setting first. If it already changes the behaviour:
- Find the fix commit with git log on the owning file (\`git log --format="%h %ad %s" --date=short -- <file>\`; for a file outside git use its modification time and say so). The fix commit is the one whose diff changed the condition you read (show its hunk), not the latest commit of the file; its fix time is its author date (\`git log -1 --format=%aI <commit>\`). For a gate, the date ranges of the text variants under its index entry also mark when its wording changed; use them as fix dates as well as that commit.
- If the recorded commands show that the fix cannot match them (for example an exact allow rule against the command form actually run), it is a finding regardless of the fix date.
- Count occurrences before and after the fix time from the location timestamps in patterns.json (the "at" field), not from the per-day counts. For an id whose previous verdict recorded a fix, the index already prints these counts; use them.
- A gate entry in the index can hold several refusal texts that match the same source literal: a text that stopped on some date while another text of the same entry continued is a rewording of the same gate, not a fix. A pattern marked "prefix-only site" shares only the start of its text with that source line and is not a rewording unless you confirm the same condition in the source. Count the stops of every text of the entry, and search the source for the same condition under other wording, before calling anything quiet.
- Occurrences after the fix in more than one conversation (under any text of the same gate) -> fixed but not effective: a finding, with the counts before and after.
- No occurrences after the fix under any text of the same gate -> fixed and quiet: excluded list.
- Fix within the last 2 days, or too few conversations since to tell, and the effect cannot be judged from the records -> too recent: excluded list.
- Fixed and quiet, too recent and development red all name the fix commit and its fix time, and go into the verdicts block with them, so the next run counts the occurrences after that time.
Records older than about 30 days may already be deleted; say so when it matters.

## The other sections of the index

- Classifier denials: read the permission rules in the settings files the session loads (user, project, local) and compare their wording with the denied commands; for a routine command denied repeatedly, check whether any allow rule matches it at all.
- Permission prompts not granted: a permission rule candidate, decided like classifier denials (which rule would cover the prompted part, and what else it would let through). Safety checks: read the command and decide whether a rule, hook or instruction leads to the checked form.
- MCP tool errors: read the tool's input schema and its validator.
- Causes: one cause can show up as command failures, masked results and one-off failures of different commands. Decide per cause from at least one opened record; when the cause becomes a finding, or its exclusion depends on which command failed, open one location per distinct command it spans and say whether one mechanism prevents all of it or which part. A check that fails on code under construction (red before the fix, during development) is not a finding by itself: name the commit that turned it green and give the occurrences after its fix time; the same failure after that time in another conversation is not development red. It becomes one when the same failure recurs across conversations from a missing precondition or an environment or tooling cause. This exception does not apply when the recovery cost shows agents searching for how to fix (exploration common, high median, many unrecovered) rather than just fixing the code.
- Command failures: the owner is the command the scanner attributed the status to. "chain not attributed" lists the segments: open the record and name the failing segment before deciding; "chained exit codes" is not an exclusion reason.
- Other failed results: shell results without an exit code (for example a command form blocked by Claude Code before it ran) and tool errors not classified elsewhere. Open the record; when the user's hook, setting or instruction leads to the blocked form, decide as for command failures; otherwise a block by Claude Code itself is decided by the Claude Code rule in "What counts as a finding".
- Masked failure candidates: confirm in the record that the call failed. A finding only when a mechanism prevents the failing step or stops the run at its cause: a precondition the script can check before the expensive step is enforced, with the reason printed, the script or tool exits nonzero by itself when a step fails or it refuses, or a hook rewrites the command. For printed-status entries the command already printed the status, so look for what would have prevented the failing step. Otherwise exclude it with the reason. An owner line covers one command's different failures: when it becomes a finding, or its exclusion depends on the reason, open one location per reason it shows. MCP and external results that report failure inside an ok result are decided the same way: the tool should report the failure as an error.
- Slow or backgrounded calls: a finding only when a mechanism shortens or avoids them (a narrower command a hook can rewrite to, a faster mode of the script, a setting); the time includes any classifier or permission prompt wait. Otherwise exclude with the reason.
- Do not drop anything as "not investigated". Investigate it, or list it as not investigated (\u672A\u8ABF\u67FB) only when the evidence cannot be reached, with the reason.

## What a good fix looks like

- A mechanism, as defined in "What counts as a finding"; prose only in cases (i), (ii) and (iii).
- Fix the root cause, not the symptom. No lists of model quirks.
- Never put decisions, findings or work state into memory files.
- When a fix needs a spec or contract change in LAISORA, or changes what a gate allows, give the options with their behaviour and trade-offs and say that it needs the user's decision.
- A fix that narrows a check, adds an exception or makes something transparent to a check: list concrete inputs the change could newly let through (wrapper commands and their options such as \`timeout -s KILL 600 <cmd>\` or \`time -o FILE <cmd>\`, the command inside the wrapper, quoting, chaining, redirects, other spellings of the same operation), and show from the code that the protection still stops each of them. Do not reuse a helper written for another shell or language (for example a PowerShell quote stripper in a Bash hook) without checking it keeps the protection there.
- Check the proposed fix against the owning repository's own rules (its CLAUDE.md and rules files) before proposing it; a fix that breaks them (for example adding a path those rules forbid) is not a fix.
- Check it also against the user's own CLAUDE.md and rules: a fix that goes against a decision recorded there (for example when heavy checks may run) is not proposed; put the pattern in the excluded list and name that decision. Do this check before replying; a fix you have not checked against those decisions is not proposed.
- Read the file or setting you propose to change before proposing it. A fix whose target you have not read is not a finding: list it as not investigated (\u672A\u8ABF\u67FB) with the reason.
- For a repository with contracts, read the owning contract including its rejected designs; do not propose a rejected design or a change that breaks a stated invariant.
- A fix that narrows a check or makes it transparent to wrappers must still stop path-qualified and escaped program names (\`/usr/bin/git\`, \`\\git\`, names split by quotes or variables), not only the bare name.
- Verify the environment assumptions a fix depends on in this setup before proposing it: the git layout (\`.git\` may be a file pointing elsewhere; use \`git worktree list --porcelain\`), where \`$CLAUDE_PROJECT_DIR\` resolves in each project, PowerShell and Bash syntax for a hook registered on both tools, and that the last of several updatedInput hooks wins.
- A rewriting fix (updatedInput) must not touch code text such as regex literals or quoted data; when the rewrite cannot be exact, deny with the reason instead.
- For an environment variable or setting change, state its effects beyond the target symptom (for example an encoding variable also changes how child processes decode text), and check in the recorded command lines that it takes effect there: launch forms that ignore the environment (for example Python's -I or -E, which ignore PYTHON* variables) need their own fix, counted from the records.

## Privacy

The index covers every local project. Quote only what a finding needs; do not copy other projects' content beyond the evidence lines.

## Output, then stop

If you hand sections to subagents, start each with run_in_background: false so its result arrives before you reply, and wait for every one of them; a section you could not finish is listed as not investigated (\u672A\u8ABF\u67FB) with its line count and the reason. Split by index sections or runs of consecutive lines within a section that together cover every listed line and every id in the compact tail lines, so no id is left without an owner. An entry whose reason text is marked as cut off is excluded only after its record has been opened.

Before replying, challenge your exclusions: list the excluded entries grouped by reason. For every group whose reason is intended, works as designed, correctly failed, own mistake or development red, and that spans 3 or more ids or 10 or more results, start a fresh subagent (run_in_background: false) that re-opens one location per distinct cause in the group and answers only one question: is there a mechanism (a message, tool output, a precondition, a hook correction) that would have prevented or shortened this? Promote what it finds to findings. An excluded entry must not reuse a group's reason for a member whose own reason line differs; open that member.

An id whose previous verdict was finding stays a finding unless you name a counter-record: a location opened in this run that shows the previous finding was wrong, or the fix commit with its fix time and no occurrences after it. Send every such exclusion, whatever its reason and however few ids share it, to the same fresh-subagent challenge together with the previous reason and your counter-record, and exclude it only when the subagent confirms the counter-record.

For every id whose previous verdict was finding (beside its id or in the previous verdicts section), give one status in the reply: still recurring (the counts after the previous run or after its fix), fixed (commit, fix time, counts before -> after), or no longer applicable (the reason, and the record or file you checked). A previous finding without a status is not done.

Group the numbered findings by owner, in this order, most valuable first within each group: the user's own setup (hooks, settings, rules, CLAUDE.md, user scripts); the code and scripts of the repository the conversations worked on; LAISORA defects (the extension running the conversations, as distinct from that repository's code even when the repository is LAISORA's source); Claude Code itself. When a failure could come from more than one of these (for example LAISORA's launch of Claude Code or Claude Code itself), find out which from the code or a probe and put it in that group; if you cannot, say so in Certainty. Use these fields, labelled in the reply language (Japanese: \u898B\u51FA\u3057 / \u56DE\u6570\u30FB\u4F1A\u8A71\u6570\u30FB\u4EE3\u8868\u7B87\u6240 / \u539F\u56E0 / \u5909\u3048\u308B\u6240\u3068\u65B9\u5411 / \u5BFE\u5FDC\u6E08\u307F\u304B / \u78BA\u304B\u3089\u3057\u3055):
- Title
- Count, conversations, representative locations
- Cause: the condition in the hook or code, and the quoted instruction text (or where it is missing)
- What to change and in which direction: file + symbol or setting key; options with trade-offs when there is a choice
- Already fixed?: no / fixed on <date> (<commit>) but recurring: <before> -> <after>
- Certainty: high / medium / low, and what is unverified
Number only unresolved patterns and fixed-but-recurring ones. Every number is a full finding with all fields; a pattern merged into another finding gets no number of its own. Then the excluded list: every pattern you looked at and dropped, with its criterion and how you checked it (the record you opened, the commit with the counts before and after, or the rule or setting you read with its file and key). Accounting: the index header states how many entries are needed and how they split by section; plan your effort (and any fan-out to subagents) from that number. Each needed line gets one entry (a finding or an excluded entry with a checked reason) backed by at least one opened record: every H, C, P, Y, M, B and X line, each id in the Causes and slow-call tails, every listed E, O, U, S and MCP/external line that is not marked "covered by X\u2026", every inventory registration with a MISSING script and every T lead (backed not by a record but by the file check, the current tool list with the documented aliases, or a probe), and every previous finding listed in the previous verdicts section. A line marked "partly in X\u2026" needs an entry only for its part outside those causes. Tail ids may be grouped when they share a checked reason, naming the ids; otherwise no blanket exclusions: one line per id, or a group only when every member shares the same checked reason, naming the ids (not ranges or labels such as "one-offs"). Opening one location per distinct reason or command is needed only for lines that become findings or whose exclusion depends on the reason; a line whose reasons lead to different causes is split. There is no "not opened" category. Owners in the compact tail and patterns that are only in patterns.json need not be covered. Account for every count in the hooks and gates section: for each hook pattern, the findings and excluded entries together cover all of its stops; when a finding explains only part of a large pattern, say what the rest is (for example "<n> of <total> are <kind>, finding 2; the other <m> are <kind>, excluded as intended stops").

End the reply with one fenced code block whose info string is {{FENCE}} (the line \`\`\`{{FENCE}}, then the JSON, then \`\`\`). {{READER}} reads the last such block of this conversation in the next analysis; do not write it to a file. When a later reply in this conversation changes a verdict, end that reply with the whole block again. The JSON is {"entries": [...]}, one entry per id in your findings, your excluded list and your not-investigated list, and one per previous finding (also when its id is no longer in the index); an id grouped with others in the reply gets its own entry. Fields: "id" (as in the index); "verdict" (one of {{VERDICTKINDS}}); "group" (the owner groups above in the same order: one of {{VERDICTGROUPS}}; for an exclusion, the group it would belong to); "reason" (one line: the cause for a finding; the criterion and how you checked it for an exclusion; the reason for not investigated); "fixCommit" and "fixDate" (the fix time as ISO 8601 with a time and an offset or Z, as \`git log -1 --format=%aI\` prints it) when a fix exists; "status" (one of {{VERDICTSTATUSES}}; {{NEWSTATUS}} for an id without a previous finding). The next run shows these verdicts beside the same ids; an entry with another field value is not read.

Then stop and wait for the user's choice (for example "fix 1 and 3", "dig into 2"). Do not edit anything before the user picks.
`;
var WRITER_LAISORA = "LAISORA (the VS Code extension running this conversation)";
var WRITER_STANDALONE = "The scan tool (improvement.mjs, started by a skill outside LAISORA)";
var READER_LAISORA = "LAISORA";
var READER_STANDALONE = "The scan tool";
var EXTENSION_ROOT_STANDALONE = "the LAISORA folder under the VS Code extensions folder (this run was started outside LAISORA, so there is one only if the user also installed LAISORA)";
var scopeSection = (scope) => `
## Scope chosen by the user

${scope}

This section overrides the accounting above for everything outside the scope. List each index section outside it once, as not investigated (\u672A\u8ABF\u67FB) with the user's choice as the reason, without opening its records and without one line per id. A previous finding whose id is outside the scope gets the status "not checked in this run (out of scope)" and needs no counter-record. Do not write the verdicts block in this run: a block that covers only part of the index would replace the verdicts of the last full analysis, and the next scan keeps using that analysis when this conversation has no block. Say in the reply that this run's verdicts are not carried to the next run. Then stop and wait for the user's choice as above.
`;
var fill = (template, values) => template.replace(/\{\{([A-Z]+)\}\}/g, (all, key) => values[key] ?? all);
var VERDICT_KINDS = ["finding", "excluded", "not_investigated"];
var VERDICT_GROUPS = ["user_setup", "repository", "laisora", "claude_code"];
var VERDICT_STATUSES = ["new", "recurring", "fixed", "not_applicable"];
var NEW_STATUS = "new";
var quotedList = (values) => values.map((v) => `"${v}"`).join(", ");
var IMPROVEMENT_VERDICTS_FENCE = "laisora-verdicts";
var FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
var ISO_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
function lastVerdictsBlock(text) {
  let body;
  let open;
  for (const line of text.split(/\r?\n/)) {
    if (open) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (close && close[0] === open.fence[0] && close.length >= open.fence.length) {
        if (open.verdicts) body = open.lines.join("\n");
        open = void 0;
      } else if (open.verdicts) open.lines.push(line);
      continue;
    }
    const m = FENCE_OPEN_RE.exec(line);
    if (m && !(m[1][0] === "`" && m[2].includes("`"))) open = { fence: m[1], verdicts: m[2].trim() === IMPROVEMENT_VERDICTS_FENCE, lines: [] };
  }
  return open?.verdicts ? open.lines.join("\n") : body;
}
var optionalOf = (value, allowed) => value === void 0 || value === null ? void 0 : typeof value === "string" && allowed.includes(value) ? value : null;
var optionalText = (value) => value === void 0 || value === null ? void 0 : typeof value === "string" && value.trim() ? value.trim() : null;
function parseVerdicts(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  const list = doc?.entries;
  if (!Array.isArray(list)) return { error: 'no "entries" array' };
  const entries = [];
  const invalid = [];
  list.forEach((raw, i) => {
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    const verdict = optionalOf(raw?.verdict, VERDICT_KINDS);
    const group = optionalOf(raw?.group, VERDICT_GROUPS);
    const status = optionalOf(raw?.status, VERDICT_STATUSES);
    const reason = optionalText(raw?.reason);
    const fixCommit = optionalText(raw?.fixCommit);
    const fixDate = optionalText(raw?.fixDate);
    if (!id || !verdict || !reason || group === null || status === null || fixCommit === null || fixDate === null || fixDate !== void 0 && (!ISO_TIME_RE.test(fixDate) || Number.isNaN(Date.parse(fixDate)))) {
      invalid.push(id || `#${i + 1}`);
      return;
    }
    entries.push({ id, verdict, reason, ...group ? { group } : {}, ...status ? { status } : {}, ...fixCommit ? { fixCommit } : {}, ...fixDate ? { fixDate } : {} });
  });
  return { entries, invalid };
}
function renderImprovementBrief(v) {
  const inLaisora = v.extensionRoot !== void 0;
  return fill(IMPROVEMENT_BRIEF + (v.scope ? scopeSection(v.scope) : ""), {
    READER: inLaisora ? READER_LAISORA : READER_STANDALONE,
    BRIEF: v.briefPath,
    INDEX: v.indexPath,
    PATTERNS: v.patternsPath,
    FENCE: IMPROVEMENT_VERDICTS_FENCE,
    RECORD: v.recordCommand,
    LANGUAGE: v.language,
    WRITER: inLaisora ? WRITER_LAISORA : WRITER_STANDALONE,
    EXTENSION: v.extensionRoot ?? EXTENSION_ROOT_STANDALONE,
    RETRY: String(IMPROVEMENT_RETRY_WINDOW),
    MINCONV: String(IMPROVEMENT_MIN_CONVERSATIONS),
    LOCATIONS: String(IMPROVEMENT_INDEX_LOCATIONS),
    VERDICTKINDS: quotedList(VERDICT_KINDS),
    VERDICTGROUPS: quotedList(VERDICT_GROUPS),
    VERDICTSTATUSES: quotedList(VERDICT_STATUSES),
    NEWSTATUS: `"${NEW_STATUS}"`
  });
}
function improvementFirstMessage(v) {
  return `Read ${v.briefPath} and follow it, then read ${v.indexPath}.
Reply in ${v.language}.`;
}
var FIRST_MESSAGE_RE = /^Read (.+) and follow it, then read (.+)\.\r?\nReply in [^\n]+\./;
function firstMessageLength(text) {
  const m = FIRST_MESSAGE_RE.exec(text);
  return m && m[1].endsWith(IMPROVEMENT_BRIEF_FILE) && m[2].endsWith(IMPROVEMENT_INDEX_FILE) ? m[0].length : void 0;
}
function isImprovementFirstMessage(text) {
  const trimmed = text.trim();
  return firstMessageLength(trimmed) === trimmed.length;
}
function startsWithImprovementFirstMessage(text) {
  const trimmed = text.trimStart();
  const length = firstMessageLength(trimmed);
  return length !== void 0 && (length === trimmed.length || /^\r?\n/.test(trimmed.slice(length)));
}
var IMPROVEMENT_TOOL_FILE = "improvement.mjs";
var LAISORA_SOURCE_FILES = [["dist", "extension.js"], ["l10n", "bundle.l10n.ja.json"]];
var LAISORA_EXTENSION_FOLDER_PREFIX = "az-llc.laisora-";
var bashQuoted = (value) => `'${value.replace(/(?<=[^\\/:])[\\/]+$/, "").replace(/'/g, "'\\''")}'`;
function improvementRecordCommand(runtimePath, toolPath, configDir) {
  return `ELECTRON_RUN_AS_NODE=1 ${bashQuoted(runtimePath)} ${bashQuoted(toolPath)} record --config-dir ${bashQuoted(configDir)}`;
}
var IMPROVEMENT_SCAN_TIMEOUT_MS = 10 * 60 * 1e3;
var IMPROVEMENT_PARTIAL_STALE_MS = 6 * IMPROVEMENT_SCAN_TIMEOUT_MS;
var IMPROVEMENT_RUN_MIN_AGE_MS = 14 * 24 * 60 * 60 * 1e3;

// src/improvement-scan.ts
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

// src/laisora-input.ts
var LAISORA_INPUT_HEAD = /^\[LAISORA:(resume|todo|todoFromReply|improvement|migrationImport|handoffContinue|waitNotifyCarry)\](?: ([^\n]*))?\n/;
var TODO_FROM_REPLY_START = "start";
function parseLaisoraInput(recorded) {
  const trimmed = recorded.trimStart();
  const head = LAISORA_INPUT_HEAD.exec(trimmed);
  if (!head) return void 0;
  const input = head[1] === "todo" ? { kind: "todo", title: head[2] ?? "" } : head[1] === "todoFromReply" ? { kind: "todoFromReply", start: head[2] === TODO_FROM_REPLY_START } : head[1] === "improvement" ? { kind: "improvement" } : head[1] === "migrationImport" ? { kind: "migrationImport" } : head[1] === "handoffContinue" ? { kind: "handoffContinue" } : head[1] === "waitNotifyCarry" ? { kind: "waitNotifyCarry" } : { kind: "resume" };
  return { input, text: trimmed.slice(head[0].length) };
}

// src/human-input-vocabulary.ts
var PURE_COMMAND_WRAPPER_RE = new RegExp(
  "^/(?:model|effort|color|clear|compact|context|help|init|login|logout|memory|permissions|plan|resume|status|terminal-setup|vim|voice)\\s*$",
  "i"
);
var CLI_USER_INTERRUPTED_TEXTS = [
  "[Request interrupted by user]",
  "[Request interrupted by user for tool use]"
];
var CLI_SYNTHETIC_EXACT_TEXTS = [
  ...CLI_USER_INTERRUPTED_TEXTS,
  "[Request interrupted: the session ended before this agent finished. Nobody asked it to stop.]",
  "[Agent call interrupted: the process running this conversation stopped before this agent finished, so it returned no result. Nobody asked it to stop.]",
  "[Tool call did not complete: the turn was ended to deliver the message that follows. Nothing refused it; re-run it if still needed.]",
  "[Tool call interrupted: the session ended before this call's result was recorded, so its outcome is unknown. Check whether it took effect before relying on it or running it again.]",
  "[Tool call result not in this copy: this session was copied from another session before that session recorded this call's result. The call may have finished there, may still be running there, or may never have run. Check whether it took effect before relying on it or running it again.]"
];
var CLI_SYNTHETIC_PREFIXED_TEXTS = [
  "The user doesn't want to take this action right now. STOP what you are doing and wait for the user to tell you how to proceed.",
  "[Tool call skipped: the turn was stopped before this call ran, by the check whose denial is on another call in this batch. Nothing refused this call and it had no effects; re-run it if still needed.]",
  "[Tool call skipped: the turn ended to deliver the message that follows before this call ran. Nothing refused it; re-run it if still needed.]"
];
var CLI_SYNTHETIC_USER_TEXTS = [...CLI_SYNTHETIC_EXACT_TEXTS, ...CLI_SYNTHETIC_PREFIXED_TEXTS];

// src/shell-tools.ts
var SHELL_TOOLS = /* @__PURE__ */ new Set(["Bash", "PowerShell"]);
function isShellTool(tool) {
  return SHELL_TOOLS.has(tool);
}
var COMMAND_RUNNING_TOOLS = /* @__PURE__ */ new Set([...SHELL_TOOLS, "Monitor"]);
function toolDialect(tool) {
  return tool === "PowerShell" ? "powershell" : "posix";
}
var C_ESCAPES = { a: "\x07", b: "\b", e: "\x1B", E: "\x1B", f: "\f", n: "\n", r: "\r", t: "	", v: "\v" };
var POWERSHELL_ESCAPES = Object.fromEntries([...Object.entries(C_ESCAPES).filter(([name]) => name === name.toLowerCase()), ["0", "\0"]]);

// src/regexp-escape.ts
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// l10n/bundle.l10n.json
var Denied_by_the_LAISORA_user = "Denied by the LAISORA user";

// l10n/bundle.l10n.ja.json
var Denied_by_the_LAISORA_user2 = "LAISORA \u30E6\u30FC\u30B6\u30FC\u304C\u62D2\u5426\u3057\u307E\u3057\u305F";

// src/tool-result-signals.ts
var TOOL_USE_REJECTED_HEAD = "The user doesn't want to proceed with this tool use";
var TOOL_USE_REJECTED_TEXT = `${TOOL_USE_REJECTED_HEAD}. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.`;
var TOOL_USE_REJECTED_RESULT = "User rejected tool use";
var PERMISSION_REFUSED = `${escapeRegExp(TOOL_USE_REJECTED_HEAD)}\\b`;
var TOOL_USE_ERROR_PREFIX = "Error: ";
var OPTIONAL_ERROR_PREFIX = `(?:${escapeRegExp(TOOL_USE_ERROR_PREFIX)})?`;
var CLI_REJECTION_RE = new RegExp(`^${OPTIONAL_ERROR_PREFIX}${escapeRegExp(TOOL_USE_REJECTED_RESULT)}\\b`);
var USER_INTERRUPTED = CLI_USER_INTERRUPTED_TEXTS.map(escapeRegExp).join("|");
var HOOK_DENIAL_EVENT = "PreToolUse";
var HOOK_EVENTS = [HOOK_DENIAL_EVENT, "PostToolUse", "PermissionRequest", "UserPromptSubmit", "Stop", "SubagentStop"];
var HOOK_DENIAL_SUFFIX = " hook error:";
var HOOK_DENIAL = String.raw`${escapeRegExp(HOOK_DENIAL_EVENT)}(?::\S+)?${escapeRegExp(HOOK_DENIAL_SUFFIX)}`;
var HARNESS_DENIED = "Permission for this action was denied by";
var INPUT_VALIDATION = "InputValidationError|Invalid arguments for tool";
var AUTO_MODE_COULD_NOT_EVALUATE = "Auto mode could not evaluate this action";
var AUTO_MODE_UNEVALUATED = `${AUTO_MODE_COULD_NOT_EVALUATE} and is blocking it for safety`;
var CLASSIFIER_GAVE_NO_VERDICT = "auto mode classifier gave no verdict";
var CLASSIFIER_NO_VERDICT = `The server-side ${CLASSIFIER_GAVE_NO_VERDICT}`;
var CLASSIFIER_UNAVAILABLE_RE = new RegExp([CLASSIFIER_GAVE_NO_VERDICT, "classifier:auto-mode:unavailable", AUTO_MODE_COULD_NOT_EVALUATE].map(escapeRegExp).join("|"));
var CLASSIFIER_DENIAL_RE = /denied by the Claude Code auto mode classifier\. Reason: ([^\n]*?)(?:\. If you have| IMPORTANT|$)/;
var SAFETY_CHECK = "built-in Claude Code safety check";
var SAFETY_BOILERPLATE_RE = new RegExp(String.raw`^\s*Permission for this command was denied by a ${escapeRegExp(SAFETY_CHECK)}, not by the user\.\s*`);
var PERMISSION_PROMPT_RE = /The following part requires approval:[^\n]{0,80}|requested permissions to \w+ (?:from|to|in) [^\n,]{0,120}, but you haven't granted it yet|requires approval[^\n]{0,60}/;
var HOOK_ERROR_RE = new RegExp(String.raw`^(${HOOK_EVENTS.join("|")})(?::\S+)?${escapeRegExp(HOOK_DENIAL_SUFFIX)} ([\s\S]*)$`);
var EXIT_CODE_RE = /^Exit code (\d+)/;
var AGENT_TYPE_NOT_FOUND = String.raw`Agent type '[^'\n]*' not found\. Available agents:`;
var ISOLATION_WORKTREE_REFUSED = String.raw`Refusing to use [^\n]* as an isolation worktree:`;
var LAISORA_DENIALS = [Denied_by_the_LAISORA_user, Denied_by_the_LAISORA_user2].map(escapeRegExp);
var anchored = (...parts) => new RegExp(`^(?:${parts.join("|")})`);
var HUMAN_REJECTED_TOOL_RESULT_RE = anchored(PERMISSION_REFUSED, USER_INTERRUPTED);
var HARNESS_DENIED_TOOL_RESULT_RE = new RegExp(HARNESS_DENIED);
var INPUT_VALIDATION_TOOL_RESULT_RE = new RegExp(INPUT_VALIDATION);
var REJECTED_BEFORE_RUN_RE = anchored(
  HOOK_DENIAL,
  HARNESS_DENIED,
  INPUT_VALIDATION,
  AUTO_MODE_UNEVALUATED,
  CLASSIFIER_NO_VERDICT,
  AGENT_TYPE_NOT_FOUND,
  ISOLATION_WORKTREE_REFUSED,
  ...LAISORA_DENIALS
);
function stripToolUseErrorTags(text) {
  return text.replace(/<\/?tool_use_error>/g, "");
}
var LAISORA_DENIAL_RE = new RegExp(`^${OPTIONAL_ERROR_PREFIX}(?:${LAISORA_DENIALS.join("|")})`);
function isCliRejectionText(text) {
  return CLI_REJECTION_RE.test(stripToolUseErrorTags(text).trimStart());
}
function isLaisoraDenialText(text) {
  return LAISORA_DENIAL_RE.test(stripToolUseErrorTags(text).trimStart());
}
function isInterruptedWhileRunning(result) {
  return result.isError === true && HUMAN_REJECTED_TOOL_RESULT_RE.test(stripToolUseErrorTags(result.resultPreview).trimStart());
}
function isHumanRejectedText(text) {
  return isCliRejectionText(text) || isLaisoraDenialText(text) || isInterruptedWhileRunning({ isError: true, resultPreview: text });
}
function classifyToolFailure(rawText, toolName, record2 = {}) {
  const text = stripToolUseErrorTags(rawText).trimStart();
  const pd = record2.permissionDecision;
  const denial = record2.toolDenialKind;
  const hook = HOOK_ERROR_RE.exec(text);
  if (hook) return { kind: "hook_denial", event: hook[1], body: hook[2] };
  if (CLASSIFIER_UNAVAILABLE_RE.test(text) || denial === "automode-unavailable") return { kind: "classifier_unavailable" };
  const classifier = CLASSIFIER_DENIAL_RE.exec(text);
  if (classifier || denial === "automode-blocked") {
    return { kind: "classifier_denial", reason: classifier ? classifier[1].replace(/^\[|\]$/g, "") : pd?.classifierCategory || void 0 };
  }
  if (pd?.reasonType === "safetyCheck" || text.includes(SAFETY_CHECK)) return { kind: "safety_check", message: text.replace(SAFETY_BOILERPLATE_RE, "") };
  const prompt = PERMISSION_PROMPT_RE.exec(text);
  if (prompt) return { kind: "permission_prompt", prompt: prompt[0] };
  if (denial === "user-rejected" || isHumanRejectedText(text)) {
    return { kind: "user_rejected" };
  }
  if (pd?.source === "hook" && pd?.decision !== "accept") return { kind: "hook_denial", event: void 0, body: text };
  const tool = toolName || void 0;
  const exit = tool !== void 0 && isShellTool(tool) ? EXIT_CODE_RE.exec(text) : null;
  if (exit) return { kind: "nonzero_exit", code: Number(exit[1]) };
  return { kind: tool?.startsWith("mcp__") ? "mcp_tool_error" : tool === void 0 || tool === "?" || isShellTool(tool) ? "other" : "builtin_tool_error" };
}

// src/file-writing-tools.ts
var FILE_WRITING_TOOLS = ["Edit", "Write", "MultiEdit"];
var NOTEBOOK_EDIT_TOOL = "NotebookEdit";
var FILE_CHANGING_TOOLS = [...FILE_WRITING_TOOLS, NOTEBOOK_EDIT_TOOL];
var FILE_TARGET_TOOLS = ["Read", ...FILE_CHANGING_TOOLS];
var FILE_WRITING_TOOL_SET = new Set(FILE_WRITING_TOOLS);
var FILE_CHANGING_TOOL_SET = new Set(FILE_CHANGING_TOOLS);
var FILE_TARGET_TOOL_SET = new Set(FILE_TARGET_TOOLS);
function isFileChangingTool(toolName) {
  return FILE_CHANGING_TOOL_SET.has(toolName);
}

// src/subagent-files.ts
var SUBAGENTS_DIR_NAME = "subagents";
var AGENT_PREFIX = "agent-";
var TRANSCRIPT_SUFFIX = ".jsonl";
var META_SUFFIX = ".meta.json";
var TRANSCRIPT_SUFFIX_RE = /\.jsonl$/i;
function agentIdOf(name, suffix) {
  if (!name.startsWith(AGENT_PREFIX) || !name.endsWith(suffix)) return void 0;
  const agentId = name.slice(AGENT_PREFIX.length, name.length - suffix.length);
  return agentId.length > 0 ? agentId : void 0;
}
function agentIdOfTranscriptName(name) {
  return agentIdOf(name, TRANSCRIPT_SUFFIX);
}
function subagentMetaPathOf(transcriptPath) {
  return transcriptPath.replace(TRANSCRIPT_SUFFIX_RE, META_SUFFIX);
}
function isSubagentTranscriptPath(filePath) {
  return filePath.split(/[\\/]/).includes(SUBAGENTS_DIR_NAME);
}
function parseSubagentMeta(text) {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function readSubagentMetaSync(metaPath, readText) {
  try {
    return parseSubagentMeta(readText(metaPath));
  } catch {
    return null;
  }
}
function subagentLaunchToolUseId(meta) {
  return typeof meta?.toolUseId === "string" ? meta.toolUseId : void 0;
}
function forkLaunchOf(meta) {
  const toolUseId = meta?.isFork === true ? subagentLaunchToolUseId(meta) : void 0;
  return toolUseId === void 0 ? void 0 : { toolUseId, settled: meta.finished === true || meta.stoppedByUser === true };
}
function isForkLaunchRecord(record2, launchToolUseId) {
  if (typeof record2 !== "object" || record2 === null) return false;
  const { type, message } = record2;
  const content = typeof message === "object" && message !== null ? message.content : void 0;
  return type === "assistant" && Array.isArray(content) && content.some((block) => typeof block === "object" && block !== null && block.type === "tool_use" && block.id === launchToolUseId);
}
function isForkLaunchLine(line, launchToolUseId) {
  if (!line.includes(launchToolUseId)) return false;
  try {
    return isForkLaunchRecord(JSON.parse(line), launchToolUseId);
  } catch {
    return false;
  }
}
function forkCopiesAt(launchIndex, itemCount, fork) {
  if (launchIndex >= 0) return { copied: launchIndex + 1, launchMissing: false };
  return fork.settled ? { copied: 0, launchMissing: true } : { copied: itemCount, launchMissing: false };
}
function forkCopiedLineCount(lines, fork) {
  if (fork === void 0) return { copied: 0, launchMissing: false };
  return forkCopiesAt(lines.findIndex((line) => isForkLaunchLine(line, fork.toolUseId)), lines.length, fork);
}
var FORK_SCAN_CHUNK_BYTES = 1 << 20;
function withoutForkLaunchAnswer(record2, fork) {
  if (fork === void 0 || record2.type !== "user") return record2;
  const message = record2.message;
  if (typeof message !== "object" || message === null) return record2;
  const content = message.content;
  if (!Array.isArray(content)) return record2;
  const own = content.filter((block) => !(typeof block === "object" && block !== null && block.type === "tool_result" && block.tool_use_id === fork.toolUseId));
  return own.length === content.length ? record2 : { ...record2, message: { ...message, content: own } };
}

// src/ask-unanswered.ts
var ASK_UNANSWERED_KINDS = ["skipped", "replied_in_chat", "dismissed"];
function isAskUnansweredKind(value) {
  return ASK_UNANSWERED_KINDS.includes(value);
}
var APPROVAL_RESOLVED_BY = {
  user: "user",
  chat: "chat",
  interrupt: "interrupt",
  dispose: "dispose",
  withdrawn: "withdrawn"
};
var ASK_UNANSWERED_BY = /* @__PURE__ */ new Map([
  [APPROVAL_RESOLVED_BY.user, "skipped"],
  [APPROVAL_RESOLVED_BY.chat, "replied_in_chat"]
]);
var asObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
function askUnansweredQuestions(toolUseResult) {
  const out = /* @__PURE__ */ new Map();
  const annotations = asObject(asObject(toolUseResult)?.annotations);
  for (const [question, annotation] of Object.entries(annotations ?? {})) {
    const kind = asObject(annotation)?.unanswered;
    if (isAskUnansweredKind(kind)) out.set(question, kind);
  }
  return out;
}

// src/path-redaction.ts
var PATH_CHAR = String.raw`[^\s"'\x60|;)\]}>\\<]`;
var PATH_RUN_CHAR = String.raw`(?:${PATH_CHAR}|\\(?!"))`;
var WIN_ABS = new RegExp(
  String.raw`(?:(?<![A-Za-z0-9_])|(?<=\\[nrt]))[A-Za-z]:(?:\\+|\/(?!\/)|(?<![A-Za-z0-9+.-][A-Za-z]:)\/+|(?<=\\[nrt][A-Za-z]:)\/+)${PATH_RUN_CHAR}*`,
  "g"
);
var UNC = new RegExp(String.raw`(?:(?<=^|[\s"'\x60=(\[{,:;<>|])\\{2,}|\\{4,})${PATH_RUN_CHAR}+`, "g");
var FILE_URI = new RegExp(String.raw`file:\/\/${PATH_RUN_CHAR}+`, "gi");
var POSIX_ABS = new RegExp(
  String.raw`(?<=^|[^\p{L}\p{N}\p{M}_./\\~%+-]|\\[nrt]|(?:^|[^\p{L}\p{N}\p{M}_./\\~%+-])-[A-Za-z])(?!(?<=<)\/[A-Za-z][\w:-]*>)(?!(?<=(?<!\\)[A-Za-z0-9+.-]:)\/\/)\/+(?!(?:dev|proc|sys)\/)${PATH_CHAR}+`,
  "gu"
);
var ROOT_SEPARATOR = String.raw`(?:\\(?!")|\/)+`;
var ROOT_START = String.raw`(?:(?<![A-Za-z0-9_./\\~%+-])(?<!(?:^|[^A-Za-z0-9])[A-Za-z]:)|(?<=\\[nrt]))`;
var ROOT_BARE_END = String.raw`(?=$|\s|[\x60|=]|[.,!?;:'")\]}>](?![A-Za-z0-9_-])|[、。，．！？」』）\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー])`;
var hostPathRoots = [];
function basenameOf(token) {
  const parts = token.split(/[\\/]+/).filter((p) => p.length > 0);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}
function redactPaths(text, roots) {
  let out = text;
  for (const root of roots) out = out.replace(root.pattern, (_m, rest) => basenameOf(rest ?? "") || root.label);
  return out.replace(FILE_URI, (m) => basenameOf(m)).replace(WIN_ABS, (m) => basenameOf(m)).replace(UNC, (m) => basenameOf(m)).replace(POSIX_ABS, (m) => basenameOf(m));
}
function redactAbsolutePaths(text) {
  return redactPaths(text, hostPathRoots);
}

// package.json
var contributes = {
  commands: [
    {
      command: "laisora.open",
      title: "%command.laisora.open.title%"
    },
    {
      command: "laisora.openSettings",
      title: "%command.laisora.openSettings.title%"
    }
  ],
  keybindings: [
    {
      key: "ctrl+shift+v",
      mac: "cmd+shift+v",
      command: "laisora.pasteText",
      when: "laisora.composerFocused"
    },
    {
      key: "ctrl+alt+t",
      mac: "ctrl+alt+t",
      command: "laisora.todoToggleDrawer",
      when: "laisora.todoDrawerKey"
    }
  ],
  viewsContainers: {
    activitybar: [
      {
        id: "laisora",
        title: "LAISORA",
        icon: "media/laisora-icon.svg"
      }
    ]
  },
  views: {
    laisora: [
      {
        id: "laisora.home",
        name: "LAISORA",
        type: "webview"
      }
    ]
  },
  configuration: {
    title: "LAISORA",
    properties: {
      "laisora.claude.initialModel": {
        type: "string",
        default: "",
        scope: "application",
        description: "%config.laisora.claude.initialModel.description%"
      },
      "laisora.claude.settingSources": {
        type: "array",
        items: {
          type: "string",
          enum: [
            "user",
            "project",
            "local"
          ]
        },
        default: [
          "user",
          "project",
          "local"
        ],
        description: "%config.laisora.claude.settingSources.description%",
        scope: "machine"
      },
      "laisora.claude.transcriptRetentionDays": {
        type: [
          "integer",
          "null"
        ],
        minimum: 1,
        default: null,
        description: "%config.laisora.claude.transcriptRetentionDays.description%",
        scope: "machine"
      },
      "laisora.claude.executablePath": {
        type: "string",
        default: "",
        scope: "machine",
        description: "%config.laisora.claude.executablePath.description%"
      },
      "laisora.claude.apiKeyPolicy": {
        type: "string",
        enum: [
          "inherit",
          "subscriptionOnly"
        ],
        default: "inherit",
        scope: "machine",
        description: "%config.laisora.claude.apiKeyPolicy.description%",
        enumDescriptions: [
          "%config.laisora.claude.apiKeyPolicy.inherit%",
          "%config.laisora.claude.apiKeyPolicy.subscriptionOnly%"
        ]
      },
      "laisora.workLog.semanticView": {
        type: "boolean",
        default: true,
        description: "%config.laisora.workLog.semanticView.description%"
      },
      "laisora.defaultCwd": {
        type: "string",
        default: "",
        description: "%config.laisora.defaultCwd.description%",
        scope: "machine"
      },
      "laisora.tabLimit": {
        type: "integer",
        minimum: 1,
        default: 20,
        description: "%config.laisora.tabLimit.description%"
      },
      "laisora.history.eventLimit": {
        type: "integer",
        minimum: 1e3,
        maximum: 1e5,
        default: 5e3,
        description: "%config.laisora.history.eventLimit.description%"
      },
      "laisora.restoreTabsOnStartup": {
        type: "boolean",
        default: true,
        description: "%config.laisora.restoreTabsOnStartup.description%"
      },
      "laisora.claude.planInstruction": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.claude.planInstruction.description%"
      },
      "laisora.claude.closingSummary": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.claude.closingSummary.description%"
      },
      "laisora.claude.askQualityCheck": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.claude.askQualityCheck.description%"
      },
      "laisora.todo.enabled": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.todo.enabled.description%"
      },
      "laisora.editSummary.enabled": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.editSummary.enabled.description%"
      },
      "laisora.remoteControl.showCard": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.remoteControl.showCard.description%"
      },
      "laisora.remoteControl.waitNotify.enabled": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.remoteControl.waitNotify.enabled.description%"
      },
      "laisora.remoteControl.waitNotify.minutes": {
        type: "integer",
        default: 5,
        minimum: 3,
        maximum: 720,
        scope: "application",
        description: "%config.laisora.remoteControl.waitNotify.minutes.description%"
      },
      "laisora.improvementAnalysis.showMenuItem": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.improvementAnalysis.showMenuItem.description%"
      },
      "laisora.welcome.showNews": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.welcome.showNews.description%"
      },
      "laisora.welcome.showTips": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.welcome.showTips.description%"
      },
      "laisora.handoff.auto.enabled": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.handoff.auto.enabled.description%"
      },
      "laisora.handoff.auto.mode": {
        type: "string",
        enum: [
          "ratio",
          "tokens"
        ],
        enumDescriptions: [
          "%config.laisora.handoff.auto.mode.ratio%",
          "%config.laisora.handoff.auto.mode.tokens%"
        ],
        default: "ratio",
        scope: "application",
        description: "%config.laisora.handoff.auto.mode.description%"
      },
      "laisora.handoff.auto.percent": {
        type: "integer",
        minimum: 10,
        maximum: 95,
        default: 70,
        scope: "application",
        description: "%config.laisora.handoff.auto.percent.description%"
      },
      "laisora.handoff.auto.tokens": {
        type: "integer",
        minimum: 1e5,
        default: 5e5,
        scope: "application",
        description: "%config.laisora.handoff.auto.tokens.description%"
      },
      "laisora.handoff.cacheExpiry.enabled": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.handoff.cacheExpiry.enabled.description%"
      },
      "laisora.handoff.auto.continueWork": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.handoff.auto.continueWork.description%"
      },
      "laisora.handoff.auto.closingSummary": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.handoff.auto.closingSummary.description%"
      },
      "laisora.handoff.closeSourceTab": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.handoff.closeSourceTab.description%"
      },
      "laisora.claude.fileLinkInstruction": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.claude.fileLinkInstruction.description%"
      },
      "laisora.fileLinks.openWithSystemApp": {
        type: "array",
        items: {
          type: "string",
          pattern: "^\\.[a-z0-9_-]+$"
        },
        default: [
          ".xlsx",
          ".xls",
          ".docx",
          ".doc",
          ".pptx",
          ".ppt",
          ".pdf"
        ],
        scope: "application",
        description: "%config.laisora.fileLinks.openWithSystemApp.description%"
      },
      "laisora.fileLinks.revealInExplorer": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.fileLinks.revealInExplorer.description%"
      },
      "laisora.fileLinks.allowOutsideWorkspace": {
        type: "boolean",
        default: false,
        scope: "machine",
        description: "%config.laisora.fileLinks.allowOutsideWorkspace.description%"
      },
      "laisora.fileLinks.confirmOutsideWorkspace": {
        type: "boolean",
        default: true,
        scope: "machine",
        description: "%config.laisora.fileLinks.confirmOutsideWorkspace.description%"
      },
      "laisora.fileLinks.openOutsideReadOnly": {
        type: "boolean",
        default: true,
        scope: "machine",
        description: "%config.laisora.fileLinks.openOutsideReadOnly.description%"
      },
      "laisora.composer.sendKey": {
        type: "string",
        enum: [
          "enter",
          "shiftEnter"
        ],
        default: "enter",
        scope: "application",
        description: "%config.laisora.composer.sendKey.description%",
        enumDescriptions: [
          "%config.laisora.composer.sendKey.enter%",
          "%config.laisora.composer.sendKey.shiftEnter%"
        ]
      },
      "laisora.interruptForceKillTimeoutMs": {
        type: "number",
        default: 5e3,
        description: "%config.laisora.interruptForceKillTimeoutMs.description%"
      },
      "laisora.guardrail.autoMaxLevel": {
        type: "integer",
        minimum: 0,
        maximum: 3,
        default: 1,
        description: "%config.laisora.guardrail.autoMaxLevel.description%",
        scope: "machine"
      },
      "laisora.progressTracking": {
        type: "string",
        enum: [
          "off",
          "observe",
          "instrument"
        ],
        default: "observe",
        description: "%config.laisora.progressTracking.description%"
      },
      "laisora.claude.autoUpdate": {
        type: "boolean",
        default: true,
        description: "%config.laisora.claude.autoUpdate.description%"
      },
      "laisora.codex.autoUpdate": {
        type: "boolean",
        default: true,
        description: "%config.laisora.codex.autoUpdate.description%"
      },
      "laisora.antigravity.autoUpdate": {
        type: "boolean",
        default: true,
        description: "%config.laisora.antigravity.autoUpdate.description%"
      },
      "laisora.claude.remoteControlAtStartup": {
        type: "boolean",
        default: false,
        description: "%config.laisora.claude.remoteControlAtStartup.description%",
        scope: "machine"
      },
      "laisora.claude.chromeIntegration": {
        type: "boolean",
        default: true,
        description: "%config.laisora.claude.chromeIntegration.description%",
        scope: "machine"
      },
      "laisora.claude.mcpElicitation": {
        type: "boolean",
        default: true,
        description: "%config.laisora.claude.mcpElicitation.description%",
        scope: "application"
      },
      "laisora.claude.writesLostNotice": {
        type: "boolean",
        default: true,
        description: "%config.laisora.claude.writesLostNotice.description%",
        scope: "application"
      },
      "laisora.orchestration.enabled": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.orchestration.enabled.description%"
      },
      "laisora.guard.enabled": {
        type: "boolean",
        default: true,
        scope: "application",
        description: "%config.laisora.guard.enabled.description%"
      },
      "laisora.memory.blockProjectType": {
        type: "boolean",
        default: false,
        scope: "application",
        description: "%config.laisora.memory.blockProjectType.description%"
      },
      "laisora.orchestration.agents": {
        type: "array",
        default: [
          {
            role: "worker",
            enabled: true,
            description: "Implementation and mechanical edits",
            rows: [
              {
                executor: "claude",
                model: "opus",
                efforts: [
                  "low",
                  "medium",
                  "high"
                ]
              }
            ],
            cacheTtl: "1h"
          },
          {
            role: "explorer",
            enabled: true,
            description: "Read-only search and fact finding",
            rows: [
              {
                executor: "claude",
                model: "sonnet",
                efforts: [
                  "medium"
                ]
              }
            ],
            cacheTtl: "5m"
          },
          {
            role: "reviewer",
            enabled: true,
            description: "Independent judgment on a finished change or a design; reports findings, does not edit",
            rows: [
              {
                executor: "claude",
                model: "opus",
                efforts: [
                  "medium",
                  "high"
                ]
              }
            ],
            cacheTtl: "5m"
          }
        ],
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "enabled",
            "description",
            "rows"
          ],
          properties: {
            role: {
              type: "string",
              pattern: "^[a-z][a-z0-9-]*$"
            },
            enabled: {
              type: "boolean"
            },
            description: {
              type: "string"
            },
            rows: {
              type: "array",
              maxItems: 12,
              default: [],
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "executor",
                  "model",
                  "efforts"
                ],
                properties: {
                  executor: {
                    type: "string",
                    enum: [
                      "claude",
                      "agy",
                      "codex"
                    ]
                  },
                  model: {
                    type: "string",
                    pattern: "^$|^[A-Za-z0-9][A-Za-z0-9._:-]*$"
                  },
                  efforts: {
                    type: "array",
                    uniqueItems: true,
                    items: {
                      type: "string",
                      enum: [
                        "low",
                        "medium",
                        "high",
                        "xhigh",
                        "max",
                        "ultra"
                      ]
                    }
                  }
                }
              }
            },
            cacheTtl: {
              type: "string",
              enum: [
                "5m",
                "1h"
              ]
            }
          }
        },
        scope: "application",
        description: "%config.laisora.orchestration.agents.description%"
      },
      "laisora.orchestration.conductorPolicy": {
        type: "string",
        default: "<scope>\nDeliver the requested scope; ask the user only when different readings would lead to materially different work.\n</scope>\n<delegation>\nDo work yourself when it takes a handful of tool calls; delegate only when separating work, isolating context, or independent judgment outweighs the handoff cost. Use the fewest agents and run independent ones in parallel.\nBriefs state objective, scope, sources, expected output, and how completion is checked. Ask delegates for a brief reply: the conclusion or verdict, findings with their evidence, and pointers; passed checks and out-of-scope observations one line each; nothing said twice. Have delegates return results in that reply, not in report files. Long replies are reread every later turn; when you need an omitted detail, ask the same agent with SendMessage.\nIf a delegate fails or stalls, read its output, rebrief once naming the gap, then take over or report the blocker.\n</delegation>\n<effort>\nEffort sets how deeply an agent reasons: raise it for work that needs more thought, not for a misread brief or for fixes the findings already specify.\nThe efforts below are explicit instructions; for an external target, choose the target with that effort.\n</effort>\n<workers>\nWorkers run at {d}; use {up} only when a mistake would not be caught by later checks or review (design decisions, conclusions from records, removal judgments, behavior kept identical across many places) or when an action cannot be undone.\nSend review fixes back to the worker that made the change: continue a Claude agent with SendMessage; for an external target, run the same target again with the findings and the current diff. If the work misread the request, correct the brief and send it back the same way.\nStart a new {up} worker only when the work shows shallow reasoning, such as cases left unconsidered or the same kind of defect returning after fixes; a continued agent keeps its effort.\n</workers>\n<reviewers>\nReviewers run at {up}. Tell them to report every finding with its evidence; you triage. Use {d} only for a review that confirms earlier findings were fixed, after a review that found no new defect.\nReview a design or plan once, before it is built; the round rules below apply only to reviews of a finished change.\nCount each completed review as a round, the first included. Review again after each fix, and stop when nothing actionable remains. After three rounds, continue only if the latest found a user-visible problem or data loss; otherwise stop and report the open findings to the user.\n</reviewers>\n<acceptance>\nAccept results through artifacts and checks that can fail, judging generated or selected content against the request, not just format. Rerun passed checks only when inputs changed. Before handoff or release, fix and verify material findings, dismiss them with evidence, or get the user's explicit acceptance of the risk.\n</acceptance>",
        editPresentation: "multilineText",
        scope: "application",
        description: "%config.laisora.orchestration.conductorPolicy.description%"
      },
      "laisora.orchestration.externalTimeoutMinutes": {
        type: "number",
        scope: "application",
        default: 10,
        minimum: 1,
        maximum: 120,
        description: "%config.orchestration.externalTimeoutMinutes%"
      },
      "laisora.appearance.displayName": {
        type: "string",
        default: "",
        scope: "application",
        description: "%config.laisora.appearance.displayName.description%"
      },
      "laisora.appearance.accentColor": {
        type: "string",
        enum: [
          "theme",
          "blue",
          "orange",
          "pink",
          "green",
          "custom"
        ],
        default: "theme",
        scope: "application",
        description: "%config.laisora.appearance.accentColor.description%",
        enumDescriptions: [
          "%config.laisora.appearance.accentColor.theme%",
          "%config.laisora.appearance.accentColor.blue%",
          "%config.laisora.appearance.accentColor.orange%",
          "%config.laisora.appearance.accentColor.pink%",
          "%config.laisora.appearance.accentColor.green%",
          "%config.laisora.appearance.accentColor.custom%"
        ]
      },
      "laisora.appearance.accentCustomLight": {
        type: "string",
        default: "#A84B00",
        pattern: "^#[0-9a-fA-F]{6}$",
        scope: "application",
        description: "%config.laisora.appearance.accentCustomLight.description%",
        patternErrorMessage: "%config.laisora.appearance.accentCustom.validation%"
      },
      "laisora.appearance.accentCustomDark": {
        type: "string",
        default: "#F5A35C",
        pattern: "^#[0-9a-fA-F]{6}$",
        scope: "application",
        description: "%config.laisora.appearance.accentCustomDark.description%",
        patternErrorMessage: "%config.laisora.appearance.accentCustom.validation%"
      }
    }
  }
};

// src/configuration-defaults.ts
var properties = contributes.configuration.properties;
function configurationDefault(key) {
  return properties[`laisora.${key}`].default;
}
function configurationBound(key, bound) {
  const value = properties[`laisora.${key}`]?.[bound];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`package.json laisora.${key} has no numeric ${bound}`);
  return value;
}
var CONFIGURATION_KEYS = Object.keys(properties).map((key) => key.slice("laisora.".length));
function isPortableSetting(property) {
  return property.scope !== "machine" && property.scope !== "machine-overridable";
}
var PORTABLE_CONFIGURATION_KEYS = CONFIGURATION_KEYS.filter((key) => isPortableSetting(properties[`laisora.${key}`]));

// src/model-display-name.ts
var CLAUDE_MODEL_FAMILIES = ["opus", "sonnet", "haiku", "fable"];
var CLAUDE_MODEL_ID = new RegExp(`^(claude)-(${CLAUDE_MODEL_FAMILIES.join("|")})-(\\d+(?:-\\d+)*?)(?:-(\\d{8}))?(\\[1m\\])?$`, "i");

// src/orchestration-executors.ts
var CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
var CODEX_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];
var ORCHESTRATION_PLUGIN_NAME = "laisora";
function claudeAgentName(role, model) {
  return `${role}-${model}`;
}
var AGY_EFFORTS = ["low", "medium", "high"];
function splitAgyModel(id) {
  const at = id.lastIndexOf("-");
  const effort = id.slice(at + 1);
  return at > 0 && AGY_EFFORTS.includes(effort) ? { model: id.slice(0, at), effort } : { model: id, effort: "" };
}
function agyModelChoices(list) {
  if (list?.state !== "ok") return [];
  const choices = /* @__PURE__ */ new Map();
  for (const entry of list.models) {
    const { model, effort } = splitAgyModel(entry.id);
    const efforts = choices.get(model) ?? /* @__PURE__ */ new Set();
    efforts.add(effort);
    choices.set(model, efforts);
  }
  return Array.from(choices, ([model, efforts]) => ({ model, efforts: AGY_EFFORTS.filter((effort) => efforts.has(effort)) }));
}
function isExternalModel(value) {
  return typeof value === "string" && (value === "" || /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value));
}
function legacyEntries(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).filter((row) => row && typeof row === "object");
}
function legacyEfforts(value) {
  return Array.isArray(value) ? value.filter((effort) => typeof effort === "string") : [];
}
async function detectVersion(probe) {
  const result = await probe.capture(["--version"]);
  const reason = result.timeout ? "timeout" : result.spawnCode ? `spawn-error:${result.spawnCode}` : result.code !== 0 ? `exit:${result.code ?? -1}` : !result.output.trim() ? "empty-output" : void 0;
  if (result.spawnCode) return { state: "failed", path: probe.path, reason: `spawn-error:${result.spawnCode}` };
  return reason ? { state: "found", path: probe.path, versionNote: reason } : { state: "found", path: probe.path, version: result.output.trim() };
}
var EXTERNAL_TIMEOUT_SETTING_KEY = "orchestration.externalTimeoutMinutes";
var EXTERNAL_TIMEOUT_SETTING = `laisora.${EXTERNAL_TIMEOUT_SETTING_KEY}`;
var EXTERNAL_TIMEOUT_DEFAULT_MINUTES = configurationDefault(EXTERNAL_TIMEOUT_SETTING_KEY);
var EXTERNAL_TIMEOUT_MIN_MINUTES = configurationBound(EXTERNAL_TIMEOUT_SETTING_KEY, "minimum");
var EXTERNAL_TIMEOUT_MAX_MINUTES = configurationBound(EXTERNAL_TIMEOUT_SETTING_KEY, "maximum");
var EXTERNAL_MODEL_LIST_MAX = 100;
var EXTERNAL_FAILURE_DETAIL_MAX = 300;
var CODEX_SANDBOX_SETUP_ERROR = "helper_unknown_error";
var CODEX_SANDBOX_EXEC_FAILED = "exec_command failed:";
var CODEX_SANDBOX_PROCESS_REJECTED = "Failed to create unified exec process";
var REDACTED = "[redacted]";
var SECRET_KEY = String.raw`(?:[A-Za-z0-9]+[_-])*(?:api[_-]?key|apikey|secret|password|passwd|token|authorization|cookie|credentials?|private[_-]?key|access[_-]?key)(?![A-Za-z0-9_-])`;
var SECRET_SCHEME = String.raw`(?:(?:Bearer|Basic|Token|Digest)\s+)?`;
var SECRET_ANY_VALUE = String.raw`(?:"[^"]*"|'[^']*'|[^\s"',;]+)`;
var CREDENTIAL_PATTERNS = [
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, `$1${REDACTED}@`],
  [/(?<![\w/@:.-])[A-Za-z0-9._%+-]+:[^\s@/]+@(?=[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|localhost\b)/g, `${REDACTED}@`],
  [new RegExp(String.raw`(--?${SECRET_KEY}(?:\s+|=)${SECRET_SCHEME})${SECRET_ANY_VALUE}`, "gi"), `$1${REDACTED}`],
  [new RegExp(String.raw`((?<![A-Za-z0-9_-])${SECRET_KEY}["']?\s*[=:]\s*${SECRET_SCHEME})${SECRET_ANY_VALUE}`, "gi"), `$1${REDACTED}`],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{16,}/g, `$1 ${REDACTED}`],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{8,}|sk_(?:live|test)_[A-Za-z0-9]{10,}|xox[bpas]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*)/g, REDACTED]
];
function withoutCredentials(text) {
  return CREDENTIAL_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}
function externalFailureDetail(text, pick) {
  const lines = (text ?? "").split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  const line = pick === "first" ? lines[0] : lines.at(-1);
  if (!line) return void 0;
  const masked = redactAbsolutePaths(withoutCredentials(line));
  return masked.length > EXTERNAL_FAILURE_DETAIL_MAX ? `${masked.slice(0, EXTERNAL_FAILURE_DETAIL_MAX)}\u2026` : masked;
}
function externalFailureRecordReason(code) {
  return `R-ORC-13: external executor failed (exit code ${code ?? "none"}).`;
}
var EXTERNAL_REFUSED_REASON = "R-ORC-13: external executor refused the run.";
function withDetails(reason, reported, stderr) {
  const details = [
    ...reported.map((text) => externalFailureDetail(text, "first")),
    ...[externalFailureDetail(stderr, "last")].filter(Boolean).map((line) => `stderr: ${line}`)
  ].filter(Boolean);
  return `${reason}${details.length ? ` ${details.join("; ")}` : ""}`;
}
function externalFailureReason(code, reported, stderr) {
  return withDetails(externalFailureRecordReason(code), reported, stderr);
}
function executorResult(output, code, stderr, read) {
  let value;
  try {
    value = read(output);
  } catch {
    value = { answer: "", completed: false, failed: true };
  }
  if (value.refused) return { outcome: "refused", answer: withDetails(EXTERNAL_REFUSED_REASON, value.errors ?? [], stderr), reason: EXTERNAL_REFUSED_REASON, usage: value.usage };
  const ok = code === 0 && value.completed && !value.failed && !!value.answer.trim();
  return ok ? { outcome: "ok", answer: value.answer, usage: value.usage } : { outcome: "failed", answer: externalFailureReason(code, value.errors ?? [], stderr), reason: externalFailureRecordReason(code), usage: value.usage };
}
function codexCommandSandboxState(item) {
  if (item?.type !== "command_execution") return void 0;
  const output = typeof item.aggregated_output === "string" ? item.aggregated_output.trimStart() : "";
  if (output.startsWith(CODEX_SANDBOX_EXEC_FAILED) && (output.includes(CODEX_SANDBOX_SETUP_ERROR) || output.includes(CODEX_SANDBOX_PROCESS_REJECTED))) return "sandbox-failed";
  return typeof item.exit_code === "number" ? "ran" : void 0;
}
var USAGE_KEYS = [
  "input_tokens",
  "cached_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "cache_read_input_tokens",
  "cache_creation_input_tokens",
  "total_tokens",
  "thinking_tokens",
  "cache_read_tokens"
];
function tokenUsage(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const entries = Object.entries(raw).filter(([key, value]) => USAGE_KEYS.includes(key) && typeof value === "number" && Number.isFinite(value) && value >= 0);
  return entries.length ? Object.freeze(Object.fromEntries(entries)) : void 0;
}
function parseAgyModels(output) {
  const models = [];
  for (const line of output.split(/\r?\n/).filter((entry) => entry.includes("	"))) {
    const id = line.split("	")[0];
    if (!id || !isExternalModel(id) || models.some((model) => model.id === id)) continue;
    models.push({ id, label: id });
    if (models.length === EXTERNAL_MODEL_LIST_MAX) break;
  }
  return models.length ? { state: "ok", models } : { state: "failed", reason: "empty-model-list" };
}
function parseCodexModels(result) {
  if (!result || typeof result !== "object") return { state: "failed", reason: "invalid-model-list" };
  const page = result;
  if (!Array.isArray(page.data) || !(page.nextCursor === null || typeof page.nextCursor === "string")) {
    return { state: "failed", reason: "invalid-model-list" };
  }
  const models = [];
  for (const item of page.data) {
    if (!item || !item.id || !isExternalModel(item.id) || models.some((model) => model.id === item.id)) continue;
    if (!Array.isArray(item.supportedReasoningEfforts) || !item.supportedReasoningEfforts.every((effort) => effort && typeof effort === "object" && typeof effort.reasoningEffort === "string")) {
      return { state: "failed", reason: "invalid-model-efforts" };
    }
    models.push({
      id: item.id,
      label: typeof item.displayName === "string" ? item.displayName : item.id,
      efforts: CODEX_EFFORTS.filter((effort) => item.supportedReasoningEfforts.some((value) => value.reasoningEffort === effort))
    });
    if (models.length === EXTERNAL_MODEL_LIST_MAX) break;
  }
  return { state: "ok", models, nextCursor: page.nextCursor };
}
var EXECUTORS = {
  claude: {
    id: "claude",
    writable: true,
    displayName: "Claude",
    kind: "agent",
    efforts: CLAUDE_EFFORTS,
    models: (list) => list?.state === "ok" ? list.models.map(({ id, label }) => ({ model: id, label, efforts: id === "haiku" ? [] : CLAUDE_EFFORTS })) : ["haiku", "sonnet", "opus"].map((model) => ({ model, efforts: model === "haiku" ? [] : CLAUDE_EFFORTS })),
    fallbackEfforts: (model) => model === "haiku" ? [] : CLAUDE_EFFORTS,
    normalize: (row) => ({ ...row, efforts: row.model === "haiku" ? [] : row.efforts }),
    legacy: (entry) => [
      ...entry.haiku === true ? [{ executor: "claude", model: "haiku", efforts: [] }] : [],
      ...["sonnet", "opus"].filter((model) => legacyEfforts(entry[model]).length).map((model) => ({ executor: "claude", model, efforts: legacyEfforts(entry[model]) })),
      ...typeof entry.model === "string" && ["haiku", "sonnet", "opus"].includes(entry.model) ? [{ executor: "claude", model: entry.model, efforts: entry.model === "haiku" ? [] : typeof entry.effort === "string" ? [entry.effort] : [] }] : []
    ],
    targetKey: (role, model, effort) => `${ORCHESTRATION_PLUGIN_NAME}:${claudeAgentName(role, model)}${effort ? `-${effort}` : ""}`
  },
  agy: {
    id: "agy",
    writable: false,
    displayName: "Antigravity",
    kind: "external",
    efforts: AGY_EFFORTS,
    models: (list) => list?.state === "ok" ? agyModelChoices(list) : void 0,
    fallbackEfforts: () => [],
    normalize: (row, legacy) => {
      if (!legacy) return row;
      const split = splitAgyModel(row.model);
      return { ...row, model: split.model, efforts: split.effort ? [split.effort] : row.efforts };
    },
    legacy: (entry) => legacyEntries(entry.agy).filter((row) => row.use !== false).map((row) => ({ executor: "agy", model: typeof row.model === "string" ? row.model : "", efforts: typeof row.effort === "string" && row.effort ? [row.effort] : [] })),
    targetKey: (role, model, effort) => `${role}/agy@${model}${effort ? `-${effort}` : ""}`,
    localPath: ["agy", "bin"],
    detect: detectVersion,
    preamble: "You are a read-only reviewer. The command tool is unavailable and fails immediately. Do not list or search directories. Read only the absolute file paths listed below.",
    argv: (model, effort, cwd, minutes, prompt) => ["--add-dir", cwd, "--print-timeout", `${minutes}m`, "--output-format", "json", "--model", `${model}${effort ? `-${effort}` : ""}`, `--print=${prompt}`],
    parseOutput: (output, code, stderr) => executorResult(output, code, stderr, (text) => {
      const value = JSON.parse(text);
      return {
        completed: typeof value.status === "string" && value.status.toUpperCase() === "SUCCESS",
        failed: !!value.error,
        refused: value.status === "refused" || value.status === "permission_denied",
        errors: [typeof value.error === "string" ? value.error : typeof value.error?.message === "string" ? value.error.message : void 0],
        answer: [value.result, value.response, value.answer, value.text, value.output].find((entry) => typeof entry === "string") ?? "",
        usage: tokenUsage(value.usage)
      };
    }),
    listModels: async (probe) => {
      const result = await probe.capture(["models"]);
      if (result.timeout || result.code !== 0 || result.reason || result.output.length > 1e6) return { state: "failed", reason: result.timeout ? "timeout" : result.spawnCode === "ENOENT" ? "not-installed" : "model-list-failed" };
      return parseAgyModels(result.output);
    }
  },
  codex: {
    id: "codex",
    writable: true,
    displayName: "Codex",
    kind: "external",
    efforts: CODEX_EFFORTS,
    models: (list) => list?.state === "ok" ? list.models.map((model) => ({ model: model.id, efforts: model.efforts ?? CODEX_EFFORTS })) : void 0,
    fallbackEfforts: () => CODEX_EFFORTS,
    normalize: (row) => row,
    legacy: (entry) => legacyEntries(entry.codex).map((row) => ({ executor: "codex", model: typeof row.model === "string" ? row.model : "", efforts: legacyEfforts(row.efforts) })),
    targetKey: (role, model, effort) => `${role}/codex@${model}-${effort}`,
    localPath: ["Programs", "OpenAI", "Codex", "bin"],
    detect: detectVersion,
    preamble: "You are a read-only reviewer. Review the supplied task and files without modifying files.",
    argv: (model, effort, _cwd, _minutes, prompt, role) => ["exec", "--skip-git-repo-check", "-s", role === "worker" ? "workspace-write" : "read-only", "-m", model, "-c", `model_reasoning_effort=${effort}`, "--json", prompt],
    parseOutput: (output, code, stderr) => executorResult(output, code, stderr, (text) => {
      let answer = "", completed = false, failed = false, error, sandboxFailed = false, usage;
      for (const line of text.split(/\r?\n/).filter((line2) => line2.trim())) {
        const value = JSON.parse(line);
        if (value.type === "turn.completed") {
          completed = true;
          usage = tokenUsage(value.usage);
        }
        if (value.type === "turn.failed") {
          failed = true;
          if (typeof value.error?.message === "string") error = value.error.message;
        }
        if (value.type === "error" && typeof value.message === "string") error = value.message;
        const command = value.type === "item.completed" ? codexCommandSandboxState(value.item) : void 0;
        if (command) sandboxFailed = command === "sandbox-failed";
        if (value.type === "item.completed" && value.item?.type === "agent_message") answer = typeof value.item.text === "string" ? value.item.text : "";
      }
      return {
        answer,
        completed,
        failed: failed || sandboxFailed,
        usage,
        errors: [error, sandboxFailed ? "Codex could not start commands in its sandbox" : void 0]
      };
    }),
    listModels: (probe) => probe.rpc(["app-server"], { method: "initialize", params: { clientInfo: { name: "laisora", title: "LAISORA", version: probe.version } } }, { method: "initialized" }, "model/list", parseCodexModels)
  }
};
var EXTERNAL_EXECUTORS = Object.values(EXECUTORS).filter((definition) => definition.kind === "external");
var DEFAULT_EXECUTOR = Object.values(EXECUTORS).find((definition) => definition.kind === "agent").id;

// src/claude-tool-names.ts
var TASK_TOOL_NAMES = /* @__PURE__ */ new Set(["TodoWrite", "TaskCreate", "TaskUpdate"]);

// src/artifact-access.ts
var PROGRESS_WIRE_TOOL_NAME = "mcp__laisora_progress__progress";
var KNOWN_NO_EFFECT_TOOLS = /* @__PURE__ */ new Set([
  ...TASK_TOOL_NAMES,
  "ToolSearch",
  "ExitPlanMode",
  "AskUserQuestion",
  PROGRESS_WIRE_TOOL_NAME
]);

// src/edit-summary.ts
function asObject2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function singleToolUseResult(content, toolUseResult) {
  if (!Array.isArray(content)) return void 0;
  return content.filter((block) => asObject2(block)?.type === "tool_result").length === 1 ? toolUseResult : void 0;
}

// src/improvement-scan.ts
var IMPROVEMENT_LINE_MAX_CHARS = 16 * 1024 * 1024;
var RETRY_SIM = 0.8;
var CANDIDATE_RETRY_SIM = 0.5;
var INDEX_DAYS = 6;
var INDEX_MASKED_OWNERS = 16;
var COMPACT_DETAIL_CHARS = 50;
var INDEX_SLOW = 8;
var INDEX_CAUSES = 24;
var OWNER_TAIL_MIN_CONVERSATIONS = 3;
var CLASS_MEMBER_CAP = 12;
var SIGNATURE_CHARS = 60;
var SPLIT_WORDS = 3;
var OTHER_REASONS = "other reasons";
var OWNER_REASONS_SHOWN = 2;
var OWNER_REASON_CHARS = 50;
var SLOW_CALL_SEC = 60;
var IMPROVEMENT_MARKER_SCAN_LINES = 400;
var HOOK_SOURCE_MAX_BYTES = 2 * 1024 * 1024;
var LAISORA_SOURCE_MAX_BYTES = 64 * 1024 * 1024;
var HOOK_SCRIPT_RE = /\.(?:mjs|cjs|js|ts|py|ps1|sh|bash|cmd|bat)$/i;
var SOURCE_HEAD_MIN = 16;
var LAISORA_HEAD_MIN = 20;
var LISTED_IN_ANY_CONVERSATION = ["hook_denial", "hook_failure", "classifier_denial", "permission_prompt", "safety_check"];
var PROMPT_DETAIL_CHARS = 100;
function hookReason(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const head = lines[0] ?? "";
  return /[:：]$/.test(head) && lines[1] ? `${head} ${lines[1]}` : head;
}
var LISTED_FROM_MIN_CONVERSATIONS = ["nonzero_exit", "mcp_tool_error", "other"];
function sanitizeText(s) {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}
function bracketFree(s) {
  let out = s;
  for (let i = 0; i < 3; i++) out = out.replace(/\((?:[^()\n]|\([^()\n]*\))*\)/g, "(\u2026)");
  return out.replace(/（[^）\n]*）/g, "\uFF08\u2026\uFF09").replace(/「[^」\n]*」/g, "\u300C\u2026\u300D");
}
var LIST_ITEMS_RE = /[、,，/・]|\d|<(?:path|file|hex|id|uuid)>/;
var PAREN_REASON_MAX = 30;
var ID_OR_NUMBER_RE = /\b(?:[A-Z][A-Z0-9]*(?:-[A-Za-z0-9]+)*|[a-z][a-z0-9]*(?:-[a-z0-9]+)+|(?:cp|utf-?|UTF-?|iso-?)\d+)\b|\d+(?:\.\d+)*/g;
function norm(s) {
  return String(s).replace(/[A-Za-z]:[\\/][^\s"'`)\]}>,;]*/g, "<path>").replace(/(^|[\s"'(=])(\/|~\/|\.\.?\/)[^\s"'`)\]}>,;]*/g, "$1<path>").replace(/\b[\w.-]+\.(ts|mjs|js|cjs|json|md|py|ps1|jsonl|txt|css|html|yml|yaml|sh|log)\b/g, "<file>").replace(/toolu_[A-Za-z0-9]+/g, "<toolu>").replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>").replace(/\b[0-9a-f]{7,}\b/gi, "<hex>").replace(/\b[a-z]{1,3}[0-9][a-z0-9]{6,}\b/gi, "<id>").replace(/（([^）\n]*)）/g, (all, inner) => LIST_ITEMS_RE.test(inner) || inner.length > PAREN_REASON_MAX ? "\uFF08<list>\uFF09" : all).replace(/"[^"\n]{25,}"/g, '"<str>"').replace(/「[^」\n]{12,}」/g, "\u300C<str>\u300D").replace(ID_OR_NUMBER_RE, (token) => /^\d/.test(token) ? "N" : token).replace(/\s+/g, " ").trim().slice(0, 160);
}
function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((b) => typeof b?.text === "string" ? b.text : "").join("\n");
  return content == null ? "" : JSON.stringify(content);
}
function firstLine(t) {
  return (t.split("\n").find((l) => l.trim()) || "").trim();
}
var HEREDOC_RE = /<<-?\s*['"]?(\w+)['"]?([^\n]*)\n[\s\S]*?\n\s*\1[ \t]*(?=\n|$)/g;
var MEMO_MAX = 4e3;
var splitMemo = /* @__PURE__ */ new Map();
var bodyMemo = /* @__PURE__ */ new Map();
function memo(cache, key, make) {
  const hit = cache.get(key);
  if (hit !== void 0) return hit;
  const value = make();
  if (cache.size >= MEMO_MAX) cache.clear();
  cache.set(key, value);
  return value;
}
function splitCommand(cmd, tool = "Bash") {
  return memo(splitMemo, `${tool}|${cmd}`, () => splitUncached(cmd, tool));
}
function splitUncached(cmd, tool) {
  const pwsh = toolDialect(tool) === "powershell";
  const flat = pwsh ? cmd.replace(/`\r?\n/g, " ") : cmd.replace(HEREDOC_RE, "<<$1$2");
  const escape = pwsh ? "`" : "\\";
  const out = [];
  let cur = "";
  let sep = "";
  let quote = null;
  let depth = 0;
  const push = (next) => {
    const t = cur.trim();
    cur = "";
    if (!t) return;
    if (!t.startsWith("#")) out.push({ text: t, sep });
    sep = next;
  };
  for (let i = 0; i < flat.length; i++) {
    const c = flat[i];
    if (quote) {
      cur += c;
      if (c === escape && quote === '"' && i + 1 < flat.length) {
        cur += flat[++i];
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || !pwsh && c === "`") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === escape && i + 1 < flat.length) {
      cur += c + flat[++i];
      continue;
    }
    if (c === "$" && flat[i + 1] === "(") {
      depth++;
      cur += "$(";
      i++;
      continue;
    }
    if (depth > 0) {
      if (c === "(") depth++;
      else if (c === ")") depth--;
      cur += c;
      continue;
    }
    const two = flat.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      push(two);
      i++;
      continue;
    }
    if (c === ";" || c === "\n") {
      push(c);
      continue;
    }
    if (c === "|" && flat[i - 1] !== ">") {
      push("|");
      continue;
    }
    if (pwsh && c === "{") {
      if (flat[i - 1] === "$" || flat[i - 1] === "@") {
        let d = 1;
        cur += c;
        while (++i < flat.length && d > 0) {
          if (flat[i] === "{") d++;
          else if (flat[i] === "}") d--;
          cur += flat[i];
        }
        i--;
        continue;
      }
      push(";");
      continue;
    }
    if (pwsh && c === "}") {
      push(";");
      continue;
    }
    cur += c;
  }
  push("");
  return out;
}
var KEYWORD_PREFIX_RE = /^(?:(?:do|then|else|elif|elseif|if|while|until|!|time|exec|nohup|function\s+[\w-]+(?:\s*\(\))?)\s+|timeout\s+(?:-\S+\s+)*\S+\s+|[A-Za-z_][\w-]*\s*\(\)\s*|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\$\([^)]*\)|(?!\$\()[^\s"']*)\s+|&\s*|[({]\s*)+/;
var ASSIGN_SUBST_RE = /^[A-Za-z_]\w*=["']?\$\(([\s\S]*)\)["']?$/;
var PS_ASSIGN_RE = /^\$[\w:]+\s*=\s*([\s\S]+)$/;
var FIND_EXEC_RE = /^find\b[^]*?\s-exec(?:dir)?\s+(.+?)\s+(?:\{\}\s*)?(?:\\;|';'|"\;"|\+)\s*$/;
var NOT_A_PROGRAM_RE = /^(?:done|fi|esac|do|then|else|\}|\)|\{|\(|\[|\[\[|test|for|foreach|try|catch|finally|switch|case|in|cd|pushd|popd|export|set|unset|local|Set-Location|exit|return|true|false|break|continue|:)$/;
var ECHO_PROGRAMS = /* @__PURE__ */ new Set(["echo", "printf", "Write-Output", "Write-Host", "write-output", "write-host"]);
var TRANSPARENT_FILTERS = /* @__PURE__ */ new Set(["head", "tail", "cut", "sort", "uniq", "tee", "cat", "more", "less", "wc", "tr", "column", "nl", "iconv"]);
var CONTENT_DUMPERS = /* @__PURE__ */ new Set(["grep", "rg", "egrep", "fgrep", "cat", "sed", "head", "tail", "awk", "less", "more", "type", "ls", "find", "wc", "sort", "uniq", "cut", "tr", "jq", "nl", "diff", "echo", "printf", "stat", "file", "du", "tree", "Get-Content", "Select-String", "findstr", "Get-ChildItem", "Get-Item", "Select-Object", "Format-List", "Format-Table", "Out-String", "Measure-Object", "Write-Output", "Write-Host", "Test-Path"]);
var CONTENT_DUMP_SUBCOMMANDS = /^git\s+(?:-C\s+\S+\s+)?(?:show|log|diff|grep|blame|cat-file|ls-files|status|branch|worktree\s+list|rev-parse|remote\s+-v)\b/;
var PREDICATE_WORDS = /* @__PURE__ */ new Set(["grep", "egrep", "fgrep", "rg", "cmp", "diff", "which", "where", "command", "type", "pgrep", "ls", "stat", "find", "Test-Path", "Select-String", "findstr"]);
var PREDICATE_GIT_RE = /^git\s+(?:-C\s+\S+\s+)?(?:merge-base\s+--is-ancestor|diff\b[^|;&]*--(?:quiet|exit-code)|rev-parse\b[^|;&]*--verify|show-ref|check-ignore|ls-files\b[^|;&]*--error-unmatch|cat-file\s+-e|ls-remote\b[^|;&]*--exit-code)/;
var INLINE_READ_RE = /readFileSync|readdirSync|\bopen\(|read_text|readlines|json\.load|Get-Content/;
var INLINE_ACT_RE = /writeFileSync|appendFileSync|\.write\(|spawn|exec(?:Sync|File)?\(|subprocess|os\.system|unlink|rmSync|mkdirSync|import\s*\(|from\s+["']\.|require\(["']\.|\bimport\s+\w+\s+from/;
var isCmdlet = (word) => /^[A-Z][a-z]+-[A-Z][A-Za-z]+$/.test(word);
function closerCount(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}
function stripPrefix(seg) {
  let body = seg.trim().replace(KEYWORD_PREFIX_RE, "").trim();
  for (const [close, open] of [[")", "("], ["}", "{"]]) while (body.endsWith(close) && closerCount(body, close) > closerCount(body, open)) body = body.slice(0, -1).trimEnd();
  return body;
}
function segmentBody(seg) {
  return memo(bodyMemo, seg, () => {
    const body = stripPrefix(seg);
    const sub = ASSIGN_SUBST_RE.exec(body) ?? PS_ASSIGN_RE.exec(body) ?? FIND_EXEC_RE.exec(body);
    return sub ? stripPrefix(sub[1]) : body;
  });
}
var rawWord = (seg) => (segmentBody(seg).match(/"[^"]*"|'[^']*'|\S+/) || [""])[0];
function segmentWord(seg) {
  return path.basename(rawWord(seg).replace(/^["']|["']$/g, "")).replace(/\.exe$/i, "");
}
var isEchoSegment = (seg, tool) => ECHO_PROGRAMS.has(segmentWord(seg)) || toolDialect(tool) === "powershell" && /^["']/.test(segmentBody(seg));
function isProgramSegment(seg, tool = "Bash") {
  const body = segmentBody(seg);
  if (!body || /^[A-Za-z_][A-Za-z0-9_]*=/.test(body)) return false;
  if (toolDialect(tool) === "powershell" && /^["']/.test(body)) return false;
  const raw = rawWord(seg).replace(/^["']|["']$/g, "");
  if (!raw || /^[$(\d-]/.test(raw)) return false;
  return !NOT_A_PROGRAM_RE.test(segmentWord(seg));
}
var programIndexes = (segs, tool) => segs.map((_, i) => i).filter((i) => isProgramSegment(segs[i].text, tool) && !isEchoSegment(segs[i].text, tool));
var GIT_WRITE_RE = /^git\s+(?:-C\s+\S+\s+)?(?:branch\b[^|;&]*\s(?:-[dDmMcC]\b|--delete|--move|--copy|--set-upstream\S*|-u\b)|worktree\s+(?:add|remove|prune|move)|remote\s+(?:add|remove|rename|set-url)|stash\s+(?:drop|pop|push|apply|clear))/;
function writesOrRuns(word, body) {
  if (/[<>]\(/.test(body)) return true;
  if (word === "git") return GIT_WRITE_RE.test(body);
  if (word === "sed") return /\s(?:-i\S*|--in-place)/.test(body);
  if (word === "find") return /\s-(?:exec|execdir|delete|ok|okdir|fprint\w*)\b/.test(body);
  if (word === "sort") return /\s(?:-o|--output)\b/.test(body);
  if (word === "awk") return /-i\s+inplace/.test(body);
  return false;
}
var isPredicateOrRead = (seg) => {
  const word = segmentWord(seg);
  const body = segmentBody(seg);
  if (writesOrRuns(word, body)) return false;
  return PREDICATE_WORDS.has(word) || CONTENT_DUMPERS.has(word) || PREDICATE_GIT_RE.test(body) || CONTENT_DUMP_SUBCOMMANDS.test(body);
};
var COMPARE_PROGRAMS = /* @__PURE__ */ new Set(["diff", "cmp"]);
var STATUS_TOKEN_RE = /^\$\{?(\?|PIPESTATUS\[(\d+)\]|LASTEXITCODE|env:LASTEXITCODE)\}?$/;
function statusOwnerBefore(segs, i, ref, pipeIndex, tool) {
  if (ref === "LASTEXITCODE" || ref === "env:LASTEXITCODE") {
    for (let k = i - 1; k >= 0; k--) if (isProgramSegment(segs[k].text, tool) && !isCmdlet(segmentWord(segs[k].text)) && !isEchoSegment(segs[k].text, tool)) return k;
    return void 0;
  }
  if (/^else\b/.test(segs[i].text)) {
    for (let k = i - 1; k >= 0; k--) if (/^(?:if|elif)\s/.test(segs[k].text)) return k;
    return void 0;
  }
  let end = i - 1;
  if (segs[i].sep === "||") while (end > 0 && isEchoSegment(segs[end].text, tool) && segs[end].sep === "&&") end--;
  if (end < 0) return void 0;
  let start = end;
  while (start > 0 && segs[start].sep === "|") start--;
  if (pipeIndex !== void 0) {
    const k = start + Number(pipeIndex);
    return k <= end ? k : void 0;
  }
  for (let k = end; k >= start; k--) {
    const w = segmentWord(segs[k].text);
    if (k > start && (TRANSPARENT_FILTERS.has(w) || toolDialect(tool) === "powershell" && isCmdlet(w))) continue;
    return k;
  }
  return end;
}
var ECHO_TOKEN_RE = /\$\{[^}]*\}|\$\([^)]*\)|\$(?:env:)?[A-Za-z_]\w*(?:\[\d+\])?|\$\?|["']|\s+|[^$"'\s]+|\$/g;
var LOOP_VAR_RE = /^(?:for\s+([A-Za-z_]\w*)\s+in\b|foreach\s*\(\s*\$([A-Za-z_]\w*)\s+in\b)/;
function statusEchoes(cmd, tool, segs = splitCommand(cmd, tool)) {
  const vars = /* @__PURE__ */ new Map();
  const out = [];
  const loopNames = new Set(segs.map((s) => {
    const m = LOOP_VAR_RE.exec(stripPrefix(s.text));
    return m?.[1] ?? m?.[2];
  }).filter((n) => !!n));
  const generatedBefore = (k) => segs.slice(0, k).some((s) => isProgramSegment(s.text, tool) && !isEchoSegment(s.text, tool) && !isPredicateOrRead(s.text) && !LIGHT_PROGRAMS.has(segmentWord(s.text)));
  const comparison = (k) => COMPARE_PROGRAMS.has(segmentWord(segs[k].text)) && generatedBefore(k);
  const valid = (k) => k !== void 0 && isProgramSegment(segs[k].text, tool) && !isEchoSegment(segs[k].text, tool) && (!isPredicateOrRead(segs[k].text) || comparison(k)) ? k : void 0;
  segs.forEach((s, i) => {
    const plain = stripPrefix(s.text);
    const assign = /^\$?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']?\$\{?(\?|PIPESTATUS\[(\d+)\]|LASTEXITCODE|env:LASTEXITCODE)\}?["']?\s*$/.exec(plain);
    if (assign) {
      vars.set(assign[1], valid(statusOwnerBefore(segs, i, assign[2].replace(/\[\d+\]$/, ""), assign[3], tool)));
      return;
    }
    if (!isEchoSegment(s.text, tool)) return;
    const body = segmentBody(s.text);
    const args = /^["']/.test(body) ? body : body.replace(/^\S+\s*(?:-[neE]+\s+)*/, "");
    const parts = [];
    const owners = [];
    const loopVars = [];
    let literal = false;
    for (const tok of args.match(ECHO_TOKEN_RE) ?? []) {
      if (tok === '"' || tok === "'") continue;
      if (/^\s+$/.test(tok)) {
        parts.push("\\s+");
        continue;
      }
      const st = STATUS_TOKEN_RE.exec(tok);
      const name = /^\$\{?([A-Za-z_]\w*)\}?$/.exec(tok)?.[1];
      if (st) {
        parts.push("(-?\\d+)");
        owners.push(valid(statusOwnerBefore(segs, i, st[1].replace(/\[\d+\]$/, ""), st[2], tool)));
        loopVars.push(void 0);
        continue;
      }
      if (name !== void 0 && vars.has(name)) {
        parts.push("(-?\\d+)");
        owners.push(vars.get(name));
        loopVars.push(void 0);
        continue;
      }
      if (name !== void 0 && loopNames.has(name)) {
        parts.push("(.*?)");
        owners.push(void 0);
        loopVars.push(name);
        continue;
      }
      if (tok.startsWith("$")) {
        parts.push(".*?");
        continue;
      }
      parts.push(escapeRegExp(tok));
      literal = true;
    }
    if (!owners.some((o, g) => o !== void 0 || loopVars[g] === void 0)) return;
    const bare = !literal;
    if (bare && segs.slice(i + 1).some((x) => isProgramSegment(x.text, tool) || isEchoSegment(x.text, tool))) return;
    out.push({ re: new RegExp(`^\\s*${parts.join("").replace(/(?:\\s\+)+/g, "\\s+")}\\s*$`), owners, loopVars, bare });
  });
  return out;
}
function substituteLoopValues(text, values) {
  return text.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (all, name) => values[name] ?? all);
}
function printedStatuses(text, echoes) {
  const lines = text.split("\n");
  let last = lines.length - 1;
  while (last > 0 && !lines[last].trim()) last--;
  const failures = [];
  const echoLines = [];
  const seen = /* @__PURE__ */ new Set();
  lines.forEach((l, idx) => {
    for (const e of echoes) {
      if (e.bare && idx !== last) continue;
      const m = e.re.exec(l);
      if (!m) continue;
      echoLines.push(idx);
      const loopValues = {};
      e.loopVars.forEach((name, g) => {
        if (name !== void 0) loopValues[name] = m[g + 1];
      });
      e.owners.forEach((seg, g) => {
        const status = Number(m[g + 1]);
        const key = `${seg}|${JSON.stringify(loopValues)}`;
        if (seg === void 0 || e.loopVars[g] !== void 0 || status === 0 || seen.has(key)) return;
        seen.add(key);
        failures.push({ segment: seg, status, line: idx, loopValues });
      });
      break;
    }
  });
  return { failures, echoLines };
}
var SCRIPT_TOKEN_RE = /(?:^|[\s(;&|])((?:node|python3?|py|bash|sh|pwsh|powershell|deno|tsx|bun)(?:\.exe)?)(?:\s+-\S+)*\s+["']?([^\s"'<>|;&]*?([\w.-]+)\.(py|mjs|cjs|js|ts|sh|ps1))\b/g;
var SCRIPT_EXT_RE = /\.(?:py|mjs|cjs|js|ts|sh|ps1|exe)$/i;
var DIAGNOSTIC_LINE_RE = /^(?:[\w.-]+:\s+)?([\w.-]{2,60}):\s+\S/;
var PASS_WORD_RE = /\b(?:pass(?:ed|es)?|ok|success(?:ful)?|all passed|up to date)\b/i;
var FAIL_WORD_RE = /\b(?:fail|error|cannot|can't|not found|refus|denied|no such|invalid|unable|missing)|失敗|拒否|停止/i;
var GIT_LINE_SUBCOMMANDS = [
  [/\bpathspec\b/, ["rm", "add", "checkout", "restore", "mv", "reset", "commit", "stash"]],
  [/\bbranch\b/, ["branch", "checkout", "switch"]],
  [/\bworktree\b/, ["worktree"]],
  [/\bstash\b/, ["stash"]],
  [/\b(?:merge|conflict)\b/, ["merge", "pull"]],
  [/\brebase\b/, ["rebase", "pull"]],
  [/\b(?:refspec|remote|upstream)\b/, ["push", "fetch", "pull"]]
];
var PREFIX_EMITTERS = [
  [/^fatal:\s/, /^git$/, false],
  [/^error:\s.*\b(?:branch|worktree|pathspec|refspec|commit|merge|rebase|stash|HEAD|remote|tag|index|checkout|working tree)\b/i, /^git$/, false],
  [/^error:\s/, /^git$/, true],
  [/^error\[E\d+\]/, /^(?:cargo|rustc)$/, false],
  [/^error:\s/, /^(?:cargo|rustc)$/, true],
  [/^npm (?:ERR!|error)\s/, /^(?:npm|npx)$/, false],
  [/^(?:pnpm|yarn)\s*(?:ERR|error)/i, /^(?:pnpm|yarn)$/, false]
];
function scriptRef(segs, i) {
  const body = segmentBody(segs[i].text);
  const m = new RegExp(SCRIPT_TOKEN_RE.source).exec(` ${body}`);
  if (!m) return void 0;
  const parts = m[2].replace(/\\+/g, "/").replace(/^\.\//, "").split("/").filter(Boolean);
  const interp = m[1].replace(/\.exe$/i, "");
  if (parts.length >= 2) return `${interp} ${parts.slice(-2).join("/")}`;
  const cd = segs.slice(0, i).reverse().map((s) => /^(?:cd|pushd|Set-Location)\s+["']?([^"';&|]+?)["']?\s*$/.exec(stripPrefix(s.text))?.[1]).find(Boolean);
  return `${interp} ${cd ? path.basename(cd.replace(/\\+/g, "/")) : "."}/${parts[0]}`;
}
function programNames(segs, tool) {
  const names = /* @__PURE__ */ new Map();
  for (const i of programIndexes(segs, tool)) {
    const w = segmentWord(segs[i].text).replace(SCRIPT_EXT_RE, "");
    if (!names.has(w)) names.set(w, i);
    for (const m of ` ${segmentBody(segs[i].text)}`.matchAll(SCRIPT_TOKEN_RE)) if (!names.has(m[3])) names.set(m[3], i);
  }
  return names;
}
var MISSING_OUTCOME_RE = /No such file|cannot access|can't (?:read|open|stat|access)|cannot (?:open|stat|find)|not found|does not exist|no match|Is a directory|Not a directory/i;
function diagnosticProgram(text, cmd, tool = "Bash", segs = splitCommand(cmd, tool)) {
  const names = programNames(segs, tool);
  const progs = programIndexes(segs, tool);
  const emitter = (word, exclusive, line) => {
    const hits = progs.filter((i) => word.test(segmentWord(segs[i].text)));
    if (exclusive && progs.some((i) => !hits.includes(i) && !isPredicateOrRead(segs[i].text) && !TRANSPARENT_FILTERS.has(segmentWord(segs[i].text)))) return void 0;
    const writers = hits.filter((i) => !isPredicateOrRead(segs[i].text));
    if (hits.length === 1) return hits[0];
    if (writers.length === 1) return writers[0];
    const subs = GIT_LINE_SUBCOMMANDS.filter(([re]) => re.test(line)).flatMap(([, s]) => s);
    const named = (writers.length ? writers : hits).filter((i) => subs.includes(/^git\s+(?:-C\s+\S+\s+)?(\S+)/.exec(segmentBody(segs[i].text))?.[1] ?? ""));
    return named[0] ?? (subs.length ? void 0 : writers[0] ?? hits[0]);
  };
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (looksLikeCode(l) || PASS_WORD_RE.test(l) && !FAIL_WORD_RE.test(l)) continue;
    const lead = DIAGNOSTIC_LINE_RE.exec(l);
    const name = lead ? [lead[1], /^([\w.-]+):/.exec(l)?.[1] ?? ""].map((n) => n.replace(SCRIPT_EXT_RE, "")).find((n) => names.has(n) && !ECHO_PROGRAMS.has(n)) : void 0;
    let segment = name === void 0 ? void 0 : names.get(name);
    if (segment === void 0) {
      for (const [line, word, exclusive] of PREFIX_EMITTERS) if (line.test(l)) {
        segment = emitter(word, exclusive, l);
        if (segment !== void 0) break;
      }
    }
    if (segment === void 0) continue;
    if (isPredicateOrRead(segs[segment].text) && MISSING_OUTCOME_RE.test(l)) continue;
    return { segment, line: l };
  }
  return void 0;
}
var PY_FRAME_ERROR_RE = /^\s*File "<(?:stdin|string)>", line \d+[\s\S]*?^\s*([A-Z]\w*(?:Error|Exception)):/m;
function pythonFailureAt(text) {
  const tb = TRACEBACK_RE.exec(text);
  if (tb) return tb.index;
  const frame = PY_FRAME_ERROR_RE.exec(text);
  return frame ? frame.index : void 0;
}
var INTERPRETERS = /^(node|python|python3|py|bash|sh|pwsh|powershell|deno|tsx|ts-node|bun)$/i;
var OUTPUT_FILTERS = /* @__PURE__ */ new Set(["grep", "rg", "egrep", "fgrep", "sed", "awk", "cut", "findstr", "jq"]);
var SHELL_PARSE_RE = /^(?:\S*\/)?(?:bash|sh|zsh)(?:\.exe)?: (?:-c: )?line \d+: (?:unexpected EOF|syntax error near unexpected token)/m;
function attributeFailure(cmd, tool, text, fromOutput = false) {
  if (typeof cmd !== "string") return { owner: "cmd:?", attributed: true, heads: [] };
  const segs = splitCommand(cmd, tool);
  const progs = programIndexes(segs, tool);
  const keyAt = (i) => programKey(segmentBody(segs[i].text), true);
  const heads = progs.map(keyAt);
  const at = (i) => {
    const script = scriptRef(segs, i);
    return { owner: `cmd:${keyAt(i)}`, attributed: true, heads, ...script ? { script } : {} };
  };
  if (SHELL_PARSE_RE.test(text)) return { owner: "cmd:shell parse", attributed: true, heads };
  if (!progs.length) return { owner: `cmd:${programKey(cmd)}`, attributed: true, heads };
  const printed = printedStatuses(text, statusEchoes(cmd, tool, segs)).failures[0];
  if (printed) return at(printed.segment);
  const diag = diagnosticProgram(text, cmd, tool, segs);
  if (diag) return at(diag.segment);
  const transparent = (i) => {
    const w = segmentWord(segs[i].text);
    if (TRANSPARENT_FILTERS.has(w) || toolDialect(tool) === "powershell" && isCmdlet(w)) return true;
    return fromOutput && OUTPUT_FILTERS.has(w) && segs[i].sep === "|";
  };
  const working = progs.filter((i) => !transparent(i));
  if (working.length <= 1) return at(working[0] ?? progs[progs.length - 1]);
  const only = (re) => {
    const hits = working.filter((i) => re.test(segmentWord(segs[i].text)));
    return hits.length === 1 ? hits[0] : void 0;
  };
  const pick = (k) => k === void 0 ? void 0 : at(k);
  const found = (pythonFailureAt(text) !== void 0 ? pick(only(/^(python|python3|py)$/i)) : void 0) ?? (/^Node\.js v\d|\bERR_[A-Z_]{3,}\b|^\s+at .*\(node:|^\[eval\]/m.test(text) ? pick(only(/^node$/i)) : void 0);
  if (found) return found;
  const loop = segs.some((s) => /^(for|while|until|foreach)\b/.test(s.text)) ? "loop>" : "";
  return { owner: `chain:${loop}${keyAt(working[working.length - 1])}`, attributed: false, heads };
}
var LIGHT_PROGRAMS = /* @__PURE__ */ new Set([...CONTENT_DUMPERS, "cd", "mkdir", "rm", "cp", "mv", "touch", "ln", "chmod", "date", "pwd", "basename", "dirname", "realpath", "New-Item", "Remove-Item", "Copy-Item", "Move-Item", "Join-Path", "Split-Path", "Resolve-Path"]);
var WAIT_PROGRAMS = /^(?:sleep|Start-Sleep)$/i;
function slowOwner(cmd, tool) {
  if (typeof cmd !== "string") return { owner: "cmd:?", wait: false };
  const segs = splitCommand(cmd, tool);
  const progs = programIndexes(segs, tool);
  const sleeps = progs.filter((i) => WAIT_PROGRAMS.test(segmentWord(segs[i].text)));
  const heavy = progs.filter((i) => !LIGHT_PROGRAMS.has(segmentWord(segs[i].text)) && !sleeps.includes(i));
  const loop = segs.some((s) => /^(?:until|while|for)\b/.test(s.text));
  const longest = Math.max(0, ...sleeps.map((i) => Number(/(\d+)\s*$/.exec(segmentBody(segs[i].text).replace(/[smh]\s*$/, ""))?.[1] ?? 0)));
  if (sleeps.length && (loop || !heavy.length || longest >= WAIT_SLEEP_MIN_SEC)) return { owner: "wait", wait: true };
  const keyAt = (i) => programKey(segmentBody(segs[i].text), true);
  if (heavy.length === 1) return { owner: `cmd:${keyAt(heavy[0])}`, wait: false };
  if (!heavy.length) return { owner: `cmd:${progs.length ? keyAt(progs[0]) : programKey(cmd)}`, wait: false };
  const note = chainNote(heavy.map(keyAt));
  const classed = heavy.map((i) => ({ i, cls: heavyClass(segmentBody(segs[i].text)) })).filter((x) => x.cls);
  if (classed.length === 1) return { owner: `cmd:${keyAt(classed[0].i)}`, wait: false, uncertain: note };
  const classes = [...new Set(classed.map((x) => x.cls))].sort();
  const label = classes.length ? classes.map((c) => `${c} steps`).join(" + ") : [...new Set(heavy.map(keyAt))].slice(0, CHAIN_KEY_HEADS).join(" + ");
  return { owner: `chain:${label}`, wait: false, uncertain: note };
}
var CHAIN_KEY_HEADS = 2;
var WAIT_SLEEP_MIN_SEC = 30;
var SCRIPT_FILE_RE = /\.(?:m?js|cjs|ts|py|sh|ps1)$/;
var TEST_LIKE_NAME = /test|verify|check|spec/;
var BUILD_LIKE_NAME = /build|bundle|compile/;
var HEAVY_CLASSES = [
  ["package", /\b(?:npm|pnpm|yarn)\s+run\s+(?:package|release|publish|dist)\b|\b(?:npm|pnpm|yarn)\s+(?:pack|publish)\b|\bvsce\b|\bcargo\s+(?:package|publish)\b|\bmake\s+(?:package|dist|release)\b/],
  ["build", /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:build|compile|bundle)|\b(?:tsc|esbuild|webpack|vite|rollup)\b|\b(?:cargo|go)\s+build\b|^make(?:\s+(?:all|build))?\s*$/],
  ["test", /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?test|\b(?:jest|vitest|pytest|mocha|playwright)\b|\b(?:cargo|go)\s+test\b|\bmake\s+(?:test|check)\b/]
];
function heavyClass(body) {
  const named = HEAVY_CLASSES.find(([, re]) => re.test(body))?.[0];
  if (named) return named;
  const scripts = body.split(/\s+/).map((t) => path.basename(t.replace(/^["']|["']$/g, ""))).filter((t) => SCRIPT_FILE_RE.test(t));
  if (scripts.some((t) => TEST_LIKE_NAME.test(t))) return "test";
  if (scripts.some((t) => BUILD_LIKE_NAME.test(t))) return "build";
  return void 0;
}
var SINGLE_CALL = "single command";
function isInlineReader(cmd, seg) {
  const body = segmentBody(seg);
  if (!INTERPRETERS.test(segmentWord(seg)) || !/\s-(?:e|c|Command)\b|<<|\s-\s*$/.test(body)) return false;
  return INLINE_READ_RE.test(cmd) && !INLINE_ACT_RE.test(cmd);
}
var OWN_CODE_FRAME_RE = /File "<(?:string|stdin)>"/;
function isContentDump(cmd, tool = "Bash", inlineReaders = true) {
  const segs = splitCommand(cmd, tool);
  const progs = segs.filter((s) => isProgramSegment(s.text, tool));
  return progs.length > 0 && progs.every((s) => isPredicateOrRead(s.text) || isEchoSegment(s.text, tool) || inlineReaders && isInlineReader(cmd, s.text));
}
var CHAIN_HEADS_SHOWN = 6;
function chainNote(heads) {
  const shown = heads.slice(0, CHAIN_HEADS_SHOWN).join(" \u2192 ");
  return `chain not attributed: ${shown}${heads.length > CHAIN_HEADS_SHOWN ? ` \u2192 \u2026 (${heads.length})` : ""}`;
}
function commandClass(owner) {
  const key = owner.replace(/^(?:cmd|chain|tool):(?:loop>)?/, "");
  const [p, ...rest] = key.split(" ");
  if (INTERPRETERS.test(p)) return rest[0]?.startsWith("-") ? `${p} ${rest[0]}` : rest.length ? `${p} script` : p;
  return key;
}
function programKey(cmd, isSegment = false, tool = "Bash") {
  if (typeof cmd !== "string") return "?";
  if (!isSegment) {
    const segs = splitCommand(cmd, tool);
    const first = programIndexes(segs, tool)[0];
    return first === void 0 ? "?" : programKey(segmentBody(segs[first].text), true);
  }
  const toks = cmd.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/, "").replace(/^&\s*/, "").match(/"[^"]*"|'[^']*'|\S+/g) || [];
  if (!toks.length) return "?";
  const base = (t) => path.basename(t.replace(/^["']|["']$/g, "")).replace(/\.exe$/i, "");
  const p = base(toks[0] ?? "");
  const rest = toks.slice(1).filter((t) => !t.startsWith("-") && !/^[<>|]/.test(t) && !/^\d?>/.test(t));
  if (toks.some((t) => t.startsWith("<<")) && /^(node|python|python3|py|bash|sh|cat)$/i.test(p)) return `${p} -heredoc`;
  if (/^(npm|pnpm|yarn)$/.test(p) && /^run(-script)?$/.test(rest[0] ?? "") && rest[1]) return `${p} run ${rest[1]}`;
  if (["git", "npm", "npx", "gh", "pnpm", "yarn", "docker", "code", "vsce", "codex", "claude"].includes(p) && rest[0]) return `${p} ${base(rest[0])}`;
  if (/^(node|python|python3|py|bash|sh|pwsh|powershell)$/i.test(p)) {
    const script = rest.find((t) => !/^["']?-/.test(t));
    if (toks.includes("-e") || toks.includes("-c") || toks.includes("-Command")) return `${p} -inline`;
    return script ? `${p} ${base(script)}` : p;
  }
  return p;
}
var GREP_PREFIX_RE = /^(?:[\w./\\-]+:)?\d+[:-]\s?(?=\S)/;
var lineCore = (l) => l.trim().replace(ITEM_PREFIX_RE, "").replace(GREP_PREFIX_RE, "").trim();
var ITEM_PREFIX_RE = /^\[item: [^\]]+\]\s*/;
var PASS_LINE_RE = /^(?:PASS(?:ED)?\b|✔|✓|√|ok\b|OK\b|\[ok\]|\[PASS\])/;
var FAIL_LINE_RE = /^(?:FAIL(?:ED)?\b(?![\s:=]*0\b)|not ok\b|[✗✕✖×]\s|(?:[^\s:：]{1,20}[:：]\s*)?NG\b(?![\s:：=]*(?:0\b|none\b|なし)))/;
var ITEM_ID_RE = /^(?:[-*•]\s*)?([A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)+)\b/;
var ITEM_LOOKAHEAD = 3;
var FAIL_WORDS = 3;
var HINT_MATCH_CHARS = 60;
var ENV_MANGLED_ARGUMENT = "path argument arrived mangled";
var ESBUILD_ERROR_RE = /^[✘X]\s+\[ERROR\]\s+(.*)$/;
var FAIL_SUMMARY_RE = /^(?:Tests?|Test Suites|Suites?|test result)\b[^\n]*?\b[1-9]\d* fail(?:ed|ures?|ing)\b/im;
var DECISIVE_RE = /\b(?:refused|refusing|denied|rejected|not found|No such file|can't|cannot|could not|not recognized|unable to|aborted|blocked|unexpected EOF|syntax error near unexpected token|unknown (?:command|option))\b|拒否|中止|見つから/i;
var EXCEPTION_RE = /^[\w.]*(?:Error|Exception)\b(?:\s*\[[\w-]+\])?[:\s]|^Error \[?[A-Z_]+\]?:|^(?:error|fatal|FATAL|ERROR)(?:\[[\w-]+\])?:\s|\bERR_[A-Z][A-Z_]{2,}\b/;
var GENERIC_ERROR_RE = /\b(?:error|fatal|failed|failure|invalid|exception)\b|失敗/i;
var SUMMARY_LINE_RE = /^(?:RESULT\b|---|===|npm (?:ERR!|error) (?:code|path|command|A complete log|Lifecycle)|Command failed\b|Error: Build failed with\b|Exit code\b|exit(?:ed)?\s*(?:code)?\s*[=:]?\s*\d|.*\b(?:FAIL|failed)\s*[=:]?\s*\d+\s*(?:\/|$)|\s*at\s)/i;
var SYMBOL_LINE_RE = /^[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*:\s+\S/;
function isFailLine(line) {
  const core = lineCore(line);
  return FAIL_LINE_RE.test(core) || ESBUILD_ERROR_RE.test(core);
}
var SUCCESS_CODE_RE = /(?:^|_)(?:OK|PASS(?:ED)?|SUCCESS|DONE|CLEAN|READY)$/;
var CODE_LINE_RE = /^(?![A-Z0-9_]*_(?:OK|PASS(?:ED)?|SUCCESS|DONE|CLEAN|READY)\b)[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
var CODE_ONLY_LINE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;
var isFailureCode = (line) => CODE_ONLY_LINE_RE.test(line) && !SUCCESS_CODE_RE.test(line);
var CODE_LIKE_LINE_RE = /[,{\[(;]\s*$|:\s*(?:true|false|null|undefined|-?\d+(?:\.\d+)?|['"`{\[])\s*,?\s*$/;
var looksLikeCode = (line) => CODE_LIKE_LINE_RE.test(line.trim());
function reasonLine(lines) {
  const body = lines.map(lineCore).filter((l) => l && !PASS_LINE_RE.test(l));
  const nonSummary = body.filter((l) => !SUMMARY_LINE_RE.test(l) || FAIL_LINE_RE.test(l));
  const failAt = nonSummary.findIndex((l) => FAIL_LINE_RE.test(l) || ESBUILD_ERROR_RE.test(l));
  if (failAt >= 0) {
    const line = nonSummary[failAt];
    if (FAIL_LINE_RE.test(line) && !failId(line)) {
      const item = nonSummary.slice(failAt + 1, failAt + 1 + ITEM_LOOKAHEAD).map((l) => ITEM_ID_RE.exec(l)?.[1]).find(Boolean);
      if (item) return `[item: ${item}] ${line}`;
    }
    return line;
  }
  return [...nonSummary].reverse().find((l) => /^[\w.]*(?:Error|Exception)\b[:\s]/.test(l) && !/^Error:?\s*$/.test(l)) ?? nonSummary.find((l) => SYMBOL_LINE_RE.test(l)) ?? nonSummary.find((l) => DECISIVE_RE.test(l)) ?? nonSummary.find((l) => EXCEPTION_RE.test(l) && !CODE_LINE_RE.test(l)) ?? body.find((l) => CODE_LINE_RE.test(l)) ?? nonSummary.find((l) => GENERIC_ERROR_RE.test(l)) ?? body.find((l) => GENERIC_ERROR_RE.test(l) || DECISIVE_RE.test(l));
}
function exitSignature(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const code = (/^Exit code (\d+)/.exec(lines[0] || "") || [])[1] ?? "?";
  const err = reasonLine(lines.slice(1));
  return withHints(`exit ${code}: ${err ? norm(err) : "(no error line)"}`, text, err);
}
var MODULE_MISSING_RE = /MODULE_NOT_FOUND|Cannot find (?:module|package)|ModuleNotFoundError|No module named/;
var MISSING_PATH_LINE_RE = /FileNotFoundError|ENOENT|No such file|can't open file|cannot open|cannot access|WindowsPath\(/;
var PATH_SHAPES = [
  /can't open file '([^'\n]+)'/,
  /No such file or directory:\s*'([^'\n]+)'/,
  /WindowsPath\('([^'\n]+)'\)/,
  /ENOENT[^'\n]*'([^'\n]+)'/,
  /cannot (?:access|open|stat) '([^'\n]+)'/,
  /(?:^|\s)'([^'\n]+)': No such file/
];
function moduleKind(text) {
  if (!MODULE_MISSING_RE.test(text)) return void 0;
  if (/Cannot find package|No module named/.test(text)) return "package";
  const target = /Cannot find module '([^']+)'|url: '([^']+)'/.exec(text);
  const p = (target?.[1] ?? target?.[2] ?? "").replace(/\\+/g, "/");
  if (/(?:^|\/)dist\//.test(p)) return "dist";
  if (!p) return "module";
  return /^(?:file:|\.|\/|[A-Za-z]:)/.test(p) ? "local file" : "package";
}
function pathKindOf(line) {
  if (!MISSING_PATH_LINE_RE.test(line)) return void 0;
  if (/\$'\\[0-7]{3}/.test(line)) return "non-ASCII name shown escaped";
  const shaped = PATH_SHAPES.map((re) => re.exec(line)?.[1]).find((x) => !!x);
  if (shaped === void 0) return void 0;
  const p = shaped.replace(/\\+/g, "/");
  if (/\uFFFD/.test(p)) return ENV_MANGLED_ARGUMENT;
  if (/^\/(?:tmp|[a-z])\//.test(p)) return "Git Bash path given to a Windows program";
  if (/^[A-Za-z]:\//.test(p)) return "absolute path missing";
  return "relative path missing";
}
function withHints(reason, text, rawLine) {
  const kind = moduleKind(text);
  if (kind) return `${reason} [missing: ${kind}]`;
  const targets = [norm(reason), norm(reason.replace(/^exit \S+:\s*/, ""))].map((t) => t.slice(0, HINT_MATCH_CHARS));
  const line = rawLine ?? text.split("\n").find((l) => MISSING_PATH_LINE_RE.test(l) && targets.includes(norm(lineCore(l)).slice(0, HINT_MATCH_CHARS)));
  const pathKind2 = line ? pathKindOf(line) : void 0;
  return pathKind2 ? `${reason} [path: ${pathKind2}]` : reason;
}
function reasonSignature(reason) {
  const missing = /\[missing: ([^\]]+)\]/.exec(reason)?.[1];
  const pathHint = /\[path: ([^\]]+)\]/.exec(reason)?.[1];
  const core = lineCore(reason);
  const esbuild = ESBUILD_ERROR_RE.exec(core);
  if (esbuild) return `esbuild: ${esbuild[1].split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 3).join(" ")}`;
  if (FAIL_LINE_RE.test(core)) {
    const id = /\[item: ([^\]]+)\]/.exec(reason)?.[1] ?? failId(core);
    return `FAIL ${id || failWords(core) || "line"}`;
  }
  const code = CODE_LINE_RE.exec(core)?.[0];
  if (code) return code;
  const named = /\b([A-Z][A-Za-z]*(?:Error|Exception))\b|\b(ERR_[A-Z][A-Z_]{2,})\b|\b([a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:error|failed|failure))\b/.exec(reason);
  if (named) return `${named[1] ?? named[2] ?? named[3]}${missing ? ` ${missing}` : pathHint ? ` ${pathHint}` : ""}`;
  return DECISIVE_RE.exec(reason)?.[0].toLowerCase();
}
var FAIL_MARKER_PREFIX_RE = /^(?:FAIL(?:ED)?|not ok(?:\s+[\dN]+)?|[✗✕✖×]|[^\s:：]{1,20}[:：]\s*NG|NG)\s*[:-]?\s*/;
function failId(core) {
  const token = (/^(\S+)/.exec(core.replace(FAIL_MARKER_PREFIX_RE, ""))?.[1] ?? "").replace(/[:,.;]+$/, "");
  return /[A-Za-z]/.test(token) && /^[\w./#-]+$/.test(token) && !/^[\dN.]+$/.test(token) ? token : "";
}
function failWords(core) {
  return core.replace(FAIL_MARKER_PREFIX_RE, "").split(/\s+/).filter((w) => /^[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/.test(w) && !/^N\W*$/.test(w)).slice(0, FAIL_WORDS).join(" ");
}
function failFamily(id) {
  return id.split(/[-_:]/)[0];
}
function retryKeys(input, tool) {
  const cmd = input?.command;
  const out = /* @__PURE__ */ new Set();
  if (typeof cmd !== "string") return out;
  const segs = splitCommand(cmd, tool);
  for (const i of programIndexes(segs, tool)) {
    if (isPredicateOrRead(segs[i].text)) continue;
    const body = segmentBody(segs[i].text);
    const script = new RegExp(SCRIPT_TOKEN_RE.source).exec(` ${body}`);
    if (script) out.add(`script:${script[1].replace(/\.exe$/i, "")} ${script[2].replace(/\\+/g, "/").toLowerCase()}`);
    else if (!/<</.test(body)) out.add(`cmd:${body.replace(/\s+/g, " ").slice(0, RETRY_KEY_CHARS)}`);
  }
  return out;
}
function classify(rawText, rec, use) {
  const text = stripToolUseErrorTags(rawText).trimStart();
  const tool = use?.name || "?";
  const failure = classifyToolFailure(text, use?.name, rec);
  const target = () => isShellTool(tool) ? programKey(use?.input?.command, false, tool) : tool;
  switch (failure.kind) {
    case "classifier_unavailable":
      return { kind: failure.kind, owner: "classifier:unavailable", detail: tool, sample: firstLine(text) };
    case "classifier_denial": {
      const reason = failure.reason ?? "?";
      return { kind: failure.kind, owner: "classifier", detail: norm(bracketFree(reason)).slice(0, 120), sample: reason };
    }
    case "safety_check":
      return { kind: failure.kind, owner: "claude-code", detail: `${tool} ${target()}: ${norm(firstLine(failure.message) || firstLine(text)).slice(0, PROMPT_DETAIL_CHARS)}`, sample: firstLine(text) };
    case "permission_prompt":
      return { kind: failure.kind, owner: "permission", detail: `${tool} ${target()}: ${norm(failure.prompt)}`, sample: firstLine(text) };
    case "user_rejected":
      return { kind: failure.kind, owner: "user", detail: tool, sample: firstLine(text) };
    case "hook_denial": {
      const body = hookReason(failure.body);
      return { kind: failure.kind, owner: "hook", detail: norm(bracketFree(body)).slice(0, 140), sample: body.slice(0, 400) };
    }
    case "nonzero_exit": {
      const eo = attributeFailure(use?.input?.command, tool, text);
      return { kind: failure.kind, owner: eo.owner, detail: exitSignature(text), sample: firstLine(text), ...eo.attributed ? {} : { uncertain: chainNote(eo.heads) }, ...eo.script ? { script: eo.script } : {} };
    }
  }
  const kind = failure.kind;
  if (/^\s*\{/.test(text)) {
    try {
      const j = JSON.parse(text);
      const code = j.error || j.code || (j.ok === false ? "ok:false" : null);
      if (code) return { kind, owner: `tool:${tool}`, detail: norm(`json ${String(code)}${j.requirement ? " " + String(j.requirement) : ""}`), sample: firstLine(text) };
    } catch {
    }
  }
  return { kind, owner: `tool:${tool}`, detail: norm(firstLine(text)), sample: firstLine(text) };
}
var MASKED_MARKERS_NEEDING_RETRY = /* @__PURE__ */ new Set(["error-line", "missing", "error-code", "result-failed", "powershell-error", "status-word"]);
var MASKED_SCAN_CHARS = 2e4;
var MASKED_TAIL_LINES = 5;
var MASKED_REASON_CHARS = 100;
var RETRY_KEY_CHARS = 300;
var BACKGROUNDED_RE = /did not complete within its \d+\s*s(?:econds)? timeout and was moved to the background/;
var ASYNC_HANDOFF_RE = /^(?:MCP tool "[^"]+" is still running after|Command running in background with ID)/;
var TRACEBACK_RE = /^Traceback \(most recent call last\)/m;
var ERROR_ID_SHAPE = "(?!(?:is|has|on|no)_)[a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:error|failed|failure)";
var ERROR_ID_FIELD_RE = new RegExp(`"(?:type|error|code|errorCode|error_code|status|reason|kind)"\\s*:\\s*"(${ERROR_ID_SHAPE})"`);
var ERROR_ID_TEXT_RE = new RegExp(`(?:^|[\\s\`'"(])(${ERROR_ID_SHAPE}):\\s`, "m");
var TEXT_MARKERS = [
  ["error-code", /\bERR_[A-Z][A-Z_]{2,}\b/],
  ["error-line", /^\s*(?:[A-Z]\w*(?:Error|Exception)|Error|error|fatal|FATAL|ERROR)(?:\s*\[[\w-]+\])?:\s/m],
  ["missing", /No such file or directory|can't (?:read|open|access)|cannot (?:open|access|find)|not recognized as|command not found|Cannot find module/],
  ["powershell-error", /FullyQualifiedErrorId\s*:\s*\S+/],
  ["json-failure", /"error"\s*:\s*"[^"]|"(?:status|result|verdict|candidate|outcome|state)"\s*:\s*"(?:fail|failed|failure|error)"/i],
  ["status-word", /^[\w .#/-]{1,40}:\s*(?:fail(?:ed|ure)?|error|NG)\b(?![\s:：=]*(?:0\b|none\b|なし))/im]
];
function maskedReason(text, fallback) {
  const lines = text.slice(0, MASKED_SCAN_CHARS).split("\n");
  return norm(reasonLine(lines) ?? fallback ?? firstLine(text)).slice(0, MASKED_REASON_CHARS);
}
function printedReason(lines, echoLines, at, keep) {
  const prev = Math.max(-1, ...echoLines.filter((n) => n < at));
  const next = Math.min(lines.length, ...echoLines.filter((n) => n > at));
  const pick = (a, b) => reasonLine(lines.slice(a, b).filter(keep));
  return pick(prev + 1, at) ?? pick(at + 1, next);
}
var RECORD_COMMAND_RE = new RegExp(`${IMPROVEMENT_TOOL_FILE.replace(/[.]/g, "\\.")}['"]?\\s+record\\b`);
function firstMatchNotCode(re, text) {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (let m = global.exec(text); m; m = global.exec(text)) {
    const at = m.index + m[0].length - m[0].trimStart().length;
    const line = text.slice(text.lastIndexOf("\n", at) + 1, (text.indexOf("\n", at) + 1 || text.length + 1) - 1);
    if (!looksLikeCode(line)) return m;
  }
  return null;
}
function maskedSignals(text, tool, input) {
  const t = text.slice(0, MASKED_SCAN_CHARS);
  return shellOrMcpSignals(t, tool, input).map((s) => ({ ...s, reason: withHints(s.reason, t) }));
}
function shellOrMcpSignals(t, tool, input) {
  if (ASYNC_HANDOFF_RE.test(t) || BACKGROUNDED_RE.test(t)) return [];
  if (isShellTool(tool)) {
    const cmd = input?.command;
    if (typeof cmd !== "string") return [];
    const segs = splitCommand(cmd, tool);
    const lines = t.split("\n");
    const { failures, echoLines } = printedStatuses(t, statusEchoes(cmd, tool, segs));
    if (failures.length) {
      const names = programNames(segs, tool);
      return failures.map((f) => {
        const resolved = segs.map((seg, k) => k === f.segment ? { ...seg, text: substituteLoopValues(seg.text, f.loopValues) } : seg);
        const ownerKey = programKey(segmentBody(resolved[f.segment].text), true);
        const otherDiagnostic = (l) => {
          const n = DIAGNOSTIC_LINE_RE.exec(l)?.[1]?.replace(SCRIPT_EXT_RE, "");
          return n !== void 0 && names.has(n) && names.get(n) !== f.segment;
        };
        const reason = printedReason(lines, echoLines, f.line, (l) => !otherDiagnostic(l));
        const script = scriptRef(resolved, f.segment);
        const statusLine = Object.values(f.loopValues).filter(Boolean).reduce((l, v) => l.replace(new RegExp(`(?<![\\w.-])${escapeRegExp(v)}(?![\\w.-])`, "g"), "<item>"), lines[f.line].trim());
        return { marker: "printed-status", owner: `cmd:${ownerKey}`, reason: norm(reason ?? statusLine).slice(0, MASKED_REASON_CHARS), ...script ? { script } : {} };
      });
    }
    const diag = diagnosticProgram(t, cmd, tool, segs);
    const diagSignal = (d) => {
      const script = scriptRef(segs, d.segment);
      return [{ marker: "program-diagnostic", owner: `cmd:${programKey(segmentBody(segs[d.segment].text), true)}`, reason: norm(d.line).slice(0, MASKED_REASON_CHARS), ...script ? { script } : {} }];
    };
    if (RECORD_COMMAND_RE.test(cmd)) return [];
    if (isContentDump(cmd, tool, false)) return diag ? diagSignal(diag) : [];
    const owned = (marker, reason, evidence = t) => {
      const a = attributeFailure(cmd, tool, evidence, true);
      return [{ marker, owner: a.owner, reason, ...a.attributed ? {} : { uncertain: chainNote(a.heads) }, ...a.script ? { script: a.script } : {} }];
    };
    const inlineReader = isContentDump(cmd, tool, true);
    const code = lines.map((l) => l.trim()).find(isFailureCode);
    const resultLine = lines.map((l) => l.trim()).find((l) => /^RESULT failed\b/.test(l)) ?? FAIL_SUMMARY_RE.exec(t)?.[0];
    const tail = lines.filter((l) => l.trim()).slice(-MASKED_TAIL_LINES).join("\n");
    const result = (evidence = t) => {
      const failing = evidence.split("\n").find(isFailLine);
      if (failing && resultLine) return owned("fail-line", norm(reasonLine(evidence.split("\n")) ?? lineCore(failing)).slice(0, MASKED_REASON_CHARS), evidence);
      return code && resultLine ? owned("result-code", code, evidence) : /^RESULT failed\b/m.test(tail) ? owned("result-failed", maskedReason(evidence), evidence) : [];
    };
    const tb = pythonFailureAt(t);
    if (tb !== void 0 && (!inlineReader || OWN_CODE_FRAME_RE.test(t.slice(tb)))) {
      const block = t.slice(tb).split("\n");
      const excAt = block.findIndex((l) => /^\s*[\w.]*(Error|Exception)\b/.test(l));
      const exc = excAt >= 0 ? block[excAt].trim() : "Traceback";
      const rest = `${t.slice(0, tb)}
${block.slice(excAt + 1).join("\n")}`;
      return [...owned("traceback", norm(exc).slice(0, MASKED_REASON_CHARS)), ...resultLine ? result(rest) : []];
    }
    if (inlineReader) return diag ? diagSignal(diag) : [];
    const failLine = lines.find(isFailLine);
    if (failLine) return owned("fail-line", norm(reasonLine(lines) ?? lineCore(failLine)).slice(0, MASKED_REASON_CHARS));
    const summary = FAIL_SUMMARY_RE.exec(t);
    if (summary) return code ? owned("result-code", code) : owned("fail-summary", norm(summary[0]).slice(0, MASKED_REASON_CHARS));
    if (diag) return diagSignal(diag);
    const fromResult = result();
    if (fromResult.length) return fromResult;
    for (const [marker, re] of TEXT_MARKERS) {
      const m = marker === "error-line" ? firstMatchNotCode(re, t) : re.exec(t);
      if (m) return owned(marker, norm(lines[t.slice(0, m.index + m[0].length - m[0].trimStart().length).split("\n").length - 1]).slice(0, MASKED_REASON_CHARS));
    }
    return [];
  }
  if (!tool.startsWith("mcp__")) return [];
  const owner = `tool:${tool}`;
  if (TRACEBACK_RE.test(t)) return [{ marker: "traceback", owner, reason: maskedReason(t) }];
  const json = /^\s*[[{]/.test(t);
  const id = ERROR_ID_FIELD_RE.exec(t) ?? (json ? null : ERROR_ID_TEXT_RE.exec(t));
  if (id) return [{ marker: "error-id", owner, reason: id[1] }];
  if (json) {
    try {
      const j = JSON.parse(t);
      if (j.ok === false || typeof j.error === "string" && j.error) return [{ marker: "mcp-json-failure", owner, reason: norm(`json ${String(j.error ?? j.code ?? "ok:false")}`) }];
    } catch {
    }
  }
  return [];
}
function taskNotifications(text) {
  const out = [];
  for (const m of text.matchAll(/<task-notification>([\s\S]*?)<\/task-notification>/g)) {
    const body = m[1];
    const field = (name) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body)?.[1]?.trim();
    const taskId = field("task-id");
    const toolUseId = field("tool-use-id");
    out.push({ status: field("status") ?? "", summary: field("summary") ?? "", result: field("result") ?? "", ...taskId ? { taskId } : {}, ...toolUseId ? { toolUseId } : {} });
  }
  return out;
}
function notificationKey(n) {
  return `${n.taskId ?? n.summary}|${n.status}`;
}
function notificationText(rec) {
  if (rec.type === "attachment" && rec.attachment?.type === "queued_command" && typeof rec.attachment.prompt === "string") return rec.attachment.prompt;
  if (rec.type !== "user") return "";
  const content = rec.message?.content;
  return typeof content === "string" ? content : Array.isArray(content) ? content.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n") : "";
}
function hookAttachment(rec) {
  const a = rec.type === "attachment" ? rec.attachment : void 0;
  if (!a || typeof a.type !== "string") return void 0;
  const base = { key: `${a.type}|${a.toolUseID ?? ""}|${a.hookName ?? ""}|${a.command ?? ""}`, hookName: String(a.hookName ?? a.hookEvent ?? "hook") };
  if (a.type === "hook_cancelled" && a.timedOut === true) {
    const detail = `hook timed out (limit ${Math.round(Number(a.timeoutMs ?? 0) / 1e3)} s)`;
    return { ...base, kind: "hook_failure", command: String(a.command ?? ""), detail: norm(detail), sample: detail };
  }
  if (a.type === "hook_non_blocking_error") {
    const first = firstLine(String(a.stderr ?? "")) || firstLine(String(a.stdout ?? ""));
    const detail = `hook failed (exit ${a.exitCode ?? "?"}): ${first}`;
    return { ...base, kind: "hook_failure", command: String(a.command ?? ""), detail: norm(detail).slice(0, 140), sample: detail.slice(0, 400) };
  }
  if (a.type === "hook_blocking_error") {
    const be = a.blockingError ?? {};
    const text = hookReason(String(be.blockingError ?? ""));
    return { ...base, kind: "hook_denial", command: String(be.command ?? a.command ?? ""), detail: norm(bracketFree(text)).slice(0, 140), sample: text.slice(0, 400) };
  }
  return void 0;
}
function notificationSignal(n, use) {
  const mcp = /^MCP task \S+ \(([\w-]+)\/([\w-]+)\)/.exec(n.summary);
  if (mcp) {
    const tool = `mcp__${mcp[1]}__${mcp[2]}`;
    if (n.status === "failed") return { tool, marker: "task-failed", owner: `tool:${tool}`, reason: maskedReason(n.result || n.summary) };
    const s = maskedSignals(n.result, tool, void 0)[0];
    return s ? { ...s, tool } : void 0;
  }
  if (/^Background command\b/.test(n.summary)) {
    const code = /exit code (\d+)/.exec(n.summary)?.[1];
    if (n.status !== "failed" && (!code || code === "0")) return void 0;
    const tool = use?.name ?? "Bash";
    const a = use ? attributeFailure(use.input?.command, tool, n.result) : { owner: "cmd:?", attributed: true, heads: [] };
    return { tool, marker: "background-exit", owner: a.owner, reason: `background command failed with exit code ${code ?? "?"}`, ...a.attributed ? {} : { uncertain: chainNote(a.heads) }, ...a.script ? { script: a.script } : {} };
  }
  return void 0;
}
var RECOVERY_WINDOW = 15;
var isTaskSwitch = (u) => u.name === "TaskCreate" || u.name === "TaskUpdate" && u.input?.status === "completed";
var EXPLORE_TOOLS = /* @__PURE__ */ new Set(["Read", "Grep", "Glob", "LS", "NotebookRead"]);
function useKeys(u) {
  if (u.keys) return u.keys;
  const input = u.input ?? {};
  u.keys = isShellTool(u.name) ? retryKeys(u.input, u.name) : FILE_TARGET_TOOL_SET.has(u.name) ? /* @__PURE__ */ new Set([`file:${String(input.file_path ?? input.notebook_path ?? "")}`]) : /* @__PURE__ */ new Set([`tool:${u.name}`]);
  return u.keys;
}
var isExploration = (u) => EXPLORE_TOOLS.has(u.name) || isShellTool(u.name) && typeof u.input?.command === "string" && isContentDump(u.input.command, u.name);
function measureRecovery(calls, failures) {
  for (const { pattern, idx } of failures) {
    const failed = calls[idx];
    if (!failed) continue;
    const keys = useKeys(failed);
    let explored = false;
    let recoveredAt = -1;
    for (let k = idx + 1; k < calls.length && k <= idx + RECOVERY_WINDOW; k++) {
      const u = calls[k];
      if (isTaskSwitch(u)) break;
      if (u.name === failed.name && u.outcome === "ok" && [...useKeys(u)].some((x) => keys.has(x))) {
        recoveredAt = k;
        break;
      }
      if (isExploration(u)) explored = true;
    }
    if (recoveredAt < 0) {
      pattern.unrecovered++;
      continue;
    }
    pattern.recovery.push(recoveredAt - idx);
    if (explored) pattern.recoveryExplored++;
  }
}
function recoveryNote(ps) {
  const calls = ps.flatMap((p) => p.recovery).sort((a, b) => a - b);
  const unrecovered = ps.reduce((n, p) => n + p.unrecovered, 0);
  const total2 = calls.length + unrecovered;
  if (!total2) return "";
  const at = (q) => calls[Math.min(calls.length - 1, Math.floor(q * calls.length))];
  const explored = ps.reduce((n, p) => n + p.recoveryExplored, 0);
  return calls.length ? ` \xB7 rec ${at(0.5)}/${at(0.75)}, expl ${Math.round(100 * explored / calls.length)}%, unrec ${unrecovered}/${total2}` : ` \xB7 unrec ${unrecovered}/${total2}`;
}
function similarity(a, b) {
  if (a === b) return 1;
  const n = Math.max(a.length, b.length);
  if (!n) return 1;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return (p + s) / n;
}
function dedupKeyOf(rec) {
  if (rec.type !== "user" && rec.type !== "assistant") return void 0;
  const trId = Array.isArray(rec.message?.content) ? rec.message.content.find((b) => b?.type === "tool_result")?.tool_use_id : void 0;
  return trId ? `tr:${trId}` : rec.forkedFrom?.messageUuid ?? rec.uuid;
}
var errorBlocks = (rec) => rec.type === "user" && Array.isArray(rec.message?.content) ? rec.message.content.filter((b) => b?.type === "tool_result" && b.is_error).length : 0;
var AGENT_PROMPT_SCAN_LINES = 5;
function isImprovementDelegation(text) {
  return isImprovementFirstMessage(text) || /^\s*Read \S+brief\.md and follow it\b/.test(text);
}
function isImprovementRecord(rec) {
  if (rec.type !== "user") return false;
  const content = rec.message?.content;
  const texts = typeof content === "string" ? [content] : Array.isArray(content) ? content.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text) : [];
  if (texts.some((t) => parseLaisoraInput(t)?.input.kind === "improvement" || isImprovementFirstMessage(t))) return true;
  return Array.isArray(content) && content.some((b) => b?.type === "tool_result" && !b.is_error && startsWithImprovementFirstMessage(textOf(b.content)));
}
async function* jsonLines(file, stats, limit = Infinity) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let lineNo = 0;
  try {
    for await (const line of rl) {
      lineNo++;
      if (lineNo > limit) break;
      if (!line.trim()) {
        yield { lineNo, rec: void 0 };
        continue;
      }
      if (line.length > IMPROVEMENT_LINE_MAX_CHARS) {
        stats.oversizedLines++;
        yield { lineNo, rec: void 0 };
        continue;
      }
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        stats.unparsable++;
      }
      yield { lineNo, rec: rec && typeof rec === "object" ? rec : void 0 };
    }
  } finally {
    rl.close();
  }
}
function forkMeta(full) {
  const m = readSubagentMetaSync(subagentMetaPathOf(full), (p) => fs.readFileSync(p, "utf8"));
  if (m === null) return { isFork: false };
  const forkLaunch = forkLaunchOf(m);
  return { isFork: m.isFork === true, ...forkLaunch === void 0 ? {} : { forkLaunch }, ...typeof m.parentAgentId === "string" ? { parentAgentId: m.parentAgentId } : {} };
}
function listTranscriptFiles(projectsDir) {
  const out = [];
  const dirents = (d) => {
    try {
      return fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return [];
    }
  };
  for (const project of dirents(projectsDir)) {
    if (!project.isDirectory()) continue;
    const pdir = path.join(projectsDir, project.name);
    for (const ent of dirents(pdir)) {
      const full = path.join(pdir, ent.name);
      if (ent.isFile() && ent.name.endsWith(".jsonl")) {
        const session = ent.name.replace(/\.jsonl$/, "");
        out.push({ full, session, label: "parent", ref: `${session.slice(0, 8)}:parent`, isFork: false });
      } else if (ent.isDirectory()) {
        const sub = path.join(full, SUBAGENTS_DIR_NAME);
        for (const f of dirents(sub)) {
          if (!f.isFile() || agentIdOfTranscriptName(f.name) === void 0) continue;
          const fileFull = path.join(sub, f.name);
          out.push({ full: fileFull, session: ent.name, label: f.name, ref: `${ent.name.slice(0, 8)}:${f.name.replace(/\.jsonl$/, "")}`, ...forkMeta(fileFull) });
        }
      }
    }
  }
  return out;
}
function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return void 0;
  }
}
function settingsHookScripts(json, projectDir, home) {
  const scripts = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if (k === "command" && typeof x === "string") scripts.push(...commandScripts(x, projectDir, home));
      else if (k === "args" && Array.isArray(x)) scripts.push(...argScripts(x, projectDir, home));
      else walk(x);
    }
  };
  walk(json?.hooks);
  return scripts;
}
var expandHookVars = (s, projectDir, home) => s.replace(/\$\{?CLAUDE_PROJECT_DIR\}?|%CLAUDE_PROJECT_DIR%/g, projectDir ?? "").replace(/\$\{?HOME\}?|%USERPROFILE%|\$env:USERPROFILE|(?<![\w.])~(?=[\\/])/g, home);
var SHELL_WORD_RE = /(?:"[^"]*"|'[^']*'|[^\s"'])+/g;
var GIT_BASH_DRIVE_RE = /^\/([A-Za-z])(?=\/|$)/;
var ROOT_RELATIVE_RE = /^[\\/](?![\\/])/;
function scriptPathOf(word, platform = process.platform) {
  const lib = platform === "win32" ? path.win32 : path.posix;
  const p = platform === "win32" ? word.replace(GIT_BASH_DRIVE_RE, "$1:") : word;
  return HOOK_SCRIPT_RE.test(p) && lib.isAbsolute(p) ? lib.normalize(p) : void 0;
}
var checkableScriptPath = (p, platform = process.platform) => platform !== "win32" || !ROOT_RELATIVE_RE.test(p);
function commandScripts(command, projectDir, home, platform = process.platform) {
  return (expandHookVars(command, projectDir, home).match(SHELL_WORD_RE) ?? []).map((w) => scriptPathOf(w.replace(/["']/g, ""), platform)).filter((p) => p !== void 0);
}
function argScripts(args, projectDir, home, platform = process.platform) {
  return args.filter((a) => typeof a === "string").map((a) => scriptPathOf(expandHookVars(a, projectDir, home), platform)).filter((p) => p !== void 0);
}
var TOOL_MATCHER_EVENTS = ["PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest", "PermissionDenied"];
var TOOL_NAME_TOKEN_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
var PROJECT_DIR_RE = /CLAUDE_PROJECT_DIR/;
var NON_IDENTIFYING_HOOK_FIELDS = /* @__PURE__ */ new Set(["timeout", "statusMessage"]);
function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
function hookIdentity(h) {
  return canonicalJson(Object.fromEntries(Object.entries(h).filter(([k]) => !NON_IDENTIFYING_HOOK_FIELDS.has(k))));
}
function hookContent(h) {
  const type = typeof h.type === "string" ? h.type : "command";
  const text = (k) => typeof h[k] === "string" ? h[k] : void 0;
  if (type === "command") return `${text("command") ?? ""}${Array.isArray(h.args) ? ` ${JSON.stringify(h.args)}` : ""}`;
  if (type === "http" && text("url")) return text("url");
  if ((type === "prompt" || type === "agent") && text("prompt")) return text("prompt");
  return canonicalJson(Object.fromEntries(Object.entries(h).filter(([k]) => k !== "type" && !NON_IDENTIFYING_HOOK_FIELDS.has(k))));
}
function registrationScripts(h, projectDir, home, platform = process.platform) {
  return h.type === "command" ? [...commandScripts(h.command, projectDir, home, platform), ...argScripts(h.args, projectDir, home, platform)] : [];
}
var registrationKey = (h) => `hook:${pathKey(h.settingsFile)}|${h.event}|${h.matcher}|${h.identity}`;
function hookRegistrations(json, settingsFile, projectDir, home, exists = fs.existsSync, platform = process.platform) {
  const hooks = json?.hooks;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) return [];
  const out = /* @__PURE__ */ new Map();
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      const matcher = typeof g?.matcher === "string" ? g.matcher : "";
      for (const h of Array.isArray(g?.hooks) ? g.hooks : []) {
        if (!h || typeof h !== "object" || Array.isArray(h)) continue;
        const type = typeof h.type === "string" ? h.type : "command";
        const command = type === "command" && typeof h.command === "string" ? h.command : "";
        const args = type === "command" && Array.isArray(h.args) ? h.args.filter((a) => typeof a === "string") : [];
        const base = {
          settingsFile,
          event,
          matcher,
          type,
          content: hookContent(h),
          identity: hookIdentity(h),
          ...typeof h.if === "string" ? { condition: h.if } : {},
          ...typeof h.shell === "string" ? { shell: h.shell } : {}
        };
        const key = registrationKey(base);
        const dup = out.get(key);
        if (dup) {
          dup.count++;
          continue;
        }
        const projectDependent = type === "command" && projectDir === void 0 && PROJECT_DIR_RE.test([command, ...args].join(" "));
        const paths = projectDependent ? [] : registrationScripts({ type, command, args }, projectDir, home, platform);
        const scripts = paths.filter((p) => checkableScriptPath(p, platform)).map((p) => ({ path: p, exists: exists(p) }));
        const uncheckedScripts = paths.filter((p) => !checkableScriptPath(p, platform));
        out.set(key, { id: "", ...base, command, args, scripts, uncheckedScripts, projectDependent, count: 1 });
      }
    }
  }
  return [...out.values()];
}
var EXACT_LIST_MATCHER_RE = /^[A-Za-z0-9_\-\s,|]*$/;
function matcherToolTokens(event, matcher) {
  if (!TOOL_MATCHER_EVENTS.includes(event)) return [];
  const parts = matcher.split(EXACT_LIST_MATCHER_RE.test(matcher) ? /[|,\s]+/ : "|");
  return [...new Set(parts.map((t) => t.trim()).filter((t) => TOOL_NAME_TOKEN_RE.test(t)))];
}
function matcherCoversTool(matcher, tool) {
  const m = matcher.trim();
  if (!m || m === "*") return true;
  if (EXACT_LIST_MATCHER_RE.test(m)) return m.split(/[|,\s]+/).includes(tool);
  try {
    return new RegExp(m).test(tool);
  } catch {
    return false;
  }
}
function hookCandidates(tools, registrations) {
  return tools.length ? registrations.filter((r) => r.event === HOOK_DENIAL_EVENT && tools.every((t) => matcherCoversTool(r.matcher, t))) : [];
}
var UNRESOLVED_OWNER = "unresolved";
var isUnresolvedOwner = (owner) => owner === UNRESOLVED_OWNER || owner.startsWith(`${UNRESOLVED_OWNER} [`);
function matcherLeads(registrations, seenToolNames) {
  const byToken = /* @__PURE__ */ new Map();
  for (const r of registrations) for (const t of matcherToolTokens(r.event, r.matcher)) if (!seenToolNames.has(t)) byToken.set(t, [...byToken.get(t) ?? [], r]);
  return [...byToken].sort(([a], [b]) => a.localeCompare(b)).map(([token, regs]) => ({ id: "", token, registrations: regs }));
}
function noteVersion(spans, version, at) {
  if (typeof version !== "string" || !version.trim()) return;
  const day = at?.slice(0, 10) ?? null;
  let s = spans.get(version);
  if (!s) spans.set(version, s = { version, records: 0, first: null, last: null });
  s.records++;
  if (day && (!s.first || day < s.first)) s.first = day;
  if (day && (!s.last || day > s.last)) s.last = day;
}
function versionSpans(spans) {
  return [...spans.values()].sort((a, b) => Number(a.first === null) - Number(b.first === null) || (a.first ?? "").localeCompare(b.first ?? "") || a.version.localeCompare(b.version, "en", { numeric: true }));
}
function firstTouchDates(gitLog) {
  const out = /* @__PURE__ */ new Map();
  for (const chunk of gitLog.split("\0")) {
    const lines = chunk.split(/\r?\n/);
    const date = lines[0].trim();
    if (!date) continue;
    for (const name of lines.slice(1)) if (name.trim()) out.set(name.trim(), date);
  }
  return out;
}
function gitTopOf(file, exists = fs.existsSync) {
  for (let dir = path.dirname(path.resolve(file)); ; dir = path.dirname(dir)) {
    if (exists(path.join(dir, ".git"))) return dir;
    if (path.dirname(dir) === dir) return void 0;
  }
}
var GIT_PATHS_PER_CALL = 100;
var GIT_LOG_TIMEOUT_MS = 3e4;
var GIT_LOG_MAX_BUFFER = 64 * 1024 * 1024;
var RULE_DIR_DEPTH = 4;
function gitFirstTouch(top, files) {
  const out = /* @__PURE__ */ new Map();
  const rel = files.map((f) => path.relative(top, f).replace(/\\/g, "/"));
  for (let i = 0; i < rel.length; i += GIT_PATHS_PER_CALL) {
    const r = spawnSync("git", ["-C", top, "--literal-pathspecs", "-c", "core.quotepath=false", "log", "--no-renames", "--format=%x00%aI", "--name-only", "--", ...rel.slice(i, i + GIT_PATHS_PER_CALL)], { encoding: "utf8", timeout: GIT_LOG_TIMEOUT_MS, maxBuffer: GIT_LOG_MAX_BUFFER, windowsHide: true });
    if (r.status !== 0 || typeof r.stdout !== "string") continue;
    for (const [name, date] of firstTouchDates(r.stdout)) out.set(pathKey(path.join(top, name)), date);
  }
  return out;
}
function markdownFilesUnder(dir, depth = RULE_DIR_DEPTH) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return ents.flatMap((e) => e.isDirectory() && depth > 0 ? markdownFilesUnder(path.join(dir, e.name), depth - 1) : e.isFile() && /\.md$/i.test(e.name) ? [path.join(dir, e.name)] : []);
}
function instructionFiles(configDir, cwds, exists = fs.existsSync) {
  const dirs = /* @__PURE__ */ new Map();
  for (const cwd of cwds) for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    if (dirs.has(pathKey(d))) break;
    dirs.set(pathKey(d), d);
    if (path.dirname(d) === d) break;
  }
  const out = /* @__PURE__ */ new Map();
  const add = (p, kind) => {
    if (!out.has(pathKey(p))) out.set(pathKey(p), { path: p, kind });
  };
  const claudeMd = (p) => {
    if (exists(p)) add(p, "CLAUDE.md");
  };
  claudeMd(path.join(configDir, "CLAUDE.md"));
  for (const p of markdownFilesUnder(path.join(configDir, "rules"))) add(p, "rule");
  for (const d of dirs.values()) {
    for (const name of ["CLAUDE.md", "CLAUDE.local.md", path.join(".claude", "CLAUDE.md")]) claudeMd(path.join(d, name));
    for (const p of markdownFilesUnder(path.join(d, ".claude", "rules"))) add(p, "rule");
  }
  return [...out.values()];
}
function fileMtime(p) {
  try {
    return fs.statSync(p).mtime.toISOString();
  } catch {
    return null;
  }
}
function fileAges(files) {
  const byTop = /* @__PURE__ */ new Map();
  for (const f of files) {
    const top = gitTopOf(f.path);
    if (top) byTop.set(top, [...byTop.get(top) ?? [], f.path]);
  }
  const dates = /* @__PURE__ */ new Map();
  for (const [top, list] of byTop) for (const [k, d] of gitFirstTouch(top, list)) dates.set(k, d);
  return files.map((f) => {
    const git = dates.get(pathKey(f.path));
    const mtime = git ? null : fileMtime(f.path);
    return { id: "", path: f.path, kind: f.kind, added: git ?? mtime, source: git ? "git" : mtime ? "mtime" : "unknown", ...f.registered !== void 0 ? { registered: f.registered } : {} };
  });
}
var CONSTANT_DECL_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/g;
var CONSTANT_REF_RE = /\$\{([A-Za-z_$][\w$]*)\}/g;
var CONSTANT_PASSES = 3;
function literalConstants(texts) {
  const raw = /* @__PURE__ */ new Map();
  for (const t of texts) for (const m of t.matchAll(CONSTANT_DECL_RE)) if (!m[2].includes("\n") && !raw.has(m[1])) raw.set(m[1], m[2].slice(1, -1));
  const resolved = /* @__PURE__ */ new Map();
  for (let pass = 0; pass < CONSTANT_PASSES; pass++) {
    for (const [name, value] of raw) {
      if (resolved.has(name)) continue;
      const expanded = value.replace(CONSTANT_REF_RE, (all, ref) => resolved.get(ref) ?? all);
      if (!expanded.includes("${") && !expanded.includes("`")) resolved.set(name, expanded);
    }
  }
  return resolved;
}
function expandConstants(text, constants) {
  return constants.size ? text.replace(CONSTANT_REF_RE, (all, ref) => constants.get(ref) ?? all) : text;
}
function discoverHookSources(configDir, cwds, laisoraSources = []) {
  const home = os.homedir();
  const scriptPaths = /* @__PURE__ */ new Set();
  const settingsFiles = [];
  const registrations = [];
  const registered = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  const projectDirs = [void 0, ...[...cwds].filter((d) => {
    const k = pathKey(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  })];
  for (const projectDir of projectDirs) {
    for (const file of claudeSettingsFiles(projectDir, configDir)) {
      if (!fs.existsSync(file)) continue;
      settingsFiles.push(file);
      const json = readJsonFile(file);
      for (const s of settingsHookScripts(json, projectDir, home)) scriptPaths.add(s);
      if (!registered.has(pathKey(file))) {
        registered.add(pathKey(file));
        registrations.push(...hookRegistrations(json, file, projectDir, home));
      }
    }
    const hooksDir = projectDir === void 0 ? path.join(configDir, "hooks") : path.join(projectDir, ".claude", "hooks");
    try {
      for (const f of fs.readdirSync(hooksDir, { withFileTypes: true })) if (f.isFile() && HOOK_SCRIPT_RE.test(f.name)) scriptPaths.add(path.join(hooksDir, f.name));
    } catch {
    }
  }
  const read = (p, max) => {
    try {
      return fs.statSync(p).size <= max ? fs.readFileSync(p, "utf8") : void 0;
    } catch {
      return void 0;
    }
  };
  const sources = [];
  const laisora = [];
  for (const p of laisoraSources) {
    const text = read(p, LAISORA_SOURCE_MAX_BYTES);
    if (text !== void 0) laisora.push({ path: p, text });
  }
  const constants = literalConstants(laisora.map((s) => s.text));
  for (const s of laisora) sources.push({ path: s.path, laisora: true, bundle: /\.[cm]?js$/i.test(s.path), text: expandConstants(s.text, constants) });
  const scriptKeys = /* @__PURE__ */ new Set();
  for (const p of [...scriptPaths].sort()) {
    if (scriptKeys.has(pathKey(p))) continue;
    scriptKeys.add(pathKey(p));
    const text = read(p, HOOK_SOURCE_MAX_BYTES);
    if (text !== void 0) sources.push({ path: p, laisora: false, bundle: false, text });
  }
  return { sources, settingsFiles, registrations };
}
function hookScriptFiles(registrations, sources, projectDirs, home = os.homedir()) {
  const named = /* @__PURE__ */ new Map();
  for (const r of registrations) for (const s of r.scripts) if (s.exists && !named.has(pathKey(s.path))) named.set(pathKey(s.path), s.path);
  const referenced = new Set(registrations.flatMap((r) => r.scripts.map((s) => pathKey(s.path))));
  const dirs = [...projectDirs];
  for (const r of registrations.filter((x) => x.projectDependent)) for (const d of dirs) for (const p of registrationScripts(r, d, home)) referenced.add(pathKey(p));
  const out = [...named.values()].map((p) => ({ path: p, kind: "hook script", registered: true }));
  for (const s of sources) {
    if (s.laisora || named.has(pathKey(s.path))) continue;
    named.set(pathKey(s.path), s.path);
    out.push({ path: s.path, kind: "hook script", registered: referenced.has(pathKey(s.path)) });
  }
  return out;
}
var pathKey = (p) => process.platform === "win32" ? path.normalize(p).toLowerCase() : path.normalize(p);
var HEAD_MAX = 80;
var HEADS_PER_REFUSAL = 12;
var isAscii = (s) => /^[\x20-\x7e]*$/.test(s);
var LITERAL_OPENERS = ['"', "'", "`"];
function sourceHeads(refusal) {
  const literal = refusalLiteral(refusal).slice(0, HEAD_MAX).trimEnd();
  const heads = /* @__PURE__ */ new Set([literal]);
  for (let i = literal.length - 1; i > 0; i--) if (literal[i] === " ") heads.add(literal.slice(0, i).trimEnd());
  if (!isAscii(literal)) for (const n of [48, 32, 24]) heads.add(literal.slice(0, n).trimEnd());
  return [...heads].filter((h) => h.length >= SOURCE_HEAD_MIN).sort((a, b) => b.length - a.length).slice(0, HEADS_PER_REFUSAL);
}
function sourceContainsHead(source, head) {
  if (!source.laisora) return source.text.includes(head);
  if (head.length < LAISORA_HEAD_MIN) return false;
  if (source.bundle && !isAscii(head)) return false;
  return LITERAL_OPENERS.some((q) => source.text.includes(q + head));
}
function hookCommandScript(refusal, cwd, home = os.homedir()) {
  const command = /^\[([^\]\n]{1,300})\]:/.exec(refusal)?.[1];
  if (command === void 0) return void 0;
  const script = projectHookScript(command, cwd, home) ?? command.match(/"[^"]+"|'[^']+'|\S+/g)?.map((t) => t.replace(/^["']|["']$/g, "")).find((t) => HOOK_SCRIPT_RE.test(t));
  return script === void 0 ? void 0 : path.normalize(script);
}
var projectScriptMemo = /* @__PURE__ */ new Map();
function projectHookScript(command, cwd, home = os.homedir(), exists = fs.existsSync) {
  const first = commandScripts(command, cwd, home)[0];
  if (!cwd || !/CLAUDE_PROJECT_DIR/.test(command)) return first;
  const key = `${command}|${cwd}`;
  if (projectScriptMemo.has(key)) return projectScriptMemo.get(key);
  let found;
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const candidate = commandScripts(command, dir, home)[0];
    if (candidate && exists(candidate)) {
      found = candidate;
      break;
    }
    if (path.dirname(dir) === dir) break;
  }
  const result = found ?? first;
  if (projectScriptMemo.size >= MEMO_MAX) projectScriptMemo.clear();
  projectScriptMemo.set(key, result);
  return result;
}
var SITE_STRONG_COVERAGE = 0.8;
var LITERAL_SCAN_MAX = 2e3;
var FRAGMENT_KEY_CHARS = 20;
var FRAGMENT_KEY_MIN = 4;
var REFUSAL_DYNAMIC_RE = /\d+|"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\([^)\n]*\)|（[^）\n]*）|「[^」\n]*」|<[^>\n]*>|\{[^}\n]*\}|\[[^\]\n]*\]/g;
var FIXED_CHAR_RE = /[A-Za-z぀-ヿ一-鿿]/g;
var refusalBody = (refusal) => refusal.replace(/^\[[^\]\n]{1,200}\]:?\s*/, "");
function refusalLiteral(refusal) {
  return /^[^0-9"'`(（「<{\\]+/.exec(refusalBody(refusal))?.[0] ?? "";
}
function literalFragments(text, start) {
  const q = text[start - 1];
  const template = q === "`";
  const quoted = template || q === '"' || q === "'";
  const frags = [""];
  const end = Math.min(text.length, start + LITERAL_SCAN_MAX);
  for (let i = start; i < end; i++) {
    const c = text[i];
    if (c === "\n" && !template) break;
    if (c === "\\") {
      frags[frags.length - 1] += text[i + 1] ?? "";
      i++;
      continue;
    }
    if (template && c === "$" && text[i + 1] === "{") {
      let depth = 1;
      for (i += 2; i < end && depth > 0; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
      }
      i--;
      frags.push("");
      continue;
    }
    if (quoted ? c === q : /["'`]/.test(c)) break;
    frags[frags.length - 1] += c;
  }
  return frags;
}
var fragmentKey = (f) => f.replace(/^[\s.,;:)(（）\][]+/, "").slice(0, FRAGMENT_KEY_CHARS).trimEnd();
function lineOf(text, at) {
  let line = 1;
  for (let i = text.indexOf("\n"); i >= 0 && i < at; i = text.indexOf("\n", i + 1)) line++;
  return line;
}
function sourceSite(pool, refusal) {
  const lit = refusalLiteral(refusal);
  if (!lit.trim()) return void 0;
  const rest = refusalBody(refusal).slice(lit.length);
  const restFixed = (rest.replace(REFUSAL_DYNAMIC_RE, "").match(FIXED_CHAR_RE) ?? []).length;
  const best = /* @__PURE__ */ new Map();
  for (const head of sourceHeads(refusal)) {
    for (const s of pool) {
      if (!sourceContainsHead(s, head)) continue;
      const starts = [];
      if (s.laisora) for (const q of LITERAL_OPENERS) for (let i = s.text.indexOf(q + head); i >= 0; i = s.text.indexOf(q + head, i + 1)) starts.push(i + 1);
      else for (let i = s.text.indexOf(head); i >= 0; i = s.text.indexOf(head, i + 1)) starts.push(i);
      for (const st of starts) {
        const frags = literalFragments(s.text, st);
        const first = frags[0];
        let common = 0;
        while (common < lit.length && common < first.length && lit[common] === first[common]) common++;
        const score = Math.min(1, common / lit.length, common / Math.max(first.length, 1));
        const later = frags.slice(1).map(fragmentKey).filter((k) => k.length >= FRAGMENT_KEY_MIN);
        const laterOk = later.length ? later.some((k) => rest.includes(k)) : restFixed < FRAGMENT_KEY_MIN;
        const eligible = score >= SITE_STRONG_COVERAGE && laterOk;
        const site = `${s.path}:${lineOf(s.text, st)}`;
        const prev = best.get(site);
        if (!prev || Number(eligible) - Number(prev.eligible) > 0 || eligible === prev.eligible && score > prev.score) best.set(site, { score, eligible });
      }
    }
    if (best.size) break;
  }
  const ranked = [...best].sort((a, b) => Number(b[1].eligible) - Number(a[1].eligible) || b[1].score - a[1].score);
  if (!ranked.length) return void 0;
  const strong = ranked[0][1].eligible && !ranked.slice(1).some(([, v]) => v.eligible);
  return { site: ranked[0][0], strong };
}
function resolveHookOwner(refusal, sources, cwd, home = os.homedir()) {
  const script = hookCommandScript(refusal, cwd, home);
  const withSite = (owner, list, pool) => {
    const s = sourceSite(pool, refusal);
    return s ? { owner, sources: list, site: s.site, siteStrong: s.strong } : { owner, sources: list };
  };
  if (script) return withSite(script, [script], sources.filter((s) => pathKey(s.path) === pathKey(script)));
  for (const head of sourceHeads(refusal)) {
    const hits = sources.filter((s) => sourceContainsHead(s, head));
    if (!hits.length) continue;
    const scripts = hits.filter((s) => !s.laisora);
    const ordered = [...scripts, ...hits.filter((s) => s.laisora)];
    return withSite(scripts.length ? scripts[0].path : "LAISORA", ordered.map((s) => s.path), ordered);
  }
  const tag = /^\[([\w.-]{2,60})\]/.exec(refusal)?.[1];
  if (tag) {
    const byName = sources.filter((s) => !s.laisora && path.basename(s.path).toLowerCase().includes(tag.toLowerCase()));
    if (byName.length) return { owner: byName[0].path, sources: byName.map((s) => s.path) };
    return { owner: `${UNRESOLVED_OWNER} [${tag}]`, sources: [] };
  }
  return { owner: UNRESOLVED_OWNER, sources: [] };
}
function newPattern(base, key) {
  return { id: "", key, kind: base.kind, owner: base.owner, detail: base.detail, sample: base.sample, ...base.uncertain ? { uncertain: base.uncertain } : {}, ...base.script ? { script: base.script } : {}, variants: /* @__PURE__ */ new Map(), durationsSec: [], backgrounded: 0, classifierChecked: 0, shapes: /* @__PURE__ */ new Map(), recovery: [], recoveryExplored: 0, unrecovered: 0, count: 0, sessions: /* @__PURE__ */ new Set(), retries: 0, retriesSame: 0, first: null, last: null, days: /* @__PURE__ */ new Map(), actors: { main: 0, subagent: 0 }, tools: /* @__PURE__ */ new Map(), locations: [] };
}
function bump(p, loc, session, variant) {
  p.count++;
  p.sessions.add(session);
  const date = loc.at ? loc.at.slice(0, 10) : null;
  if (variant !== void 0) {
    const v = p.variants.get(variant) ?? { count: 0, first: null, last: null };
    v.count++;
    if (date && (!v.first || date < v.first)) v.first = date;
    if (date && (!v.last || date > v.last)) v.last = date;
    p.variants.set(variant, v);
  }
  if (date && (!p.first || date < p.first)) p.first = date;
  if (date && (!p.last || date > p.last)) p.last = date;
  if (date) p.days.set(date, (p.days.get(date) ?? 0) + 1);
  p.actors[loc.actor]++;
  p.tools.set(loc.tool, (p.tools.get(loc.tool) ?? 0) + 1);
  p.locations.push(loc);
}
async function scanTranscripts(opts) {
  const now = opts.now ?? Date.now;
  const t0 = now();
  const stats = { parentFiles: 0, subagentFiles: 0, subagentForkFiles: 0, filesRead: 0, unreadableFiles: 0, bytes: 0, lines: 0, unparsable: 0, oversizedLines: 0, duplicateRecords: 0, toolResults: 0, errorResults: 0, excludedImprovementSessions: 0, excludedImprovementAgents: 0, firstDate: null, lastDate: null, runtimeSec: 0 };
  const fileList = listTranscriptFiles(opts.projectsDir);
  stats.parentFiles = fileList.filter((f) => f.label === "parent").length;
  stats.subagentFiles = fileList.length - stats.parentFiles;
  stats.subagentForkFiles = fileList.filter((f) => f.isFork).length;
  const excluded = /* @__PURE__ */ new Set();
  for (const f of fileList.filter((x) => x.label === "parent")) {
    try {
      for await (const { rec } of jsonLines(f.full, stats, IMPROVEMENT_MARKER_SCAN_LINES)) if (rec && isImprovementRecord(rec)) {
        excluded.add(f.session);
        break;
      }
    } catch {
    }
  }
  stats.excludedImprovementSessions = excluded.size;
  const previous = await earlierVerdicts(fileList.filter((f) => f.label === "parent" && excluded.has(f.session)));
  const excludedAgents = /* @__PURE__ */ new Set();
  const agentId = (f) => agentIdOfTranscriptName(f.label) ?? f.label;
  const subagents = fileList.filter((x) => x.label !== "parent" && !excluded.has(x.session));
  for (const f of subagents) {
    try {
      for await (const { rec } of jsonLines(f.full, stats, AGENT_PROMPT_SCAN_LINES)) {
        if (rec?.type !== "user") continue;
        if (isImprovementDelegation(notificationText(rec))) excludedAgents.add(`${f.session}|${agentId(f)}`);
        break;
      }
    } catch {
    }
  }
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of subagents) if (f.parentAgentId && excludedAgents.has(`${f.session}|${f.parentAgentId}`) && !excludedAgents.has(`${f.session}|${agentId(f)}`)) {
      excludedAgents.add(`${f.session}|${agentId(f)}`);
      grew = true;
    }
  }
  stats.excludedImprovementAgents = excludedAgents.size;
  const files = fileList.filter((f) => !excluded.has(f.session) && !(f.label !== "parent" && excludedAgents.has(`${f.session}|${agentId(f)}`)));
  stats.unparsable = 0;
  stats.oversizedLines = 0;
  const origin = /* @__PURE__ */ new Map();
  const credited = /* @__PURE__ */ new Set();
  const cwds = /* @__PURE__ */ new Set();
  const checks = files.map((_, i) => ({ i, raw: 0, credited: 0, creditedFromForkCopy: 0, readable: true }));
  const copiedLines = files.map((f) => {
    if (f.forkLaunch === void 0) return 0;
    try {
      return forkCopiedLineCount(fs.readFileSync(f.full, "utf8").split("\n"), f.forkLaunch).copied;
    } catch {
      return 0;
    }
  });
  const ownRecord = (i, lineNo, rec) => rec === void 0 || lineNo <= copiedLines[i] ? void 0 : withoutForkLaunchAnswer(rec, files[i].forkLaunch);
  const scratch = { ...stats };
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      for await (const { lineNo, rec: line } of jsonLines(f.full, scratch)) {
        const rec = ownRecord(i, lineNo, line);
        if (!rec || rec.forkedFrom) continue;
        if (typeof rec.cwd === "string" && cwds.size < 500) cwds.add(rec.cwd);
        const k = dedupKeyOf(rec);
        if (k !== void 0 && !origin.has(k)) origin.set(k, i);
        checks[i].raw += errorBlocks(rec);
      }
    } catch {
      checks[i].readable = false;
    }
  }
  const patterns = /* @__PURE__ */ new Map();
  const candidates = /* @__PURE__ */ new Map();
  const slow = /* @__PURE__ */ new Map();
  const waitCalls = { count: 0, sessions: /* @__PURE__ */ new Set() };
  const unansweredQuestions = Object.fromEntries(ASK_UNANSWERED_KINDS.map((kind) => [kind, 0]));
  const seenNotifications = /* @__PURE__ */ new Set();
  const seenHookEvents = /* @__PURE__ */ new Set();
  const countedResults = /* @__PURE__ */ new Set();
  const toolNames = /* @__PURE__ */ new Set();
  const versions = /* @__PURE__ */ new Map();
  const addCandidate = (sig, loc, session) => {
    const key = `${sig.marker} | ${sig.owner} | ${reasonSignature(sig.reason) ?? sig.reason.slice(0, SIGNATURE_CHARS)}`;
    const once = `${key} | ${loc.path} | ${loc.line}`;
    if (countedResults.has(once)) return void 0;
    countedResults.add(once);
    let p = candidates.get(key);
    if (!p) candidates.set(key, p = newPattern({ kind: "candidate", owner: sig.owner, detail: `${sig.marker}: ${sig.reason}`, sample: sig.reason, ...sig.uncertain ? { uncertain: sig.uncertain } : {}, ...sig.script ? { script: sig.script } : {} }, key));
    bump(p, loc, session, sig.reason);
    return p;
  };
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const actor = f.label === "parent" ? "main" : "subagent";
    const uses = /* @__PURE__ */ new Map();
    const useOrder = [];
    const pendingRetry = [];
    const pendingCandidate = [];
    let lastResultAt = null;
    const failures = [];
    const trackUse = (b, at) => {
      const u = { name: String(b.name), input: b.input, inp: JSON.stringify(b.input ?? {}).slice(0, 4e3), idx: useOrder.length, at };
      toolNames.add(u.name);
      uses.set(b.id, u);
      useOrder.push(u);
      return u;
    };
    try {
      stats.bytes += fs.statSync(f.full).size;
      for await (const { lineNo, rec: line } of jsonLines(f.full, stats)) {
        stats.lines++;
        if (line && lineNo <= copiedLines[i]) {
          if (dedupKeyOf(line) !== void 0) stats.duplicateRecords++;
          continue;
        }
        const rec = ownRecord(i, lineNo, line);
        if (!rec) continue;
        const dedupKey = dedupKeyOf(rec);
        const content = rec.message?.content;
        if (dedupKey) {
          const originFile = origin.get(dedupKey);
          const own = originFile === void 0 ? !credited.has(dedupKey) : originFile === i && !credited.has(dedupKey);
          if (!own) {
            stats.duplicateRecords++;
            if (rec.type === "assistant" && Array.isArray(content)) {
              for (const b of content) if (b?.type === "tool_use") trackUse(b, typeof rec.timestamp === "string" ? rec.timestamp : null);
            }
            continue;
          }
          credited.add(dedupKey);
        }
        const at = typeof rec.timestamp === "string" ? rec.timestamp : null;
        const day = at?.slice(0, 10) ?? null;
        if (day && (!stats.firstDate || day < stats.firstDate)) stats.firstDate = day;
        if (day && (!stats.lastDate || day > stats.lastDate)) stats.lastDate = day;
        noteVersion(versions, rec.version, at);
        if (rec.type === "assistant" && Array.isArray(content)) {
          for (const b of content) {
            if (b?.type !== "tool_use") continue;
            const u = trackUse(b, at);
            for (let k = pendingRetry.length - 1; k >= 0; k--) {
              const pr = pendingRetry[k];
              if (u.idx - pr.idx > IMPROVEMENT_RETRY_WINDOW) {
                pendingRetry.splice(k, 1);
                continue;
              }
              if (pr.name === u.name && similarity(pr.inp, u.inp) >= RETRY_SIM) {
                pr.pattern.retries++;
                if (pr.inp === u.inp) pr.pattern.retriesSame++;
                pendingRetry.splice(k, 1);
              }
            }
            let uKeys;
            for (let k = pendingCandidate.length - 1; k >= 0; k--) {
              const pc = pendingCandidate[k];
              if (u.idx - pc.idx > IMPROVEMENT_CANDIDATE_RETRY_WINDOW) {
                pendingCandidate.splice(k, 1);
                continue;
              }
              const sharesCommand = isShellTool(u.name) && [...uKeys ??= retryKeys(u.input, u.name)].some((key) => pc.keys.has(key));
              if (pc.name === u.name && (sharesCommand || similarity(pc.inp, u.inp) >= CANDIDATE_RETRY_SIM)) {
                const confirmed = addCandidate(pc.sig, pc.loc, f.session);
                if (confirmed) failures.push({ pattern: confirmed, idx: pc.idx });
                pendingCandidate.splice(k, 1);
              }
            }
          }
          continue;
        }
        const notes = notificationText(rec);
        if (notes.includes("<task-notification>")) {
          for (const n of taskNotifications(sanitizeText(notes))) {
            const key = notificationKey(n);
            if (seenNotifications.has(key)) continue;
            seenNotifications.add(key);
            const use = n.toolUseId ? uses.get(n.toolUseId) : void 0;
            const sig = notificationSignal(n, use);
            if (sig) addCandidate(sig, { path: f.full, ref: `${f.ref}:${lineNo}`, line: lineNo, at, actor, tool: sig.tool }, f.session);
          }
        }
        const hookEvent = hookAttachment(rec);
        if (hookEvent && !seenHookEvents.has(hookEvent.key)) {
          seenHookEvents.add(hookEvent.key);
          const script = projectHookScript(hookEvent.command, typeof rec.cwd === "string" ? rec.cwd : void 0);
          const c = { kind: hookEvent.kind, owner: script ?? (hookEvent.command || "hook"), detail: hookEvent.detail, sample: hookEvent.sample };
          const key = `${c.kind} | ${c.owner} | ${c.detail}`;
          let p = patterns.get(key);
          if (!p) patterns.set(key, p = { ...newPattern(c, key), ownerFixed: true });
          bump(p, { path: f.full, ref: `${f.ref}:${lineNo}`, line: lineNo, at, actor, tool: hookEvent.hookName }, f.session);
        }
        if (rec.type !== "user" || !Array.isArray(content)) continue;
        for (const b of content) {
          if (b?.type !== "tool_result") continue;
          stats.toolResults++;
          const text = sanitizeText(textOf(b.content));
          const use = uses.get(b.tool_use_id);
          const loc = { path: f.full, ref: `${f.ref}:${lineNo}`, line: lineNo, at, actor, tool: use?.name ?? "?" };
          if (use && isShellTool(use.name) && (!b.is_error || /^Exit code \d+/.test(text))) {
            const input = use.input ?? {};
            const start = use.at && lastResultAt && lastResultAt > use.at ? lastResultAt : use.at;
            const sec = start && at ? (Date.parse(at) - Date.parse(start)) / 1e3 : NaN;
            const backgrounded = BACKGROUNDED_RE.test(text.slice(0, MASKED_SCAN_CHARS));
            const so = input.run_in_background !== true && (backgrounded || sec >= SLOW_CALL_SEC) ? slowOwner(input.command, use.name) : void 0;
            if (so?.wait) {
              waitCalls.count++;
              waitCalls.sessions.add(f.session);
            } else if (so) {
              let p = slow.get(so.owner);
              if (!p) slow.set(so.owner, p = newPattern({ kind: "slow", owner: so.owner, detail: so.owner.replace(/^cmd:/, "").replace(/^chain:/, "chain: "), sample: typeof input.command === "string" ? input.command.slice(0, 200) : "" }, so.owner));
              bump(p, loc, f.session, so.uncertain ?? SINGLE_CALL);
              if (Number.isFinite(sec)) p.durationsSec.push(Math.round(sec));
              if (backgrounded) p.backgrounded++;
              if (rec.permissionDecision?.reasonType === "classifier") p.classifierChecked++;
            }
          }
          if (at && (!lastResultAt || at > lastResultAt)) lastResultAt = at;
          if (b.is_error) {
            stats.errorResults++;
            const c = classify(text, rec, use);
            const script = c.kind === "hook_denial" ? hookCommandScript(c.sample, typeof rec.cwd === "string" ? rec.cwd : void 0) : void 0;
            if (script) c.owner = script;
            const key = `${c.kind} | ${c.owner} | ${c.detail}`;
            let p = patterns.get(key);
            if (!p) patterns.set(key, p = { ...newPattern(c, key), ...script ? { ownerFixed: true } : {} });
            bump(p, loc, f.session);
            if (use) {
              use.outcome = "fail";
              failures.push({ pattern: p, idx: use.idx });
            }
            if (c.kind === "hook_denial" && use) {
              const shape = commandShape(use.name, use.input);
              const cur = p.shapes.get(shape);
              if (cur) cur.count++;
              else p.shapes.set(shape, { count: 1, ref: loc.ref });
            }
            if (rec.forkedFrom) checks[i].creditedFromForkCopy++;
            else checks[i].credited++;
            if (use) pendingRetry.push({ name: use.name, inp: use.inp, idx: use.idx, pattern: p });
          } else if (use) {
            if (use.name === "AskUserQuestion") for (const kind of askUnansweredQuestions(singleToolUseResult(content, rec.toolUseResult)).values()) unansweredQuestions[kind]++;
            const sigs = maskedSignals(text, use.name, use.input);
            use.outcome = sigs.length ? "fail" : "ok";
            for (const sig of sigs) {
              if (!MASKED_MARKERS_NEEDING_RETRY.has(sig.marker)) {
                const confirmed = addCandidate(sig, loc, f.session);
                if (confirmed) failures.push({ pattern: confirmed, idx: use.idx });
              } else pendingCandidate.push({ name: use.name, inp: use.inp, idx: use.idx, keys: retryKeys(use.input, use.name), sig, loc });
            }
          }
        }
      }
      measureRecovery(useOrder, failures);
      stats.filesRead++;
    } catch {
      stats.unreadableFiles++;
      checks[i].readable = false;
    }
  }
  const mismatches = checks.filter((c) => c.readable && c.raw !== c.credited).map((c) => ({ file: files[c.i].full, rawNonForkErrors: c.raw, credited: c.credited }));
  const selfCheck = {
    filesChecked: checks.filter((c) => c.readable).length,
    mismatchFiles: mismatches.length,
    rawNonForkErrors: checks.reduce((a, c) => a + c.raw, 0),
    creditedNonFork: checks.reduce((a, c) => a + c.credited, 0),
    creditedFromForkCopyWithoutOrigin: checks.reduce((a, c) => a + c.creditedFromForkCopy, 0),
    mismatches: mismatches.slice(0, 50)
  };
  const { sources, settingsFiles, registrations } = discoverHookSources(opts.configDir, cwds, opts.laisoraSources);
  const inventory = {
    hooks: registrations,
    matcherLeads: matcherLeads(registrations, toolNames),
    toolNamesSeen: toolNames.size,
    versions: versionSpans(versions),
    files: fileAges([...hookScriptFiles(registrations, sources, cwds), ...instructionFiles(opts.configDir, cwds)])
  };
  const byPriority = (a, b) => b.sessions.size - a.sessions.size || b.count - a.count;
  const pats = [...patterns.values()].sort(byPriority);
  const groups = /* @__PURE__ */ new Map();
  for (const p of pats.filter((x) => x.kind === "hook_denial" || x.kind === "hook_failure")) {
    const fixedSite = p.ownerFixed ? sourceSite(sources.filter((s) => pathKey(s.path) === pathKey(p.owner)), p.sample) : void 0;
    const r = p.ownerFixed ? { owner: p.owner, sources: [p.owner], ...fixedSite ? { site: fixedSite.site, siteStrong: fixedSite.strong } : {} } : resolveHookOwner(p.sample, sources);
    p.owner = r.owner;
    if (p.kind === "hook_denial" && isUnresolvedOwner(r.owner)) p.candidates = hookCandidates([...p.tools.keys()], registrations);
    if (r.site) {
      p.site = r.site;
      p.siteStrong = r.siteStrong === true;
    }
    let g = groups.get(r.owner);
    if (!g) groups.set(r.owner, g = { owner: r.owner, sources: /* @__PURE__ */ new Set(), patterns: [] });
    r.sources.forEach((s) => g.sources.add(s));
    g.patterns.push(p);
  }
  const hookGroups = [...groups.values()].map((g) => ({ id: "", owner: g.owner, sources: [...g.sources], patterns: g.patterns, gates: hookGates(g.patterns) })).sort((a, b) => b.patterns.reduce((n, p) => n + p.count, 0) - a.patterns.reduce((n, p) => n + p.count, 0));
  const cands = [...candidates.values()].sort(byPriority);
  const slowCalls = [...slow.values()].sort((a, b) => byPriority(a, b) || b.backgrounded - a.backgrounded);
  const failureClasses = buildFailureClasses(pats, cands);
  const owners = maskedOwners(cands, pats);
  const causes = buildCauses(pats, cands);
  const collisions = assignIds(hookGroups, pats, cands, owners, slowCalls, failureClasses, causes, inventory);
  stats.runtimeSec = +((now() - t0) / 1e3).toFixed(1);
  return { stats, selfCheck, previous, idCollisions: collisions, patterns: pats, candidates: cands, maskedOwners: owners, causes, slowCalls, waitCalls: { count: waitCalls.count, conversations: waitCalls.sessions.size }, unansweredQuestions, failureClasses, hookGroups, hookSourcesRead: sources.map((s) => s.path), settingsFilesRead: settingsFiles, inventory };
}
var total = (ps) => ps.reduce((n, p) => n + p.count, 0);
function hookGates(patterns) {
  const bySite = /* @__PURE__ */ new Map();
  const gates = [];
  for (const p of patterns) {
    if (!p.site || !p.siteStrong) {
      gates.push({ site: void 0, patterns: [p] });
      continue;
    }
    const list = bySite.get(p.site);
    if (list) list.push(p);
    else {
      const fresh = [p];
      bySite.set(p.site, fresh);
      gates.push({ site: p.site, patterns: fresh });
    }
  }
  for (const g of gates) g.patterns.sort((a, b) => (a.first ?? "").localeCompare(b.first ?? ""));
  return gates.sort((a, b) => total(b.patterns) - total(a.patterns));
}
var ANY_ERROR_CLASS = "any failure";
var detailReason = (detail) => detail.replace(/^(?:exit \S+|[\w-]+):\s*/, "");
var REASON_FAMILY_PREFIX = "reason:";
function ownerGroupKey(p) {
  if (!p.owner.startsWith("chain:") && !p.owner.includes("$")) return p.owner;
  const reason = detailReason(p.detail);
  return `${REASON_FAMILY_PREFIX}${reasonSignature(reason) ?? reason.slice(0, SIGNATURE_CHARS)}`;
}
function maskedOwners(cands, pats = []) {
  const byOwner = /* @__PURE__ */ new Map();
  const oneOff = pats.filter((p) => LISTED_FROM_MIN_CONVERSATIONS.includes(p.kind) && !isListed(p));
  for (const p of [...cands, ...oneOff]) {
    const key = ownerGroupKey(p);
    byOwner.set(key, [...byOwner.get(key) ?? [], p]);
  }
  return [...byOwner].map(([owner, ps]) => ({
    id: "",
    owner,
    patterns: [...ps].sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count),
    sessions: new Set(ps.flatMap((p) => [...p.sessions])),
    count: total(ps)
  })).sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count);
}
function splitKeyOf(detail, errorClass) {
  const reason = detailReason(detail);
  const token = errorClass.split(" ")[errorClass.startsWith("FAIL ") ? 1 : 0] ?? "";
  const at = token ? reason.indexOf(token) : -1;
  const after = (at >= 0 ? reason.slice(at + token.length) : reason).replace(/^[\s:,.\-\]\[)(]+/, "");
  return after.split(/\s+/).filter(Boolean).slice(0, SPLIT_WORDS).join(" ");
}
function buildFailureClasses(pats, cands = []) {
  const groups = /* @__PURE__ */ new Map();
  const add = (m, head, errorClass) => {
    const key = `${head} | ${errorClass}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { head, errorClass, members: [] });
    g.members.push(m);
  };
  const rare = [
    ...pats.filter((p) => LISTED_FROM_MIN_CONVERSATIONS.includes(p.kind) && !isListed(p)).map((p) => ({ p, tier: p.kind })),
    ...cands.filter((p) => p.sessions.size < IMPROVEMENT_MIN_CONVERSATIONS).map((p) => ({ p, tier: "masked" }))
  ];
  for (const m of rare) {
    if (m.p.owner.startsWith("chain:")) continue;
    const sig = reasonSignature(detailReason(m.p.detail));
    if (sig) add(m, commandClass(m.p.owner), sig);
    if (m.p.script && m.tier !== "masked") add(m, m.p.script, sig ?? ANY_ERROR_CLASS);
  }
  const make = (head, errorClass, members, split) => {
    const sessions = new Set(members.flatMap(({ p }) => [...p.sessions]));
    return { id: "", tier: [...new Set(members.map(({ tier }) => tier))].sort().join("+"), head, errorClass, ...split ? { split } : {}, patterns: members.map(({ p }) => p), sessions, count: members.reduce((n, { p }) => n + p.count, 0) };
  };
  const out = [];
  for (const g of groups.values()) {
    let rest = g.members;
    if (g.members.length > CLASS_MEMBER_CAP) {
      const buckets = /* @__PURE__ */ new Map();
      for (const m of g.members) {
        const k = splitKeyOf(m.p.detail, g.errorClass);
        buckets.set(k, [...buckets.get(k) ?? [], m]);
      }
      const kept = [...buckets].filter(([k, ms]) => k && ms.length > 1);
      for (const [k, ms] of kept) out.push(make(g.head, g.errorClass, ms, k));
      const used = new Set(kept.flatMap(([, ms]) => ms));
      rest = g.members.filter((m) => !used.has(m));
      if (kept.length && rest.length) {
        out.push(make(g.head, g.errorClass, rest, OTHER_REASONS));
        continue;
      }
    }
    if (rest.length) out.push(make(g.head, g.errorClass, rest));
  }
  return out.filter((c) => c.patterns.length > 1 && c.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS).sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count);
}
var STABLE_ID_HEX = 8;
var STABLE_ID_RE = new RegExp(`\\b[A-Z]-[0-9a-f]{${STABLE_ID_HEX}}\\b`);
function stableId(prefix, key) {
  return `${prefix}-${createHash("sha256").update(key).digest("hex").slice(0, STABLE_ID_HEX)}`;
}
var KIND_PREFIX = {
  hook_denial: "H",
  hook_failure: "H",
  classifier_denial: "C",
  permission_prompt: "P",
  safety_check: "Y",
  nonzero_exit: "E",
  mcp_tool_error: "M",
  other: "O",
  builtin_tool_error: "B",
  classifier_unavailable: "N",
  candidate: "R",
  slow: "S"
};
function idCollisions(assigned) {
  const keysOf = /* @__PURE__ */ new Map();
  for (const { id, key } of assigned) keysOf.set(id, (keysOf.get(id) ?? /* @__PURE__ */ new Set()).add(key));
  return [...keysOf].filter(([, keys]) => keys.size > 1).map(([id, keys]) => ({ id, keys: [...keys] }));
}
function assignIds(hookGroups, pats, cands, owners, slowCalls, classes, causes, inventory) {
  const assigned = [];
  const give = (prefix, key) => {
    const id = stableId(prefix, key);
    assigned.push({ id, key });
    return id;
  };
  for (const p of [...pats, ...cands, ...slowCalls]) {
    const pre = KIND_PREFIX[p.kind];
    if (pre) p.id = give(pre, p.key);
  }
  for (const g of hookGroups) g.id = give("H", `group:${g.owner}`);
  for (const o of owners) o.id = give("U", o.owner);
  for (const c of classes) c.id = give("K", `${c.head} | ${c.errorClass} | ${c.split ?? ""}`);
  for (const c of causes) c.id = give("X", c.family);
  for (const h of inventory.hooks) h.id = give("I", registrationKey(h));
  for (const l of inventory.matcherLeads) l.id = give("T", `tool:${l.token}`);
  for (const f of inventory.files) f.id = give("F", `file:${pathKey(f.path)}`);
  return idCollisions(assigned);
}
function isListed(p) {
  if (LISTED_IN_ANY_CONVERSATION.includes(p.kind)) return true;
  return LISTED_FROM_MIN_CONVERSATIONS.includes(p.kind) && p.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS;
}
var md = (s) => sanitizeText(s).replace(/\|/g, "\\|").replace(/`/g, "'");
function compactDays(days, limit = INDEX_DAYS) {
  const entries = [...days].sort(([a], [b]) => a.localeCompare(b));
  const shown = entries.length > limit ? entries.slice(entries.length - limit) : entries;
  const body = shown.map(([d, n]) => `${d.slice(5)}:${n}`).join(" ");
  return entries.length > limit ? `(${entries.length - limit} earlier days in patterns.json) ${body}` : body;
}
function splitOf(map) {
  return [...map].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
}
function spreadLocations(locations) {
  const sessionsOf = /* @__PURE__ */ new Set();
  const locs = [];
  for (const l of locations) {
    const session = l.ref.split(":")[0];
    if (sessionsOf.has(session)) continue;
    sessionsOf.add(session);
    locs.push(l.ref);
    if (locs.length >= IMPROVEMENT_INDEX_LOCATIONS) break;
  }
  return locs;
}
var VARIANTS_SHOWN = 2;
var VARIANT_CHARS = 60;
var siteLabel = (site) => {
  const m = /^(.*):(\d+)$/.exec(site);
  return m ? `${path.basename(m[1])}:${m[2]}` : site;
};
function patternLine(p, withDays, indent2 = "") {
  const candidate = p.kind === "candidate";
  const parts = [
    `${p.count} in ${p.sessions.size} conv`,
    ...candidate ? [] : [`retried ${p.retries} (same input ${p.retriesSame})`],
    `${p.first ?? "?"}..${p.last ?? "?"}`,
    `main ${p.actors.main} / subagent ${p.actors.subagent}`,
    ...p.tools.size === 1 ? [] : [`tools: ${splitOf(p.tools)}`]
  ];
  if (withDays) parts.push(`days: ${compactDays(p.days)}`);
  if (candidate && p.variants.size > 1) {
    const others = [...p.variants].filter(([v]) => !p.detail.endsWith(v)).sort((a, b) => b[1].count - a[1].count).slice(0, VARIANTS_SHOWN);
    parts.push(`${p.variants.size} reasons, also: ${others.map(([v, s]) => `"${md(v.slice(0, VARIANT_CHARS))}" ${s.count}`).join("; ")}`);
  }
  parts.push(`at ${spreadLocations(p.locations).join(", ")}`);
  const ownerTag = p.kind === "hook_denial" || p.kind === "classifier_denial" || p.kind === "classifier_unavailable" ? "" : ` \`${md(p.owner)}\``;
  const recovery = p.kind === "hook_denial" ? recoveryNote([p]) : "";
  return `${indent2}- **${p.id}**${ownerTag} ${md(markCut(p.detail))}${p.uncertain ? ` (${md(p.uncertain)})` : ""} \u2014 ${parts.join(" \xB7 ")}${recovery}`;
}
var SHAPES_SHOWN = 6;
var SHAPE_HEADS = 2;
function pathKind(file) {
  if (typeof file !== "string" || !file) return "?";
  const p = file.replace(/\\+/g, "/");
  const dot = /\/\.claude\/(hooks|rules|skills|agents|commands)\//.exec(p)?.[1];
  if (dot) return `.claude/${dot}`;
  if (/\/\.claude\/settings[\w.-]*\.json$/.test(p)) return ".claude/settings";
  if (/(?:^|\/)(?:CLAUDE|AGENTS)\.md$/.test(p)) return "CLAUDE.md";
  if (/\/memory\//.test(p)) return "memory";
  const ext = /\.([A-Za-z0-9]+)$/.exec(p)?.[1];
  return ext ? `*.${ext}` : "other";
}
function commandShape(tool, input) {
  const inp = input ?? {};
  if (isFileChangingTool(tool)) return `${tool} ${pathKind(inp.file_path ?? inp.notebook_path)}`;
  if (!isShellTool(tool) || typeof inp.command !== "string") return tool;
  const cmd = inp.command;
  const segs = splitCommand(cmd, tool);
  const heads = [...new Set(programIndexes(segs, tool).map((i) => {
    const w = segmentWord(segs[i].text);
    if (w !== "git") return w;
    const sub = /^git\s+(?:-C\s+\S+\s+)?(\S+)(?:\s+(pop|apply|drop|push|list))?/.exec(segmentBody(segs[i].text));
    return sub ? `git ${sub[1]}${sub[1] === "stash" && sub[2] ? ` ${sub[2]}` : ""}` : "git";
  }))];
  const flags = [];
  if (/\bgit\s+(?:-C\s+\S+\s+)?stash\b(?!\s+(?:pop|apply|list|show|drop))/.test(cmd) && /\bgit\s+(?:-C\s+\S+\s+)?stash\s+(?:pop|apply)\b/.test(cmd)) flags.push("stash round trip");
  if (/\brm\s+-\w*[rR]/.test(cmd) || /Remove-Item\b[^|;]*-Recurse/.test(cmd)) flags.push("recursive delete");
  if (/(?:^|[^0-9&>])>{1,2}(?!&)\s*[^\s&|]/.test(cmd.replace(/2>&1|>\s*\/dev\/null|>\s*\$null/g, ""))) flags.push("redirect");
  return `${tool} ${heads.slice(0, SHAPE_HEADS).join(" + ") || "?"}${heads.length > SHAPE_HEADS ? " + \u2026" : ""}${flags.length ? ` [${flags.join(", ")}]` : ""}`;
}
function shapeLine(ps) {
  const all = /* @__PURE__ */ new Map();
  for (const p of ps) for (const [k, v] of p.shapes) {
    const cur = all.get(k);
    if (cur) cur.count += v.count;
    else all.set(k, { ...v });
  }
  if (all.size < 2) return void 0;
  const ranked = [...all].sort((a, b) => b[1].count - a[1].count);
  return `  - stopped operations (${all.size} shapes): ${ranked.slice(0, SHAPES_SHOWN).map(([k, v]) => `${md(k)} \xD7${v.count} at ${v.ref}`).join("; ")}${ranked.length > SHAPES_SHOWN ? `; ${ranked.length - SHAPES_SHOWN} more` : ""}`;
}
function candidateLines(ps) {
  const byRoute = /* @__PURE__ */ new Map();
  for (const p of ps) {
    if (!p.candidates) continue;
    const tools = [...p.tools.keys()].sort();
    const key = `${tools.join("|")}>${p.candidates.map((c) => c.id).join(",")}`;
    const route = byRoute.get(key) ?? { tools, candidates: p.candidates, ids: [] };
    route.ids.push(p.id);
    byRoute.set(key, route);
  }
  return [...byRoute.values()].map((r) => {
    const scripts = (c) => c.scripts.length ? c.scripts.map((s) => `\`${md(s.path)}\``).join(", ") : `\`${md(c.command || c.content)}\``;
    const named = r.candidates.length ? r.candidates.map((c) => `${c.id} ${scripts(c)}`).join("; ") : "no registration on that event covers these tools in the settings files read";
    return `- stopped on ${HOOK_DENIAL_EVENT}:${r.tools.map(md).join(", ")} (${r.ids.join(", ")}) \u2014 candidates: ${named}`;
  });
}
function gateLines(gate) {
  const ps = gate.patterns;
  const p0 = ps[0];
  const site = gate.site ? ` \xB7 site ${md(siteLabel(gate.site))}` : p0.site ? ` \xB7 prefix-only site ${md(siteLabel(p0.site))}` : "";
  const shapes = shapeLine(ps);
  if (ps.length === 1) return [patternLine(p0, true) + site, ...shapes ? [shapes] : []];
  const sessions = new Set(ps.flatMap((p) => [...p.sessions]));
  const first = ps.map((p) => p.first ?? "").filter(Boolean).sort()[0] ?? "?";
  const last = ps.map((p) => p.last ?? "").filter(Boolean).sort().pop() ?? "?";
  return [
    `- one gate${site}, ${ps.length} refusal texts \u2014 ${total(ps)} stops in ${sessions.size} conv \xB7 ${first}..${last} \xB7 retried ${ps.reduce((n, p) => n + p.retries, 0)} (same input ${ps.reduce((n, p) => n + p.retriesSame, 0)})${recoveryNote(ps)}`,
    ...ps.map((p) => patternLine(p, true, "  ")),
    ...shapes ? [shapes] : []
  ];
}
function slowLine(p) {
  const d = [...p.durationsSec].sort((a, b) => a - b);
  const median = d.length ? d[Math.floor(d.length / 2)] : void 0;
  const parts = [
    `${p.count} in ${p.sessions.size} conv`,
    `moved to background ${p.backgrounded}`,
    `auto mode classifier checked ${p.classifierChecked}`,
    median === void 0 ? "duration ?" : `median ${median} s, max ${d[d.length - 1]} s`,
    `${p.first ?? "?"}..${p.last ?? "?"}`,
    `main ${p.actors.main} / subagent ${p.actors.subagent}`,
    `at ${spreadLocations(p.locations).join(", ")}`
  ];
  const chainLists = [...p.variants].filter(([v]) => v !== SINGLE_CALL).sort((a, b) => b[1].count - a[1].count);
  const chainCalls = chainLists.reduce((n, [, s]) => n + s.count, 0);
  const kind = chainCalls ? `${chainCalls} of the calls are chains where other commands may hold the time: ${chainLists.slice(0, VARIANTS_SHOWN).map(([v, s]) => `${md(v.replace(/^chain not attributed: /, ""))} \xD7${s.count}`).join("; ")}` : "";
  return `- **${p.id}** \`${md(p.detail)}\`${kind ? ` (${kind})` : ""} \u2014 ${parts.join(" \xB7 ")}`;
}
var REFUSAL_REASON_RE = /\b(?:refused|refusing|rejected|denied|not allowed|blocked|precondition|aborted)\b|拒否|中止|停止/i;
function markCut(text, max = Infinity) {
  const cut = text.length > max ? `${text.slice(0, max)}\u2026` : text;
  return /[（(「\[]\s*…?$/.test(cut) ? `${cut} [text cut off here]` : cut;
}
function ownerLine(o) {
  const shown = o.patterns.slice(0, OWNER_REASONS_SHOWN);
  const markers = /* @__PURE__ */ new Map();
  for (const p of o.patterns) {
    const m = p.detail.split(":")[0];
    markers.set(m, (markers.get(m) ?? 0) + p.count);
  }
  const reasons = shown.map((p) => `**${p.id}** "${md(markCut(detailReason(p.detail), OWNER_REASON_CHARS))}" ${p.count} in ${p.sessions.size} conv at ${p.locations[0]?.ref ?? "?"}`);
  const more = o.patterns.length > shown.length ? `; ${o.patterns.length - shown.length} more reasons` : "";
  const chain = o.patterns.find((p) => p.uncertain)?.uncertain;
  return `- **${o.id}** \`${md(o.owner)}\`${chain ? ` (${md(chain)})` : ""} \u2014 ${o.count} results in ${o.sessions.size} conv, ${o.patterns.length} distinct reasons \xB7 markers: ${splitOf(markers)} \xB7 ${reasons.join("; ")}${more}${recoveryNote(o.patterns)}`;
}
var NAMED_ERROR_RE = /\b([A-Z][A-Za-z]*(?:Error|Exception))\b|\b(ERR_[A-Z][A-Z_]{2,})\b|\b([a-z][a-z0-9]*(?:_[a-z0-9]+)*_(?:error|failed|failure))\b/;
var CAUSE_WORDS = 2;
var CAUSE_PREFIX_WORDS = 3;
var CROSS_TOOL_PATH_HINTS = /* @__PURE__ */ new Set([ENV_MANGLED_ARGUMENT, "non-ASCII name shown escaped"]);
var isEnvironmentCause = (family) => CROSS_TOOL_PATH_HINTS.has(family) || /Git Bash path|codec|\bcp\d+\b/.test(family);
var INLINE_HEAD_RE = /\s-(?:inline|heredoc)$/;
function causeFamily(reason) {
  const core = lineCore(reason);
  if (FAIL_LINE_RE.test(core) || ESBUILD_ERROR_RE.test(core) || CODE_LINE_RE.test(core)) return reasonSignature(reason);
  const pathHint = /\[path: ([^\]]+)\]/.exec(reason)?.[1];
  if (pathHint && CROSS_TOOL_PATH_HINTS.has(pathHint)) return pathHint;
  const plain = reason.replace(/\s*\[(?:path|missing): [^\]]+\]/g, "");
  if (/\$'\\[0-9N]/.test(plain)) return "non-ASCII name shown escaped";
  if (/\uFFFD/.test(plain)) return /\uFFFD[\s.…]*$/.test(plain) ? "truncated multibyte text" : "garbled characters in output";
  const missing = /\[missing: ([^\]]+)\]/.exec(reason)?.[1];
  const named = NAMED_ERROR_RE.exec(reason);
  if (named) {
    const cls = named[1] ?? named[2] ?? named[3];
    if (missing) return `${cls} ${missing}`;
    if (pathHint) return `${cls} ${pathHint}`;
    const codec = /'(\w+)' codec/.exec(reason)?.[1];
    if (codec) return `${cls} ${codec}`;
    const after = reason.slice(named.index + cls.length).replace(/^[\]\s:,(\[]+/, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, CAUSE_WORDS).join(" ");
    return after ? `${cls} ${after}` : cls;
  }
  const prefix = looksLikeCode(core) ? null : /^(fatal|error|npm ERR!|npm error|[\w.-]{2,40}):\s*(.*)$/.exec(core);
  const words = prefix ? prefix[2].split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z-]*[,:]?$/.test(w)).slice(0, CAUSE_PREFIX_WORDS).map((w) => w.replace(/[,:]$/, "")) : [];
  return prefix && words.length ? `${prefix[1]}: ${words.join(" ")}` : void 0;
}
function buildCauses(pats, cands) {
  const groups = /* @__PURE__ */ new Map();
  const members = [...pats.filter((p) => LISTED_FROM_MIN_CONVERSATIONS.includes(p.kind)), ...cands];
  for (const p of members) {
    const reason = detailReason(p.detail);
    const family = INLINE_HEAD_RE.test(commandClass(p.owner)) && /\bSyntaxError\b/.test(reason) ? "inline code SyntaxError" : causeFamily(reason);
    if (family) groups.set(family, [...groups.get(family) ?? [], p]);
  }
  return [...groups].map(([family, ps]) => ({
    id: "",
    family,
    patterns: ps,
    sessions: new Set(ps.flatMap((p) => [...p.sessions])),
    days: new Set(ps.flatMap((p) => [...p.days.keys()])),
    count: total(ps)
  })).sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count);
}
var CAUSE_SPANS_SHOWN = 8;
var CAUSE_TAIL_MIN_CONVERSATIONS = 3;
var CAUSE_TAIL_SPANS = 2;
var SLOW_TAIL_MIN_CONVERSATIONS = 3;
var spannedIds = (c, spanOf) => [...new Set(c.patterns.map(spanOf).filter(Boolean))];
function causeLine(c, spanOf) {
  const spans = spannedIds(c, spanOf);
  const locs = spreadLocations(c.patterns.flatMap((p) => p.locations)).slice(0, 1);
  const id = /^FAIL (\S+)$/.exec(c.family)?.[1];
  const family = id && failFamily(id) !== id ? ` (test family ${md(failFamily(id))})` : "";
  const messages = c.family === "inline code SyntaxError" ? ` (messages: ${[...new Set(c.patterns.map((p) => detailReason(p.detail).replace(/^.*?SyntaxError:?\s*/, "").slice(0, 30)))].slice(0, 3).map((m) => `"${md(m)}"`).join(", ")})` : "";
  return `- **${c.id}** \`${md(c.family)}\`${family}${messages} \u2014 ${c.count} results in ${c.sessions.size} conv over ${c.days.size} days, last ${[...c.days].sort().pop() ?? "?"}, ${c.patterns.length} patterns \xB7 spans ${spans.slice(0, CAUSE_SPANS_SHOWN).join(", ")}${spans.length > CAUSE_SPANS_SHOWN ? `, +${spans.length - CAUSE_SPANS_SHOWN} more` : ""}${recoveryNote(c.patterns)} \xB7 at ${locs.join(", ")}`;
}
async function lastBlockOf(file) {
  const scratch = { oversizedLines: 0, unparsable: 0 };
  let lastAt = null;
  let blockAt = null;
  let block;
  try {
    for await (const { rec } of jsonLines(file, scratch)) {
      if (!rec) continue;
      const at = typeof rec.timestamp === "string" ? rec.timestamp : null;
      if (at && (!lastAt || at > lastAt)) lastAt = at;
      const content = rec.type === "assistant" ? rec.message?.content : void 0;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        const found = b?.type === "text" && typeof b.text === "string" ? lastVerdictsBlock(b.text) : void 0;
        if (found !== void 0) {
          block = found;
          blockAt = at;
        }
      }
    }
  } catch (e) {
    return { at: blockAt ?? lastAt, error: e instanceof Error ? e.message : String(e) };
  }
  return block !== void 0 ? { at: blockAt, block } : { at: lastAt };
}
async function earlierVerdicts(analyses) {
  const read = await Promise.all(analyses.map(async (f) => ({ f, ...await lastBlockOf(f.full) })));
  read.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const earlier = [];
  for (const x of read) {
    const base = { conversation: x.f.session.slice(0, 8), at: x.at };
    if (x.error !== void 0) {
      earlier.push({ ...base, state: "unreadable", reason: x.error });
      continue;
    }
    if (x.block === void 0) {
      earlier.push({ ...base, state: "no_block" });
      continue;
    }
    const parsed = parseVerdicts(x.block);
    if ("error" in parsed) {
      earlier.push({ ...base, state: "unreadable", reason: parsed.error });
      continue;
    }
    earlier.push({ ...base, state: "used" });
    return { earlier, entries: parsed.entries, invalid: parsed.invalid };
  }
  return { earlier, entries: [], invalid: [] };
}
function countsAround(locations, fixAt) {
  const fix = Date.parse(fixAt);
  let before = 0, after = 0, undated = 0;
  const conversations = /* @__PURE__ */ new Set();
  for (const l of locations) {
    const at = l.at ? Date.parse(l.at) : NaN;
    if (Number.isNaN(at)) undated++;
    else if (at > fix) {
      after++;
      conversations.add(l.ref.split(":")[0]);
    } else before++;
  }
  return { before, after, afterConversations: conversations.size, undated };
}
function itemLocations(r) {
  const m = /* @__PURE__ */ new Map();
  const flat = (ps) => () => ps.flatMap((p) => p.locations);
  for (const p of [...r.patterns, ...r.candidates, ...r.slowCalls]) if (p.id) m.set(p.id, () => p.locations);
  for (const o of r.maskedOwners) m.set(o.id, flat(o.patterns));
  for (const c of r.causes) m.set(c.id, flat(c.patterns));
  for (const c of r.failureClasses) m.set(c.id, flat(c.patterns));
  for (const g of r.hookGroups) m.set(g.id, flat(g.patterns));
  return m;
}
var PREV_REASON_CHARS = 120;
var INDEX_BUILTIN = 16;
var BOLD_ID_RE = new RegExp(`\\*\\*(${STABLE_ID_RE.source})\\*\\*`, "g");
function previousText(v, locations, records, inInventory = false) {
  const head = `${v.verdict}${v.group ? ` ${v.group}` : ""}${v.status ? ` (${v.status})` : ""} "${md(markCut(v.reason, PREV_REASON_CHARS))}"`;
  let fix = "";
  if (v.fixCommit || v.fixDate) {
    const c = v.fixDate && locations ? countsAround(locations, v.fixDate) : void 0;
    fix = ` \xB7 fix ${md(v.fixCommit ?? "?")} at ${md(v.fixDate ?? "?")}${c ? `: ${c.before} before, ${c.after} after in ${c.afterConversations} conv${c.undated ? `, ${c.undated} undated` : ""}` : ""}`;
  }
  const last = locations ? locations.reduce((m, l) => l.at && (!m || l.at > m) ? l.at : m, null) : null;
  const seen = inInventory ? " \xB7 still in this scan's inventory" : !locations ? ` \xB7 not in this scan (records ${records})` : ` \xB7 ${locations.length} in this scan, last seen ${last?.slice(0, 10) ?? "?"}`;
  return `${head}${fix}${seen}`;
}
var INVENTORY_COMMAND_CHARS = 200;
var hasMissingScript = (h) => h.scripts.some((s) => !s.exists);
function inventoryIdsOf(inv) {
  return [...inv.hooks, ...inv.matcherLeads, ...inv.files].map((x) => x.id).filter(Boolean);
}
var addedText = (f) => !f || !f.added ? "added ?" : `added ${f.added.slice(0, 10)} (${f.source})`;
function hookScriptState(h, ageOf = () => void 0) {
  if (h.type !== "command") return `${md(h.type)} hook, no script`;
  if (h.projectDependent) return "script path depends on the project folder (CLAUDE_PROJECT_DIR in a user settings file): not checked";
  const unchecked = h.uncheckedScripts.map((p) => `script \`${md(p)}\` is a root-relative path of a POSIX shell here: not checked`);
  if (!h.scripts.length && !unchecked.length) return "no absolute script path in the command or args: not checked";
  return [...h.scripts.map((s) => s.exists ? `script \`${md(s.path)}\` exists, ${addedText(ageOf(s.path))}` : `script \`${md(s.path)}\` MISSING`), ...unchecked].join("; ");
}
var hookConditions = (h) => [h.condition !== void 0 ? `if \`${md(h.condition)}\`` : "", h.shell !== void 0 ? `shell ${md(h.shell)}` : ""].filter(Boolean).map((s) => ` ${s}`).join("");
function inventoryLines(inv) {
  const ages = new Map(inv.files.map((f) => [pathKey(f.path), f]));
  const ageOf = (p) => ages.get(pathKey(p));
  const out = ["## Inventory for removal and correction candidates (mechanical facts; a lead is not a finding)", ""];
  out.push(`- Claude Code versions in the records (version first..last, records): ${inv.versions.map((v) => `${md(v.version)} ${v.first ?? "?"}..${v.last ?? "?"} (${v.records})`).join("; ") || "none"}`);
  out.push(`- Distinct tool names seen as a tool_use name in the scanned records: ${inv.toolNamesSeen}`, "");
  out.push("### Hook registrations in the settings files read (event [matcher] type with its if condition and shell when set, settings file, command or other content, script state; \xD7n = the same registration n times in that file)", "");
  out.push(...inv.hooks.length ? inv.hooks.map((h) => `- **${h.id}** ${md(h.event)} [${md(h.matcher || "*")}] ${md(h.type)}${hookConditions(h)}${h.count > 1 ? ` \xD7${h.count}` : ""} in \`${md(h.settingsFile)}\`: \`${md(markCut(h.content, INVENTORY_COMMAND_CHARS))}\` \u2014 ${hookScriptState(h, ageOf)}`) : ["- none"], "");
  out.push(`### Matcher tool names never seen as a tool_use name in the scanned records (${TOOL_MATCHER_EVENTS.join(", ")}; a lead to confirm with the current tool list, not evidence)`, "");
  out.push(...inv.matcherLeads.length ? inv.matcherLeads.map((l) => `- **${l.id}** \`${md(l.token)}\` in the matcher of ${l.registrations.map((h) => h.id).join(", ")}`) : ["- none"], "");
  out.push("### When each hook script, rule and CLAUDE.md file was added (author date of the first git commit touching it at this path, else the file's modification time labelled mtime; files found from the conversation working folders and their parent folders)", "");
  const byDir = /* @__PURE__ */ new Map();
  for (const f of inv.files) byDir.set(path.dirname(f.path), [...byDir.get(path.dirname(f.path)) ?? [], f]);
  out.push(...byDir.size ? [...byDir].sort(([a], [b]) => a.localeCompare(b)).map(([dir, files]) => `- \`${md(dir)}\`: ${files.map((f) => `**${f.id}** ${md(path.basename(f.path))}${f.kind === "CLAUDE.md" ? "" : ` ${f.kind}`}${f.registered === false ? " (named by no registration's command)" : ""} ${addedText(f)}`).join("; ")}`) : ["- none"], "");
  return out;
}
function renderIndex(r, ctx) {
  const s = r.stats;
  const prev = r.previous;
  const prevById = /* @__PURE__ */ new Map();
  for (const e of prev.entries) if (!prevById.has(e.id)) prevById.set(e.id, e);
  const locationsOf = itemLocations(r);
  const records = `${s.firstDate ?? "?"}..${s.lastDate ?? "?"}`;
  const listedIds = /* @__PURE__ */ new Set();
  const inventoryIds = new Set(inventoryIdsOf(r.inventory));
  const prevOf = (id) => {
    const v = prevById.get(id);
    return v ? previousText(v, locationsOf.get(id)?.(), records, inventoryIds.has(id)) : "";
  };
  const prevNote = (id) => {
    listedIds.add(id);
    const text = prevOf(id);
    return text ? ` \xB7 prev: ${text}` : "";
  };
  const tailNote = (id) => {
    listedIds.add(id);
    const text = prevOf(id);
    return text ? ` (prev: ${text})` : "";
  };
  const ownerOfPattern = /* @__PURE__ */ new Map();
  for (const o of r.maskedOwners) for (const p of o.patterns) ownerOfPattern.set(p, o.id);
  const spanOf = (p) => ownerOfPattern.get(p) ?? p.id;
  const listed = r.patterns.filter(isListed);
  const byKind = (k) => listed.filter((p) => p.kind === k);
  const convs = (ps) => new Set(ps.flatMap((p) => [...p.sessions])).size;
  const out = [];
  out.push("# Improvement analysis index", "");
  out.push(`Generated ${ctx.generatedAt} from ${ctx.projectsDir}: ${s.parentFiles} conversations, ${s.subagentFiles} subagent files (${s.subagentForkFiles} forks), ${(s.bytes / 1e9).toFixed(2)} GB, records ${s.firstDate ?? "?"}..${s.lastDate ?? "?"}, ${s.errorResults} failed tool results, scan ${s.runtimeSec} s.`);
  out.push(`Not read: ${s.excludedImprovementSessions} earlier improvement-analysis conversations and ${s.excludedImprovementAgents} analysis subagent files, ${s.unreadableFiles} unreadable files, ${s.unparsable} unparsable lines, ${s.oversizedLines} oversized lines.`);
  out.push("Location = `<conversation id prefix>:<parent | subagent file>:<line>`. Open it with the record command in brief.md. patterns.json (same folder) has every location of every pattern with its absolute path and timestamp; days are MM-DD:count.");
  for (const c of r.idCollisions) out.push(`Warning: id ${c.id} is shared by ${c.keys.length} different grouping keys, so their lines and previous verdicts are merged under it: ${c.keys.map((k) => `"${md(k)}"`).join(", ")}.`);
  const accountingAt = out.length;
  out.push("");
  const previousAt = out.length;
  out.push("", `Recovery: "rec m/p" = tool calls until the same command next succeeded (median/p75), "expl" = share of those recoveries with file reading or searching in between, "unrec" = failures not followed by a success of the same command within ${RECOVERY_WINDOW} calls.`, "");
  out.push("## Hooks and gates (every stop, any number of conversations)", "");
  out.push("Stops whose refusal texts match the same source literal for most of its fixed part (and of theirs) are one gate entry, with each refusal text and its date range under it; a text that stops while another of the same entry continues is a rewording, not a fix. 'prefix-only site' marks a pattern whose text shares only its start with that source line: it is not merged, check the source before treating it as the same gate.", "");
  if (!r.hookGroups.length) out.push("- none", "");
  r.hookGroups.forEach((g) => {
    const ps = g.patterns;
    const retried = ps.reduce((n, p) => n + p.retries, 0);
    const unresolved = isUnresolvedOwner(g.owner);
    out.push(`### ${g.id} ${md(unresolved ? g.owner.replace(UNRESOLVED_OWNER, "refusal text not found in the hook scripts read") : g.owner)} \u2014 ${total(ps)} stops in ${convs(ps)} conversations, retried ${retried}${prevNote(g.id)}`);
    out.push(g.sources.length ? `source: ${g.sources.map(md).join(", ")}` : `source: no hook script read contains the refusal text (the hook was reworded since, builds the text from variables, or is not among the files read, for example a plugin's hook). "stopped on" below names the event and the tools of the stops with the registrations on that event whose matcher covers those tools: candidates, not proof. Search those scripts and the settings files listed at the end for the refusal text.`);
    for (const gate of g.gates) out.push(...gateLines(gate));
    if (unresolved) out.push(...candidateLines(ps));
    out.push("");
  });
  const minConv = `${IMPROVEMENT_MIN_CONVERSATIONS}+ conversations`;
  const anyCount = (title, k) => {
    out.push(title, "", ...byKind(k).length ? byKind(k).map((p) => patternLine(p, true)) : ["- none"], "");
  };
  anyCount("## Auto mode classifier denials (each reason, any number of conversations)", "classifier_denial");
  anyCount("## Permission prompts not granted (each prompt kind, any number of conversations; a permission rule candidate, not a user refusal)", "permission_prompt");
  anyCount("## Claude Code safety checks (each command, any number of conversations)", "safety_check");
  out.push(`## MCP tool errors in ${minConv}`, "");
  out.push(...byKind("mcp_tool_error").length ? byKind("mcp_tool_error").map((p) => patternLine(p, true)) : ["- none"], "");
  const causes = r.causes.filter((c) => c.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS);
  const listedCauses = causes.slice(0, INDEX_CAUSES);
  const causeOf = /* @__PURE__ */ new Map();
  for (const c of listedCauses) for (const p of c.patterns) causeOf.set(p, c.id);
  const coverNote = (ps) => {
    const ids = [...new Set(ps.map((p) => causeOf.get(p)).filter((x) => !!x))];
    if (!ids.length) return "";
    return ps.every((p) => causeOf.has(p)) ? ` \xB7 covered by ${ids.join(", ")}` : ` \xB7 partly in ${ids.join(", ")}`;
  };
  const fullyCovered = (ps) => ps.every((p) => causeOf.has(p));
  const failureLine = (p) => fullyCovered([p]) ? `- **${p.id}** \`${md(p.owner)}\` ${md(p.detail.slice(0, COMPACT_DETAIL_CHARS))} \u2014 ${p.count} in ${p.sessions.size} conv${coverNote([p])}` : patternLine(p, false) + coverNote([p]);
  const ownerEntry = (o) => fullyCovered(o.patterns) ? `- **${o.id}** \`${md(o.owner)}\` \u2014 ${o.count} results in ${o.sessions.size} conv, ${o.patterns.length} reasons${recoveryNote(o.patterns)}${coverNote(o.patterns)}` : ownerLine(o) + coverNote(o.patterns);
  out.push(`## Causes in ${minConv} (one cause = an error class with its decisive token, a failing test id, an upper-case code, or a program's diagnostic prefix, rolled up across command failures, masked and one-off results; ranked by conversations)`, "");
  out.push(...listedCauses.length ? listedCauses.map((c) => causeLine(c, spanOf)) : ["- none"]);
  const causeTail = causes.slice(INDEX_CAUSES).filter((c) => c.sessions.size >= CAUSE_TAIL_MIN_CONVERSATIONS || isEnvironmentCause(c.family));
  if (causeTail.length) out.push(`- more causes in ${CAUSE_TAIL_MIN_CONVERSATIONS}+ conversations (and environment causes in 2+; id key results/conversations: spanned ids): ${causeTail.map((c) => `${c.id} ${md(c.family)} ${c.count}/${c.sessions.size}: ${spannedIds(c, spanOf).slice(0, CAUSE_TAIL_SPANS).join(",")}${tailNote(c.id)}`).join("; ")}`);
  if (causes.length > listedCauses.length + causeTail.length) out.push(`- ${causes.length - listedCauses.length - causeTail.length} more causes in fewer conversations in patterns.json (causes)`);
  out.push("");
  out.push(`## Command failures (nonzero exit) in ${minConv}`, "");
  out.push(...byKind("nonzero_exit").length ? byKind("nonzero_exit").map(failureLine) : ["- none"], "");
  if (byKind("other").length) out.push(`## Other failed results in ${minConv}`, "", ...byKind("other").map(failureLine), "");
  const builtin = r.patterns.filter((p) => p.kind === "builtin_tool_error");
  const builtinMin = builtin.filter((p) => p.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS);
  const builtinListed = builtinMin.slice(0, INDEX_BUILTIN);
  out.push(`## Claude Code built-in tool errors in ${minConv} (the tool's own error result; the agent's misuse or a Claude Code defect)`, "");
  out.push(...builtinListed.length ? builtinListed.map((p) => patternLine(p, false)) : ["- none"]);
  if (builtinMin.length > builtinListed.length) out.push(`- ${builtinMin.length - builtinListed.length} more in ${minConv} in patterns.json`);
  out.push("");
  const attributedOwner = (o) => !o.owner.startsWith(REASON_FAMILY_PREFIX) && !o.owner.startsWith("tool:mcp__");
  const owners = r.maskedOwners.filter((o) => o.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS && attributedOwner(o));
  const listedOwners = owners.slice(0, INDEX_MASKED_OWNERS);
  const tail = owners.slice(INDEX_MASKED_OWNERS).filter((o) => o.sessions.size >= OWNER_TAIL_MIN_CONVERSATIONS || o.patterns.some((p) => REFUSAL_REASON_RE.test(p.detail)));
  const mcpAll = r.maskedOwners.filter((o) => o.owner.startsWith("tool:mcp__"));
  const mcpOwners = mcpAll.filter((o) => o.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS);
  const unlisted = r.maskedOwners.filter((o) => attributedOwner(o) && !listedOwners.includes(o) && !tail.includes(o));
  out.push(`## Masked failures and one-off command failures by owner in ${minConv} (masked = result not marked as an error, but the output shows a failure; one-off = a command failure, MCP or other error whose own pattern is in fewer conversations; confirm in the records)`, "");
  out.push(`Markers ${[...MASKED_MARKERS_NEEDING_RETRY].join(", ")} count only when the same command (same script path, or the same command text) was run again within ${IMPROVEMENT_CANDIDATE_RETRY_WINDOW} calls; the others count on their own (printed-status = the command echoed a nonzero status it captured). Echoed statuses of predicates and read-only commands are ignored, and their missing-file or no-match messages are not markers; their own usage, syntax and environment errors are. Each result counts once per entry. Failures whose command could not be told (unattributed chains, unresolved variables) are not owner lines; they are counted under Causes by reason.`, "");
  out.push(...listedOwners.length ? listedOwners.map(ownerEntry) : ["- none"]);
  if (tail.length) out.push(`- more owners in ${OWNER_TAIL_MIN_CONVERSATIONS}+ conversations, or 2+ with a refusal or precondition message (open from patterns.json maskedOwners by id): ${tail.map((o) => `${o.id} \`${md(o.owner)}\` ${o.sessions.size}c/${o.count}r${tailNote(o.id)}`).join("; ")}`);
  out.push(`- not listed (fewer conversations; in patterns.json maskedOwners): ${unlisted.reduce((n, o) => n + o.count, 0)} results, ${unlisted.length} owners`);
  out.push("");
  out.push(`## MCP and external tool results that report failure inside an ok result (every owner in ${minConv})`, "");
  out.push(...mcpOwners.length ? mcpOwners.map(ownerEntry) : ["- none"]);
  out.push(`- in fewer conversations (in patterns.json maskedOwners): ${mcpAll.length - mcpOwners.length} owners`, "");
  const slowListed = r.slowCalls.filter((p) => p.sessions.size >= IMPROVEMENT_MIN_CONVERSATIONS);
  out.push(`## Slow or backgrounded shell calls by the slow segment's command in ${minConv} (moved to the background by the timeout, or ${SLOW_CALL_SEC} s or more from call to result; the time includes any auto mode classifier or permission prompt wait; "chain:" lines list every heavy command when the slow one could not be told)`, "");
  out.push(...slowListed.length ? slowListed.slice(0, INDEX_SLOW).map(slowLine) : ["- none"]);
  out.push(`- wait loops and long sleeps (not listed): ${r.waitCalls.count} calls in ${r.waitCalls.conversations} conversations`);
  const slowTail = slowListed.slice(INDEX_SLOW).filter((p) => p.sessions.size >= SLOW_TAIL_MIN_CONVERSATIONS);
  if (slowTail.length) out.push(`- more slow heads in ${SLOW_TAIL_MIN_CONVERSATIONS}+ conversations (id head calls/conversations): ${slowTail.map((p) => `${p.id} ${md(p.detail)} ${p.count}/${p.sessions.size}${tailNote(p.id)}`).join("; ")}`);
  if (slowListed.length > INDEX_SLOW + slowTail.length) out.push(`- ${slowListed.length - INDEX_SLOW - slowTail.length} more slow command heads in fewer conversations in patterns.json`);
  out.push("");
  out.push(...inventoryLines(r.inventory));
  const deadHooks = r.inventory.hooks.filter(hasMissingScript);
  const need = {
    H: r.hookGroups.reduce((n, g) => n + g.patterns.length, 0),
    C: byKind("classifier_denial").length,
    P: byKind("permission_prompt").length,
    Y: byKind("safety_check").length,
    M: byKind("mcp_tool_error").length,
    X: listedCauses.length + causeTail.length,
    "E/O not covered": [...byKind("nonzero_exit"), ...byKind("other")].filter((p) => !fullyCovered([p])).length,
    U: listedOwners.filter((o) => !fullyCovered(o.patterns)).length,
    "MCP/external": mcpOwners.filter((o) => !fullyCovered(o.patterns)).length,
    S: Math.min(slowListed.length, INDEX_SLOW) + slowTail.length,
    B: builtinListed.length,
    "I missing script": deadHooks.length,
    T: r.inventory.matcherLeads.length
  };
  const notListed = (k) => r.patterns.filter((p) => p.kind === k);
  const builtinRest = builtin.filter((p) => !builtinListed.includes(p));
  out.push("## Counted but not listed", "");
  out.push(`- Claude Code built-in tool errors not listed above: ${total(builtinRest)} in ${convs(builtinRest)} conversations, ${builtinRest.length} patterns`);
  out.push(`- Auto mode classifier gave no verdict (transient, not a judgement): ${total(notListed("classifier_unavailable"))} in ${convs(notListed("classifier_unavailable"))} conversations`);
  out.push(`- Refused or interrupted by the user: ${total(notListed("user_rejected"))}`);
  out.push(`- Questions the user left unanswered (not refusals; the call succeeded): ${ASK_UNANSWERED_KINDS.map((kind) => `${kind} ${r.unansweredQuestions[kind]}`).join(", ")}`);
  out.push(`- Failure classes (cross-command groupings) are in patterns.json (failureClasses); Causes above replace them in this index.`);
  out.push("");
  out.push("## Hook sources and settings files read", "");
  out.push(`- settings: ${r.settingsFilesRead.map(md).join(", ") || "none"}`);
  out.push(`- hook scripts: ${r.hookSourcesRead.map(md).join(", ") || "none"}`);
  for (let i = 0; i < out.length; i++) {
    const ids = [...new Set([...out[i].matchAll(BOLD_ID_RE)].map((m) => m[1]))];
    ids.forEach((id, k) => {
      listedIds.add(id);
      const text = prevOf(id);
      if (text) out[i] += k === 0 ? ` \xB7 prev: ${text}` : ` \xB7 prev ${id}: ${text}`;
    });
  }
  const notShown = previousNotShown(prev, listedIds);
  out[previousAt] = previousSection(prev, notShown, prevOf, (id) => locationsOf.has(id) || inventoryIds.has(id)).join("\n");
  const allNeed = { ...need, "previous not shown": notShown.open.length };
  out[accountingAt] = `Accounting: ${Object.values(allNeed).reduce((n, v) => n + v, 0)} entries are needed (${Object.entries(allNeed).map(([k, v]) => `${k} ${v}`).join(", ")}), each backed by at least one opened record (for "I missing script" and T: the file check, the current tool list with the documented aliases, or a probe instead); ids in the cause and slow tails may be grouped when they share a checked reason.`;
  return out.join("\n") + "\n";
}
function previousNotShown(prev, listedIds) {
  const missing = [...new Map(prev.entries.filter((e) => !listedIds.has(e.id)).map((e) => [e.id, e])).values()];
  return { open: missing.filter((e) => e.verdict !== "excluded"), closed: missing.filter((e) => e.verdict === "excluded") };
}
function previousSection(prev, notShown, prevOf, inScan) {
  const lines = ["", "## Previous verdicts", ""];
  if (!prev.earlier.length) return [...lines, "- none: no earlier analysis conversation is in the records, so no id carries a previous verdict.", ""];
  const when = (a) => `${md(a.conversation)} (${a.at ?? "?"})`;
  for (const a of prev.earlier) {
    if (a.state === "no_block") lines.push(`- ${when(a)}: earlier analysis conversation without a verdicts block; skipped.`);
    else if (a.state === "unreadable") lines.push(`- ${when(a)}: its verdicts block could not be read (${md(a.reason ?? "?")}); skipped.`);
  }
  const used = prev.earlier.find((a) => a.state === "used");
  if (!used) return [...lines, `- no earlier analysis conversation has a readable verdicts block, so no id carries a previous verdict.`, ""];
  const count = (k) => prev.entries.filter((e) => e.verdict === k).length;
  lines.push(`- ${when(used)}: verdicts used: ${VERDICT_KINDS.map((k) => `${count(k)} ${k}`).join(", ")}. "prev:" beside an id carries that verdict.${prev.invalid.length ? ` ${prev.invalid.length} entries could not be read: ${prev.invalid.map(md).join(", ")}.` : ""}`, "");
  lines.push(`Previous findings and not-investigated entries whose id is not shown in this index: ${notShown.open.length}`);
  lines.push(...notShown.open.map((e) => `- ${md(e.id)} prev: ${prevOf(e.id)}`));
  if (notShown.closed.length) lines.push(`- previous exclusions whose id is not shown in this index: ${notShown.closed.map((e) => `${md(e.id)}${inScan(e.id) ? "" : " (not in this scan)"}`).join(", ")}`);
  return [...lines, ""];
}
function patternsJson(r, ctx) {
  const plain = (p) => ({
    id: p.id || void 0,
    kind: p.kind,
    owner: p.owner,
    detail: p.detail,
    sample: sanitizeText(p.sample),
    uncertain: p.uncertain,
    site: p.site,
    siteStrong: p.site ? p.siteStrong === true : void 0,
    script: p.script,
    variants: p.variants.size ? Object.fromEntries(p.variants) : void 0,
    durationsSec: p.durationsSec.length ? p.durationsSec : void 0,
    backgrounded: p.backgrounded || void 0,
    classifierChecked: p.classifierChecked || void 0,
    recovery: p.recovery.length || p.unrecovered ? { calls: p.recovery, explored: p.recoveryExplored, unrecovered: p.unrecovered } : void 0,
    count: p.count,
    conversations: [...p.sessions],
    retries: p.retries,
    first: p.first,
    last: p.last,
    days: Object.fromEntries([...p.days].sort(([a], [b]) => a.localeCompare(b))),
    actors: p.actors,
    tools: Object.fromEntries(p.tools),
    locations: p.locations.map((l) => ({ path: l.path, line: l.line, ref: l.ref, at: l.at, actor: l.actor, tool: l.tool }))
  });
  return JSON.stringify({
    generatedAt: ctx.generatedAt,
    projectsDir: ctx.projectsDir,
    stats: r.stats,
    hookGroups: r.hookGroups.map((g) => ({ id: g.id, owner: g.owner, sources: g.sources, gates: g.gates.map((gate) => ({ site: gate.site, patterns: gate.patterns.map((p) => p.id) })) })),
    patterns: r.patterns.map(plain),
    maskedCandidates: r.candidates.map(plain),
    slowCalls: r.slowCalls.map(plain),
    waitCalls: r.waitCalls,
    causes: r.causes.map((c) => ({ id: c.id, family: c.family, count: c.count, conversations: [...c.sessions], days: [...c.days].sort(), patterns: c.patterns.map((p) => p.id || `${p.kind}: ${p.detail}`) })),
    maskedOwners: r.maskedOwners.map((o) => ({ id: o.id, owner: o.owner, conversations: [...o.sessions], count: o.count, patterns: o.patterns.map((p) => p.id) })),
    failureClasses: r.failureClasses.map((c) => ({ id: c.id, tier: c.tier, head: c.head, errorClass: c.errorClass, split: c.split, count: c.count, conversations: [...c.sessions], patterns: c.patterns.map((p) => ({ owner: p.owner, detail: p.detail, locations: p.locations.map((l) => l.ref) })) })),
    settingsFilesRead: r.settingsFilesRead,
    hookSourcesRead: r.hookSourcesRead,
    inventory: {
      hooks: r.inventory.hooks,
      matcherLeads: r.inventory.matcherLeads.map((l) => ({ id: l.id, token: l.token, registrations: l.registrations.map((h) => h.id) })),
      toolNamesSeen: r.inventory.toolNamesSeen,
      versions: r.inventory.versions,
      files: r.inventory.files
    }
  }, null, 1) + "\n";
}

// src/improvement-record.ts
import fs2 from "node:fs";
import path2 from "node:path";
import readline2 from "node:readline";
var RECORD_FIELD_MAX = 2e3;
var RECORD_OUTPUT_MAX = 3e4;
var RECORD_AROUND_MAX = 20;
function parseRecordLocation(arg, lineArg) {
  if (lineArg !== void 0 && /^\d+$/.test(lineArg)) return { file: arg, line: Number(lineArg) };
  const short = /^([0-9a-f][0-9a-f-]{3,35}):(parent|agent-[\w-]+?)(?:\.jsonl)?:(\d+)$/i.exec(arg);
  if (short) return { sessionPrefix: short[1].toLowerCase(), part: short[2], line: Number(short[3]) };
  const full = /^(.+\.jsonl):(\d+)$/.exec(arg);
  if (full) return { file: full[1], line: Number(full[2]) };
  return void 0;
}
function resolveRecordFiles(projectsDir, loc) {
  if (loc.file) return [loc.file];
  const hits = [];
  let projects = [];
  try {
    projects = fs2.readdirSync(projectsDir);
  } catch {
    return [];
  }
  for (const project of projects) {
    const pdir = path2.join(projectsDir, project);
    let names = [];
    try {
      names = fs2.readdirSync(pdir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.toLowerCase().startsWith(loc.sessionPrefix)) continue;
      if (loc.part === "parent" && name.endsWith(".jsonl")) hits.push(path2.join(pdir, name));
      if (loc.part !== "parent" && !name.endsWith(".jsonl")) {
        const f = path2.join(pdir, name, SUBAGENTS_DIR_NAME, `${loc.part}.jsonl`);
        if (fs2.existsSync(f)) hits.push(f);
      }
    }
  }
  return hits;
}
var cap = (s, max) => {
  const clean = sanitizeText(s);
  return clean.length <= max ? clean : `${clean.slice(0, max)} \u2026 (${clean.length - max} more chars)`;
};
var indent = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
function renderRecord(rec, lineNo, calls, max = RECORD_FIELD_MAX) {
  const head = `[${lineNo}] ${typeof rec.timestamp === "string" ? rec.timestamp : "-"} ${String(rec.type ?? "?")}${rec.isMeta ? " (meta)" : ""}${rec.isSidechain ? " (sidechain)" : ""}`;
  const out = [head];
  const content = rec.message?.content;
  if (typeof content === "string") out.push(`  text:
${indent(cap(content, max))}`);
  else if (Array.isArray(content)) {
    for (const b of content) {
      if (b?.type === "text" && typeof b.text === "string") out.push(`  text:
${indent(cap(b.text, max))}`);
      else if (b?.type === "tool_use") out.push(`  tool_use ${String(b.name)} ${String(b.id)}:
${indent(cap(JSON.stringify(b.input ?? {}, null, 1), max))}`);
      else if (b?.type === "tool_result") {
        const call = calls.get(b.tool_use_id);
        const callNote = call ? `${call.name}, call at line ${call.line}` : "call not found above";
        out.push(`  tool_result ${String(b.tool_use_id)} (${callNote}) is_error=${b.is_error === true}:
${indent(cap(textOf(b.content), max * 2))}`);
      } else if (b?.type === "thinking") out.push("  thinking: (omitted)");
      else if (b?.type === "image") out.push("  image: (omitted)");
    }
  } else if (rec.type === "attachment" || rec.attachment) out.push(`  attachment:
${indent(cap(JSON.stringify(rec.attachment ?? {}, null, 1), max))}`);
  else if (typeof rec.content === "string") out.push(`  content:
${indent(cap(rec.content, max))}`);
  if (rec.toolUseResult && typeof rec.toolUseResult === "object" && Array.isArray(content) && content.some((b) => b?.type === "tool_result")) {
    const tur = rec.toolUseResult;
    const brief2 = Object.fromEntries(Object.entries(tur).filter(([, v]) => typeof v !== "object" || v === null).map(([k, v]) => [k, typeof v === "string" ? cap(v, 300) : v]));
    if (Object.keys(brief2).length) out.push(`  toolUseResult: ${JSON.stringify(brief2)}`);
  }
  return out.join("\n");
}
function actorOf(file) {
  if (!isSubagentTranscriptPath(file)) return "main conversation";
  const m = readSubagentMetaSync(subagentMetaPathOf(file), (p) => fs2.readFileSync(p, "utf8"));
  const meta = m === null ? "" : [m.agentType, m.description].filter((x) => typeof x === "string" && x).join(": ");
  return `subagent ${(file.split(/[\\/]/).at(-1) ?? file).replace(/\.jsonl$/, "")}${meta ? ` (${cap(meta, 200)})` : ""}`;
}
async function collectRecords(file, line, around = 0) {
  const span = Math.max(0, Math.min(RECORD_AROUND_MAX, around));
  const from = Math.max(1, line - span);
  const to = line + span;
  const calls = /* @__PURE__ */ new Map();
  const records = [];
  const rl = readline2.createInterface({ input: fs2.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let lineNo = 0;
  try {
    for await (const raw of rl) {
      lineNo++;
      if (lineNo > to) break;
      const inWindow = lineNo >= from;
      if (raw.length > IMPROVEMENT_LINE_MAX_CHARS) {
        if (inWindow) records.push({ line: lineNo, state: "oversized" });
        continue;
      }
      if (!inWindow && !raw.includes('"tool_use"')) continue;
      if (!raw.trim()) {
        records.push({ line: lineNo, state: "empty" });
        continue;
      }
      let rec;
      try {
        rec = JSON.parse(raw);
      } catch {
        rec = void 0;
      }
      if (rec?.type === "assistant" && Array.isArray(rec.message?.content)) {
        for (const b of rec.message.content) if (b?.type === "tool_use") calls.set(b.id, { line: lineNo, name: String(b.name), input: JSON.stringify(b.input ?? {}) });
      }
      if (inWindow) records.push(rec && typeof rec === "object" ? { line: lineNo, rec, state: "record" } : { line: lineNo, state: "unparsable" });
    }
  } finally {
    rl.close();
  }
  return { from, to: Math.min(to, lineNo), lines: lineNo, records, calls };
}
async function extractRecords(file, line, around = 0, max = RECORD_FIELD_MAX) {
  const c = await collectRecords(file, line, around);
  const out = [`== ${file} \xB7 ${actorOf(file)} \xB7 lines ${c.from}..${c.to} ==`];
  const shownCalls = /* @__PURE__ */ new Set();
  for (const r of c.records) {
    if (r.state === "empty" || r.state === "oversized") {
      out.push(`[${r.line}] (${r.state} line)`);
      continue;
    }
    if (r.state === "unparsable" || !r.rec) {
      out.push(`[${r.line}] (unparsable line, possibly the partial last line)`);
      continue;
    }
    const content = r.rec.message?.content;
    if (Array.isArray(content)) {
      for (const b of content) {
        const call = b?.type === "tool_result" ? c.calls.get(b.tool_use_id) : void 0;
        if (call && call.line < c.from && !shownCalls.has(b.tool_use_id)) {
          shownCalls.add(b.tool_use_id);
          out.push(`[${call.line}] matching call ${call.name}:
${indent(cap(call.input, max))}`);
        }
      }
    }
    out.push(renderRecord(r.rec, r.line, c.calls, max));
  }
  if (c.lines < line) out.push(`(file has only ${c.lines} lines)`);
  const text = out.join("\n");
  return text.length <= RECORD_OUTPUT_MAX ? text : `${text.slice(0, RECORD_OUTPUT_MAX)}
\u2026 (output capped; use a smaller --around)`;
}

// src/improvement-cli.ts
function option(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1] !== void 0) out.push(args[++i]);
  return out;
}
var configDirOf = (args) => option(args, "--config-dir")[0] ?? claudeConfigDir();
var EXTENSION_HOST_FOLDERS = [".vscode", ".vscode-insiders", ".vscode-server", ".cursor"];
function installedLaisoraSources(home, list, exists) {
  const folders = EXTENSION_HOST_FOLDERS.flatMap((host) => {
    const dir = path3.join(home, host, "extensions");
    return list(dir).filter((e) => e.name.startsWith(LAISORA_EXTENSION_FOLDER_PREFIX)).map((e) => ({ full: path3.join(dir, e.name), mtimeMs: e.mtimeMs }));
  });
  const newest = folders.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return newest ? LAISORA_SOURCE_FILES.map((parts) => path3.join(newest.full, ...parts)).filter(exists) : [];
}
function listFolders(dir) {
  try {
    return fs3.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => ({ name: e.name, mtimeMs: fs3.statSync(path3.join(dir, e.name)).mtimeMs }));
  } catch {
    return [];
  }
}
async function scan(args) {
  const configDir = configDirOf(args);
  const out = option(args, "--out")[0];
  if (!out) throw new Error("--out is required");
  const projectsDir = path3.join(configDir, "projects");
  const given = option(args, "--laisora-source");
  const laisoraSources = given.length ? given : installedLaisoraSources(os2.homedir(), listFolders, fs3.existsSync);
  const result = await scanTranscripts({ projectsDir, configDir, laisoraSources });
  const ctx = { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), projectsDir };
  const index = renderIndex(result, ctx);
  fs3.mkdirSync(out, { recursive: true });
  fs3.writeFileSync(path3.join(out, IMPROVEMENT_PATTERNS_FILE), patternsJson(result, ctx));
  fs3.writeFileSync(path3.join(out, IMPROVEMENT_INDEX_FILE), index);
  const { mismatches, ...selfCheck } = result.selfCheck;
  return {
    type: "done",
    summary: { indexBytes: Buffer.byteLength(index), patterns: result.patterns.length, hookGroups: result.hookGroups.length, conversations: result.stats.parentFiles, runtimeSec: result.stats.runtimeSec, selfCheck },
    mismatches
  };
}
async function record(args) {
  const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const loc = parseRecordLocation(positional[0] ?? "", positional[1]);
  if (!loc) throw new Error("usage: record <prefix>:<parent|agent-\u2026>:<line> | <file.jsonl>:<line> | <file.jsonl> <line> [--around N] [--max CHARS]");
  const files = resolveRecordFiles(path3.join(configDirOf(args), "projects"), loc);
  if (!files.length) throw new Error(`no transcript file matches ${positional[0]}`);
  const around = Number(option(args, "--around")[0] ?? 0) || 0;
  const max = Number(option(args, "--max")[0] ?? RECORD_FIELD_MAX) || RECORD_FIELD_MAX;
  const parts = [];
  if (files.length > 1) parts.push(`(${files.length} files match; showing each)`);
  for (const f of files.slice(0, 3)) parts.push(await extractRecords(f, loc.line, around, max));
  return parts.join("\n\n");
}
function brief(args) {
  const out = option(args, "--out")[0];
  if (!out) throw new Error("--out is required");
  const dir = path3.resolve(out);
  const language = option(args, "--language")[0] ?? "English";
  const paths = { briefPath: path3.join(dir, IMPROVEMENT_BRIEF_FILE), indexPath: path3.join(dir, IMPROVEMENT_INDEX_FILE), patternsPath: path3.join(dir, IMPROVEMENT_PATTERNS_FILE) };
  if (!fs3.existsSync(paths.indexPath)) throw new Error(`${paths.indexPath} does not exist: run scan --out first`);
  const recordCommand = improvementRecordCommand(process.execPath, path3.resolve(process.argv[1]), configDirOf(args));
  const scope = option(args, "--scope")[0]?.trim();
  fs3.writeFileSync(paths.briefPath, renderImprovementBrief({ ...paths, recordCommand, language, ...scope ? { scope } : {} }));
  return improvementFirstMessage({ ...paths, language });
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "scan") {
    if (process.send) process.once("disconnect", () => process.exit(typeof process.exitCode === "number" ? process.exitCode : 1));
    let message;
    try {
      message = await scan(args);
    } catch (e) {
      message = { type: "failed", error: e instanceof Error ? e.stack ?? e.message : String(e) };
    }
    if (process.send) await new Promise((resolve) => process.send(message, () => resolve()));
    else process.stdout.write(JSON.stringify(message, null, 2) + "\n");
    process.exitCode = message.type === "done" ? 0 : 1;
    if (process.send) process.disconnect?.();
    return;
  }
  if (command === "record") {
    try {
      process.stdout.write(await record(args) + "\n");
    } catch (e) {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}
`);
      process.exitCode = 1;
    }
    return;
  }
  if (command === "brief") {
    try {
      process.stdout.write(brief(args) + "\n");
    } catch (e) {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}
`);
      process.exitCode = 1;
    }
    return;
  }
  process.stderr.write("usage: improvement.mjs scan --out <dir> [--config-dir <dir>] [--laisora-source <file>]... | brief --out <dir> [--language NAME] [--scope TEXT] [--config-dir <dir>] | record <location> [--around N] [--max CHARS]\n");
  process.exitCode = 2;
}
void main();
export {
  installedLaisoraSources
};
