---
name: write
description: Writes the first draft of a Japanese technical blog article (Zenn and similar sites) from the records of finished work. Before any prose is written, it gives the writer the author's own remarks from the conversations of that work, a claim outline checked against the numbers in the records, and a title the author picks from angles that differ. A fresh subagent that knows nothing about the work writes the draft, another reads it, and the places the reader raises are fixed once. Run by the user with /blog-first-draft:write.
license: Complete terms in LICENSE (MIT)
disable-model-invocation: true
---

## What this skill does

The draft is decided before it is written. You do not write the article yourself: you have the context of the work, so words that only make sense inside it would pass through you unnoticed. You prepare what the writer receives, and subagents that start with no context do the writing and the reading.

The steps are: collect the material and the author's remarks, outline the claims and check them against the numbers, let the author pick a title, write the opening alone and let the author settle it, write the rest, have one reader read the draft, fix everything the reader raised once, and report.

The reader is one, and gets no persona. What the article reads like is decided by what the writer was given, so the reading step is kept small. On one draft, five readers with different professions raised about a hundred places, and the author did not prefer the fixed article to the unfixed one. A reader told to read as the target reader raised the same kinds of places as a reader told nothing. A single capable reader with no persona found contradictions between the text and its tables, words used without explanation, and missing reasons, and the author preferred that result.

All raised places go to the fix at once. Narrowing them down first made the article worse: the dropped places were mostly the reasons and concrete hints readers valued.

It does not polish style after the fact and holds no list of words to avoid.

## Limits to tell the user before starting

- It has been checked on technical articles in Japanese written from work records. Other kinds of documents are untested.
- Subagents load the project's instruction files like any agent in the project, so they are free of the conversation's context, not of the project's rules.
- The author's remarks come from the conversation records that still exist. Claude Code deletes a record that has not been modified for longer than its `cleanupPeriodDays` setting.
- One run starts about five subagents (one outline, one opening, one draft, one reader, one fix). Say so and wait for the user's go-ahead.

## What to ask the user first

Ask only for what the user has not already given:

1. The record files of the work (notes, logs, measurement results). These are the material.
2. Which conversations the work happened in: session ids, or a text that appears in them such as a file or folder name of the work.
3. The site the article is for, and who reads it, as one clause that can follow "読者は、" (for example "Claude Code を使っていて CLAUDE.md・hook・サブエージェントが何かは知っています").
4. The one sentence the article must leave with the reader. Without it, the outline takes as the core whatever the records spend the most pages on, which is often one experiment rather than the point the author cares about.
5. Why the author set out to do this work or write this article, in a few sentences of the author's own. The opening is built on it. If the author cannot say yet, go on; the opening step asks again with a draft to react to.
6. A title, if the author has already decided one.
7. Any requests about the article (what to open with, what to leave out). Optional.
8. Who writes the body. By default a subagent writes it. The user may instead have another model or tool of their own write it: the skill then prepares the writing prompt as one file, the user passes it on and puts the returned article in the working folder. Say that this file holds the whole material and the remarks, so whether it may go to an outside service is the user's call. The same preparation gave readable drafts from different models, and which body the author liked best depended on the model.

## Procedure

Use one working folder for the run: create it under the system temporary folder and use its printed path unchanged in every step. Write files with the Write tool, not through the shell. `${CLAUDE_SKILL_DIR}/scripts/draft.py` is called `draft.py` below; run it with `python`.

1. Material. Join the record files into `<work>/material.md` in the order the user gave, each under a line naming the file. Do not summarise or reword them.
2. Remarks. Run `draft.py remarks --out <work>/remarks.md` with `--session <id>` for each id or `--touching "<text>"` for each text, and `--since <date>` if the work has a known start. It finds the records from the shell's current folder, so run it from the folder the conversation was started in; if it reports no conversation records, pass that folder's record folder with `--project-dir`. It prints the conversations used and the number of remarks. If the number is zero, tell the user and continue with a file that says "（なし）". Read the remarks file and remove the remarks that belong to other work; remove nothing else and reword nothing.
3. Notes. Write `<work>/notes.md`: first the line `- 記事の芯（読者に残したい 1 文）: <the sentence>`, then `- 著者がこれに取り組んだ理由（著者の言葉）: <the author's sentences, unchanged>` when given, then the user's requests, one per line, in the user's words. Do not add wording of your own to the notes: a phrase you write there becomes the article's vocabulary.
4. Outline prompt. If the author gave a title, first fill the title part:
   `draft.py fill --template "${CLAUDE_SKILL_DIR}/prompts/title_given.md" --out <work>/title_part.md --text "title=<title>"`
   Otherwise use `${CLAUDE_SKILL_DIR}/prompts/title_propose.md` as the title part. Then:
   `draft.py fill --template "${CLAUDE_SKILL_DIR}/prompts/outline.md" --out <work>/outline_prompt.md --text "site=<site>" --text "reader=<reader>" --file material=<work>/material.md --file remarks=<work>/remarks.md --file notes=<work>/notes.md --file title_part=<title part file>`
5. Outline. Start one subagent with exactly this task: "Read the file <work>/outline_prompt.md and do what it says. Write your whole answer to <work>/outline.md with the Write tool. Open no other file. Reply only: done." Use this same form, with the paths changed, for every subagent below.
6. Title. Read `<work>/outline.md`.
   - No title was given: show the user the four titles with the one-line angle behind each, and ask which to use. The user may pick one, change its wording, or ask for another round (repeat step 5 into a new file).
   - A title was given: if the outline lists words of the title that do not match the numbers, show them to the user at delivery; do not stop here. Do not change the title yourself.
   - The author's thinking. The outline marks with "（発言に無い）" each thing the author tried where the remarks do not say why the author chose that move. If there are any, list them to the user in one message (what was done) and ask for one or two sentences each on why they went that way. Append the answers verbatim to `<work>/remarks.md` under the line `[著者に後から聞いた]`, and in `<work>/outline.md` replace each "（発言に無い）" with the answer for that turn, unchanged. Ask in the same message as the title question when there is one. The article is flat without these: the steps read as a list of what was done, and the reader cannot see why one led to the next.
7. Opening. Fill `prompts/opening.md` into `<work>/opening_prompt.md` with `site`, `reader`, `title` as text and `outline`, `material`, `remarks`, `notes` as files. Start one subagent that writes `<work>/opening.md`. Show the author the opening in full and ask what to change. Apply each change to the sentences the author names, in the author's wording where given, and show the result again; repeat until the author says it is settled. When the author's change shows a motive or a view that the notes lack, add it to `<work>/notes.md` in the author's words. Settling the opening first is cheaper than rewriting the whole article: once the author's reason for the work is on the page, the order of the rest follows from it.
8. Draft. Fill `prompts/write.md` into `<work>/write_prompt.md` with `site`, `reader`, `title` as text and `opening`, `outline`, `material`, `remarks`, `notes` as files. Start one subagent that writes `<work>/article_first.md`. If the user chose to have another model or tool write the body, do not start a subagent: give the user the path of `<work>/write_prompt.md`, ask them to save the returned article as `<work>/article_first.md` in UTF-8, and wait until they say it is there. Run `draft.py same-opening --opening <work>/opening.md --article <work>/article_first.md`; if it reports a difference, start the draft subagent once more, or, when the body was written elsewhere, put the settled opening back yourself and change nothing after it.
9. Reader. Fill `prompts/read_plain.md` into `<work>/read_prompt.md` with `site` and `reader` as text and `article` from `<work>/article_first.md`. Start one subagent that writes `<work>/reading.md`. The reader gets the article and nothing else. Run it on the most capable model you can start. If a subagent wrote the draft and you cannot start a model more capable than it, skip steps 9 to 11 and deliver the first draft: the author preferred an untouched draft to one fixed from a weaker reading. If the body was written elsewhere, always run the reader on the most capable model you can start.
10. Panel. Run `draft.py panel --out <work>/panel.md --reader "読んだ人=<work>/reading.md"`. It prints the number of places the reader raised.
11. Fix. If the reader raised nothing, copy the first draft as the final article. Otherwise fill `prompts/fix.md` (`panel`, `notes`, `article`, `material`, `remarks` as files) and start one subagent that writes `<work>/article.md`. Fix once; do not send the result to a reader again. Run `draft.py same-opening --opening <work>/opening.md --article <work>/article.md`; if it reports a difference, put the settled opening back yourself.
12. Deliver. Copy the final article to where the user wants it, with the front matter the site needs. Report: the title, where the article is, how many places the reader raised, the places the reader raised in the settled opening (left unchanged, for the author to decide), and the places the outline rewrote because a number did not fit. The fix may change the title when that makes it fit the article and more inviting; if the first line differs from the title the author gave, show both and ask which to keep. Then delete the working folder and say that you did.

If a subagent replies with anything other than "done", or its output file is missing or empty, start it once more; if it fails again, report which step failed and stop.

## What not to do

- Do not write or reword the article in the main conversation, before or after the steps. If the user asks for a change after delivery, change the notes and run steps 8 to 11 again, or edit only the sentence the user names.
- Do not change a part the author has settled. When later work would touch it, ask first.
- When the author asks to remove a sentence, a bracketed note or a caveat, remove it. Do not move it to another place in the article.
- When you edit a sentence the author names, keep the style of the sentences around it.
- Do not add notes of caution to the article on your own. The reader's question is what does not reach a reader, not what is stronger than the numbers; asking the second always finds something, and every round of fixes adds caveats.
- Do not shorten the material to save tokens. What the writer is not given, it invents.
