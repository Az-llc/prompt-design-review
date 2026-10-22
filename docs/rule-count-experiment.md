# How many rules at the same time? A small experiment (2026-10-22)

Background material for the plugin's rule-count caution. The report itself does not cite these numbers, because where compliance starts to fall differs between models and likely also with how hard the rules are and how compliance is checked.

## Question

Eliav (2026, preprint, arXiv 2607.19257) reports that the share of responses satisfying every rule falls as the number of rules applied to one response grows, reaching effectively 0 by 80 rules on the five models tested. Does that hold for current Claude models, and does splitting rules into stages help?

## Setup

- Task: write a release note for a fictional app. Output only that text.
- Rules: synthetic and machine-checkable. Three quarters say "Include the word X" (X is a made-up word), one quarter say "Do not use the word Y" (Y is a common word for the task). Scored by exact word matching; no model judged the output.
- Conditions for N rules:
  - A: all N rules apply to the one response.
  - B: the same N rules are split into four stages (outline, release note, internal memo, social post); only the release-note stage, N/4 rules, applies.
  - C: only that stage's N/4 rules are given.
- Calls: `claude -p` from an empty folder with `--safe-mode` and no tools, one turn, 5 runs per cell.
- Models: the aliases `opus`, `sonnet` and `haiku`; a separate call on the same day showed they resolved to `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5` (the runs themselves recorded only the aliases).

## Results

"Perfect" counts runs that followed every applicable rule; the last column lists how many rules each run followed.

| Model | N | Condition | Perfect | Rules followed per run |
|---|---|---|---|---|
| Opus | 20 | A | 5/5 | all |
| Opus | 40 | A | 5/5 | all |
| Opus | 80 | A | 5/5 | all |
| Opus | 100 | A | 4/5 | 99, 100, 100, 100, 100 |
| Opus | 200 | A | 3/5 | 200, 199, 200, 200; one run declined to write (47) |
| Opus | 400 | A | 1/5 | 400, 394, 399, 398, 397 (359 distinct rules: bans repeat after 59 words, and a repeated ban is counted per copy) |
| Opus | 200 | B (50 apply) | 5/5 | all |
| Opus | 200 | C (50 given) | 5/5 | all |
| Sonnet | 200 | A | 4/5 | 200, 200, 200, 199, 200 |
| Haiku | 200 | A | 0/5 | 196, 199, 199, 198, 196 |

Conditions B and C at N = 20, 40 and 80 on Opus were also 5/5.

## What it suggests

- The direction holds: with more rules applied at once, more runs miss something.
- For these simple rules, Opus held up well beyond 80; Sonnet and Haiku were tested only at 200. Misses arrive gradually, a few rules at a time. Occasionally the whole response fails (one refusal).
- Most misses at 100 rules and above (about 21 of 23) were bans on words the task naturally uses (thanks, quick, support, update and so on); which exact word varied.
- Rules that are loaded but do not apply to the current stage did no visible harm at this load (B equals C), though Opus also met 80 rules all at once, so this setting may be too easy to show harm.
- Output can bend to meet the rules: Sonnet met 200 rules with short texts (about 220 to 470 words), while Opus wrote full release notes (about 1,100 to 1,300 words).

## Limits

- The rules are trivial word rules. Eliav's prompts also carried five fixed, harder format rules at every N (an exact word-count range, an exact closing sentence, an exact first word, no exclamation marks, an exact paragraph count), and tested earlier or smaller models (Claude Sonnet 5, Claude Haiku 4.5, Gemini 3.5 Flash, two Qwen models). The gap between 80 there and well beyond 80 here mixes model generation and rule difficulty. Rules that need judgment are likely to fail earlier still; this was not measured.
- Five runs per cell show the trend only.
- One task, one turn, one day, through Claude Code; other prompts, tools or settings may differ.

These limits are why the plugin's guide of 40 is its own choice, and why the report gives the direction of the effect rather than a number.
