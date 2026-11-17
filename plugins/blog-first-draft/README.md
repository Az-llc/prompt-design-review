# blog-first-draft

A Claude Code plugin that writes the first draft of a Japanese technical blog article (Zenn and similar sites) from the records of finished work. It prepares what the writer is given before any prose is written.

[日本語版 README](README.ja.md)

## What it does

Instead of fixing the text afterwards, it prepares these before writing:

- **Your own remarks from the work.** A script collects the author's messages from the Claude Code conversation records. Why you tried something and how you took the result rarely survive in work notes; they are in what you said at the time.
- **A claim outline.** The most surprising point, the questions a reader asks in order with their answers, where each answer comes from, the numbers that do not fit an answer, and what to leave out. It is made before the prose, and wording that does not fit the numbers is corrected there.
- **The title and the opening.** You pick the title from angles that differ. The opening is written alone and revised until you are satisfied; only then is the rest written.

The body is written by a subagent that knows nothing about the work. A writer that holds the conversation lets words that only make sense inside it pass into the article unnoticed. After that, another subagent that also knows nothing reads the draft once, and the places it raises are fixed once.

It holds no list of words to avoid and does not polish style after the fact.

## Limits

- It has been checked only on Japanese technical articles written from work records. Other kinds of documents are untested.
- Subagents load the project's instruction files (CLAUDE.md and the like). What they lack is the conversation's context, not the project's rules.
- Remarks can be collected only from conversation records that still exist. Claude Code deletes a record that has not been modified for longer than `cleanupPeriodDays`.
- One run starts about five subagents. Three of the steps receive the whole material, so usage grows with the length of the material.
- The reading step runs only when a model more capable than the one that wrote the body can be started. Otherwise the first draft is delivered as it is.

## Having another model write the body

At the start the skill asks who writes the body. By default a subagent does.

If you want another model or service to write it, say so. The skill puts the writing prompt into one file and waits. Pass that file on, save the returned article into the working folder, and the skill continues.

The prompt file contains the whole material and your remarks. Whether it may go to an outside service is your call.

Another model may not follow the writing instructions in the prompt. When this was checked, it added a diagram although the prompt said not to, and changed a few characters of the settled opening. The skill puts the opening back; it does not restore anything else.

## Install

```text
/plugin marketplace add Az-llc/prompt-design-review
/plugin install blog-first-draft@az-llc
```

## Usage

```text
/blog-first-draft:write
```

The skill runs only when you type this command; Claude does not start it on its own.

It then asks for: the record files of the work, the conversations the work happened in, the site and its readers, the one sentence the article must leave with the reader, why you took on the work, a title if you have one, any requests about the article, and who writes the body.

## Prerequisites

- Claude Code
- Python 3.10 or later

The script makes no network request. It reads the local conversation records and the files you name, and writes only into the working folder, which is created under the system temporary folder and deleted after the article is delivered.

## Updates

This is the procedure checked while writing articles, put into a plugin as it is. No updates are promised. Changes the author makes while using it may be reflected.

## Provider

Az LLC — https://www.az-llc.com/ (MIT License)
