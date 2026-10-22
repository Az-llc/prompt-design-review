#!/usr/bin/env python3
"""Mechanical checks for prompt assets (SKILL.md, CLAUDE.md, rules, agent definitions, prompts).

Usage:
  python check.py [--warn-rules N] [--root DIR] [--strict] [--no-context] PATH [PATH ...]
  python check.py --self-test

PATH may be a file or a directory (directories are scanned for *.md).
stdout line 1: one JSON object. Following lines: human summary.
Per file, rule_load adds the directive sentences of the instruction files Claude Code loads at session
start with a working folder of the file's folder: CLAUDE.md and CLAUDE.local.md of that folder and its
ancestors; .claude/CLAUDE.md and .claude/rules/**/*.md without `paths` of the project root (nearest
ancestor with .git, else the file's folder); ~/.claude/CLAUDE.md and ~/.claude/rules/**/*.md without
`paths`; the managed policy CLAUDE.md; and their @path imports (up to 4 hops, each file once). Each
loaded_with entry has path, source (managed | user | ancestor | project | import), imported_by for
imports, and directive_sentences or error. rule_load.not_counted lists what is left out.
directive_candidates lists the target's counted sentences (line, text up to 160 chars) so a reader can
confirm which are rules; the count itself is by wording only.
--no-context leaves loaded_with empty, for CI or hooks whose machine differs from the author's.
Exit: 0 ran (findings do not fail unless --strict), 1 --strict with findings or self-test mismatch,
2 wrong arguments, missing PATH or unreadable --root. A file that cannot be read as UTF-8 is reported
in its own entry ("error") and counts as a finding; the scan continues.
--strict ignores over_threshold and duplicates (warnings / info).
Exit-code hooks in Claude Code block only on exit 2 and pass stderr to Claude, so a hook wraps it:
  python check.py --strict PATH 1>&2 || exit 2
Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path

VERSION = "1.0.1"
CANDIDATE_TEXT_MAX = 160
DEFAULT_WARN_RULES = 40
THRESHOLD_NOTE = (
    "Directive sentences are an estimate of the rule count, found by wording, so some rules are missed "
    "or miscounted. loaded_with is what Claude Code would load together with the target on this machine; "
    "the total counts rules loaded together; the rules that must be followed in one response can be "
    "fewer, and only a reading of each rule's stage can tell. "
    f"The guide (default {DEFAULT_WARN_RULES}, --warn-rules) is this tool's own choice, not a value from "
    "a study. Eliav (2026, preprint, arXiv 2607.19257) shows that compliance falls as more rules apply to "
    "one response and that where it starts differs between models; that it also shifts with how hard the "
    "rules are is this tool's judgment."
)
# Agent Skills frontmatter limits (Anthropic skill authoring docs).
NAME_MAX = 64
DESCRIPTION_MAX = 1024
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

FENCE_RE = re.compile(r"^\s*(```|~~~)")
HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s")
TABLE_SEP_RE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")
TAG_ONLY_RE = re.compile(r"^\s*</?[A-Za-z_][\w\-]*(\s+[^<>]*)?>\s*$")
BULLET_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s+")
HISTORY_COMMENT_RE = re.compile(r"<!--\s*v\d+\.\d+", re.I)
HISTORY_COMMENTS_ALLOWED = 1

# Directive detection. Japanese: sentence-final plain/request/obligation forms; descriptive endings excluded.
JA_DIRECTIVE_END = re.compile(r"(?:[うくすつぬむぶぐる]|ない|こと|ください|べき|よい|限る|とする)$")
# れます only after an a-row kana (書かれます, not 入れます) and います not after a kanji stem (not 行います,
# 使います): those polite verbs are directives.
JA_DESCRIPTIVE_END = re.compile(
    r"(?:である|ている|てある|がある|もある|にある|となる|になる|られる|できる|"
    r"ではない|(?<!べき)でない|ていない|されない|られない|限らない|できない|"
    r"です|でした|ません|ました|[あかがさざただなはばぱまらわ]れます|られます|できます|あります|"
    r"(?<![一-鿿])います|なります)$")
# The noun 禁止 ("prohibition", as in 「禁止の理由」) is not a rule; only the predicate or a sentence-final 禁止 is.
JA_BAN_PREDICATE = r"禁止(?:する|すること|します|とする|とします|です|だ)?(?=[。！（(]|$)"
JA_DIRECTIVE_ANY = re.compile(
    r"必ず|常に|すること|しないこと|してください|厳守|" + JA_BAN_PREDICATE +
    r"|てはならない|てはいけない|べきでない|べきではない")
QUOTED_JA_RE = re.compile(r"「[^」]*」|『[^』]*』")
EN_DIRECTIVE_ANY = re.compile(
    r"\b(?:must|should|never|always|do not|don't|avoid|ensure|make sure|only)\b", re.I)
EN_IMPERATIVE_START = re.compile(
    r"^(?:use|keep|write|return|run|read|state|report|add|remove|include|put|stop|ask|check|prefer|give|"
    r"list|flag|mark|treat|leave|follow|set|record|quote|propose|apply|skip|call|invoke|load|tell|say|"
    r"send|pass|move|show|do|make|find|verify|cite|limit|replace)\b", re.I)

JA_PROHIBITION = re.compile(
    r"するな|" + JA_BAN_PREDICATE + r"|不可|てはならない|てはいけない|べきでない|べきではない|しないこと|しないで|"
    r"[ぁ-ん]ない(?:こと)?$|避け(?:る|ること)$|控え(?:る|ること)$")
EN_PROHIBITION = re.compile(
    r"\b(?:never|do not|don't|must not|mustn't|should not|shouldn't|avoid|forbidden|prohibited|not allowed)\b",
    re.I)

TRAILING_PUNCT = "。．.!！?？:：;；、,)）」』】]*_`\"' \t"

INLINE_CODE_RE = re.compile(r"`([^`\n]+)`")
BARE_PATH_RE = re.compile(r"(?<![\w/.\-$])((?:\.{1,2}/)?[A-Za-z0-9_.\-]+(?:[/\\][A-Za-z0-9_.\-]+)+[/\\]?)")
# Japanese prose has no spaces between words, so a non-ASCII path is taken only when it is delimited
# by whitespace, brackets or punctuation and ends in an extension; otherwise whole clauses match.
_NA_SEG = r"[\w.\-]+"
NONASCII_PATH_RE = re.compile(
    r"(?:^|(?<=[\s「『（(\[、。：:]))((?:\.{1,2}/)?" + _NA_SEG + r"(?:[/\\]" + _NA_SEG + r")+"
    r"\.[A-Za-z][A-Za-z0-9]{0,5})(?=$|[\s」』）)\]、。：:])")
EXT_RE = re.compile(r"\.[A-Za-z][A-Za-z0-9]{0,5}$")
PLACEHOLDER_CHARS = set("<>{}*$%?|[]")

# Claude Code memory docs: imports skip code spans and fenced blocks, "\ " escapes a space, a quoted
# path is not imported, and imports nest at most four hops.
IMPORT_MAX_HOPS = 4
IMPORT_RE = re.compile(r"(?<![\w@])@((?:\\ |[^\s\"'])+)")
CODE_SPAN_RE = re.compile(r"(`+)(?!`).*?(?<!`)\1(?!`)")
IMPORT_TRAILING = ".,;:!?)]}"
NOT_COUNTED = [
    "auto memory (MEMORY.md)",
    "AGENTS.md",
    "rules with paths frontmatter (load on demand)",
    "CLAUDE.md and rules in subfolders (load on demand)",
    "claudeMd in managed settings",
    "claudeMdExcludes, --setting-sources and the Project instructions setting",
    "skills, agents and output styles",
]


def strip_frontmatter(lines: list[str]) -> tuple[dict | None, list[str], int, list[str]]:
    """Return (frontmatter dict or None, raw frontmatter lines, body start index, parse issues)."""
    if not lines or lines[0].strip() != "---":
        return None, [], 0, []
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            raw = lines[1:i]
            return parse_simple_yaml(raw), raw, i + 1, []
    return None, [], 0, ["frontmatter opened with '---' but never closed"]


def parse_simple_yaml(raw: list[str]) -> dict:
    """Top-level 'key: value' pairs; block scalars (| >) and folded continuation lines are joined."""
    data: dict[str, str] = {}
    key = None
    for line in raw:
        m = re.match(r"^([A-Za-z_][\w\-]*):\s*(.*)$", line)
        if m:
            key = m.group(1)
            val = m.group(2).strip()
            data[key] = "" if val in ("|", ">", "|-", ">-") else val.strip("\"'")
        elif key and line.startswith((" ", "\t")):
            data[key] = (data[key] + " " + line.strip()).strip()
    return data


def is_git_root(p: Path) -> bool:
    git = p / ".git"
    # An empty stray .git folder is not a repository; a real one is a gitdir file or holds HEAD.
    return git.is_file() or (git / "HEAD").exists()


def find_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if is_git_root(p):
            return p
        # An installed plugin is a cache copy without .git; its manifest marks the root.
        if (p / ".claude-plugin" / "plugin.json").is_file():
            return p
    return start


def classify_body(lines: list[str], start: int):
    """Yield (lineno, text, kind) for body lines. kind: 'prose', 'code', 'comment', 'structural'."""
    in_fence = False
    in_comment = False
    for idx in range(start, len(lines)):
        line = lines[idx]
        no = idx + 1
        if in_comment:
            yield no, line, "comment"
            if "-->" in line:
                in_comment = False
            continue
        if FENCE_RE.match(line):
            in_fence = not in_fence
            yield no, line, "code"
            continue
        if in_fence:
            yield no, line, "code"
            continue
        stripped = line.strip()
        if stripped.startswith("<!--"):
            yield no, line, "comment"
            if "-->" not in stripped:
                in_comment = True
            continue
        if (not stripped or HEADING_RE.match(line) or TABLE_SEP_RE.match(line)
                or TAG_ONLY_RE.match(line)):
            yield no, line, "structural"
            continue
        yield no, line, "prose"


def plain(text: str) -> str:
    t = re.sub(r"<!--.*?-->", "", text)
    t = BULLET_RE.sub("", t)
    t = t.strip().strip("|").strip()
    return t.rstrip(TRAILING_PUNCT)


def is_instruction(text: str) -> bool:
    t = plain(text)
    if not t:
        return False
    if JA_DIRECTIVE_ANY.search(t) or EN_DIRECTIVE_ANY.search(t):
        return True
    for sent in re.split(r"(?<=[。！？])", t):
        s = sent.rstrip(TRAILING_PUNCT)
        if s and JA_DIRECTIVE_END.search(s) and not JA_DESCRIPTIVE_END.search(s):
            return True
    return bool(EN_IMPERATIVE_START.match(t))


def is_prohibition(text: str) -> bool:
    # Quoted words (「〜禁止」) are mentions, not rules.
    t = QUOTED_JA_RE.sub("", plain(text))
    if not t:
        return False
    if EN_PROHIBITION.search(t):
        return True
    for sent in re.split(r"(?<=[。！？])", t):
        s = sent.rstrip(TRAILING_PUNCT)
        if JA_PROHIBITION.search(s) and not (JA_DESCRIPTIVE_END.search(s) and not JA_DIRECTIVE_ANY.search(s)):
            return True
    return False


def path_candidates(text: str) -> list[str]:
    found: list[str] = []
    for m in INLINE_CODE_RE.finditer(text):
        for tok in m.group(1).split():
            tok = tok.strip("\"'(),;:")
            if ("/" in tok or "\\" in tok or EXT_RE.search(tok)) and not tok.startswith("-"):
                found.append(tok)
    outside = INLINE_CODE_RE.sub(" ", text)
    for m in BARE_PATH_RE.finditer(outside):
        tok = m.group(1)
        if EXT_RE.search(tok) or tok.endswith(("/", "\\")) or tok.startswith("."):
            found.append(tok)
    for m in NONASCII_PATH_RE.finditer(outside):
        tok = m.group(1)
        if not tok.isascii():
            found.append(tok)
    return found


def skip_reason(tok: str) -> str | None:
    if "://" in tok or tok.startswith(("http", "www.")):
        return "url"
    if any(c in PLACEHOLDER_CHARS for c in tok) or "..." in tok:
        return "placeholder"
    if tok.startswith(("/", "~", "\\")) or re.match(r"^[A-Za-z]:[/\\]", tok) or tok.startswith("%"):
        return "external"
    if "=" in tok or tok.startswith("@"):
        return "not-a-path"
    if re.fullmatch(r"[\d./\\]+", tok):
        return "not-a-path"
    return None


def resolve(tok: str, file_dir: Path, root: Path) -> bool:
    rel = tok.rstrip("/\\").replace("\\", "/")
    if not rel:
        return True
    bases = [file_dir]
    for p in file_dir.parents:
        bases.append(p)
        if p == root:
            break
    if root not in bases:
        bases.append(root)
    return any((b / rel).exists() for b in bases)


def norm_sentence(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[`*_\"'「」『』（）()\[\]【】]", "", s)
    s = re.sub(r"\s+", " ", s).strip().rstrip(TRAILING_PUNCT).lower()
    return s


def split_sentences(line: str) -> list[str]:
    return re.split(r"(?<=[。！？])|(?<=[.!?])\s+", plain(line))


def count_directives(line: str) -> int:
    return sum(1 for s in split_sentences(line) if is_instruction(s))


def read_error(e: Exception) -> str:
    if isinstance(e, UnicodeDecodeError):
        return f"not UTF-8 ({e.reason} at byte {e.start})"
    if isinstance(e, OSError):
        return f"unreadable ({e.strerror or e})"
    return f"{type(e).__name__}: {e}"


def scan_instruction_file(path: Path) -> tuple[int, bool, list[str]]:
    """Return (directive sentences in the body, frontmatter declares `paths`, raw @import paths)."""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    fm, _, body_start, _ = strip_frontmatter(lines)
    n = 0
    imports: list[str] = []
    for _, line, kind in classify_body(lines, body_start):
        if kind == "prose":
            n += count_directives(line)
        if kind not in ("code", "comment"):
            imports.extend(m.group(1).replace("\\ ", " ")
                           for m in IMPORT_RE.finditer(CODE_SPAN_RE.sub(" ", line)))
    return n, fm is not None and "paths" in fm, imports


def managed_policy_path() -> Path:
    if sys.platform == "win32":
        return Path(r"C:\Program Files\ClaudeCode\CLAUDE.md")
    if sys.platform == "darwin":
        return Path("/Library/Application Support/ClaudeCode/CLAUDE.md")
    return Path("/etc/claude-code/CLAUDE.md")


def resolve_import(raw: str, base_dir: Path, home: Path | None) -> Path:
    def to_path(s: str) -> Path:
        if home is not None and (s == "~" or s.startswith(("~/", "~\\"))):
            return home / s[2:]
        p = Path(s)
        return p if p.is_absolute() else base_dir / p

    path = to_path(raw)
    trimmed = raw.rstrip(IMPORT_TRAILING)
    if trimmed and trimmed != raw and not path.is_file():
        return to_path(trimmed)
    return path


def rule_files(rules_dir: Path, source: str, out: list[dict]) -> list[Path]:
    def onerror(e: OSError):
        out.append({"path": e.filename or str(rules_dir), "source": source, "error": read_error(e)})

    found: list[Path] = []
    if not rules_dir.is_dir():
        return found
    visited: set[str] = set()
    for dirpath, dirnames, filenames in os.walk(rules_dir, onerror=onerror, followlinks=True):
        real = os.path.realpath(dirpath)
        if real in visited:
            dirnames[:] = []
            continue
        visited.add(real)
        dirnames.sort()
        found.extend(Path(dirpath) / f for f in sorted(filenames) if f.endswith(".md"))
    return found


def loaded_with(target: Path, home: Path | None, top: Path | None, managed: Path | None,
                cache: dict) -> list[dict]:
    folder = target.parent
    chain: list[Path] = []
    for p in [folder, *folder.parents]:
        chain.append(p)
        if top is not None and p == top:
            break
    project = next((p for p in chain if is_git_root(p)), folder)
    seen = {target}
    out: list[dict] = []

    def add(path: Path, source: str, is_rule: bool = False, depth: int = 0, imported_by: str | None = None):
        try:
            if not path.is_file():
                return
            rp = path.resolve()
        except (OSError, ValueError) as e:
            out.append({"path": str(path), "source": source, "error": read_error(e)})
            return
        if rp in seen:
            return
        if rp not in cache:
            try:
                cache[rp] = scan_instruction_file(rp)
            except (UnicodeDecodeError, OSError) as e:
                cache[rp] = read_error(e)
        v = cache[rp]
        entry = {"path": str(rp), "source": source}
        if imported_by:
            entry["imported_by"] = imported_by
        if isinstance(v, str):
            seen.add(rp)
            out.append({**entry, "error": v})
            return
        n, has_paths, imports = v
        if is_rule and has_paths:
            return
        seen.add(rp)
        out.append({**entry, "directive_sentences": n})
        if depth < IMPORT_MAX_HOPS:
            for raw in imports:
                try:
                    nxt = resolve_import(raw, path.parent, home)
                except (OSError, ValueError):
                    continue
                add(nxt, "import", depth=depth + 1, imported_by=str(rp))

    try:
        own = cache.setdefault(target, scan_instruction_file(target))
    except (UnicodeDecodeError, OSError):
        own = None
    if isinstance(own, tuple):
        for raw in own[2]:
            try:
                add(resolve_import(raw, target.parent, home), "import", depth=1, imported_by=str(target))
            except (OSError, ValueError):
                continue
    if managed is not None:
        add(managed, "managed")
    if home is not None:
        add(home / ".claude" / "CLAUDE.md", "user")
        for f in rule_files(home / ".claude" / "rules", "user", out):
            add(f, "user", is_rule=True)
    for p in reversed(chain):
        add(p / "CLAUDE.md", "ancestor")
        add(p / "CLAUDE.local.md", "ancestor")
    add(project / ".claude" / "CLAUDE.md", "project")
    for f in rule_files(project / ".claude" / "rules", "project", out):
        add(f, "project", is_rule=True)
    return out


def check_file(path: Path, root: Path, warn_rules: int, dup_min: int,
               context: list[dict] | None = None, context_error: str | None = None) -> dict:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines()
    fm, fm_raw, body_start, fm_issues = strip_frontmatter(lines)
    directives = 0
    candidates: list[dict] = []
    instr, prohib = [], []
    missing, skipped = [], {}
    history = []
    sentences: dict[str, list[int]] = {}

    for no, line, kind in classify_body(lines, body_start):
        if kind == "comment":
            if HISTORY_COMMENT_RE.search(line):
                history.append(no)
            continue
        if kind in ("prose", "code"):
            for tok in path_candidates(line):
                reason = skip_reason(tok)
                if reason:
                    skipped[reason] = skipped.get(reason, 0) + 1
                elif not resolve(tok, path.parent, root):
                    missing.append({"line": no, "path": tok})
        if kind != "prose":
            continue
        if is_instruction(line):
            instr.append(no)
        if is_prohibition(line):
            prohib.append(no)
        for sent in split_sentences(line):
            if is_instruction(sent):
                directives += 1
                candidates.append({"line": no, "text": sent.strip()[:CANDIDATE_TEXT_MAX]})
            key = norm_sentence(sent)
            if len(key) >= dup_min:
                sentences.setdefault(key, []).append(no)

    duplicates = [{"text": k[:80], "lines": v} for k, v in sentences.items() if len(v) > 1]

    frontmatter: dict = {"present": fm is not None, "issues": list(fm_issues)}
    is_skill = path.name.lower() == "skill.md"
    # Rule files carry only `paths:`; name/description are required for SKILL.md and for any
    # frontmatter that declares either key (skills under another file name, agent definitions).
    if fm is not None and (is_skill or "name" in fm or "description" in fm):
        name = fm.get("name", "")
        desc = fm.get("description", "")
        frontmatter.update({"name": name, "description_chars": len(desc)})
        if not name:
            frontmatter["issues"].append("name missing or empty")
        elif len(name) > NAME_MAX or not NAME_RE.match(name):
            frontmatter["issues"].append(f"name not lowercase-hyphen or over {NAME_MAX} chars")
        if not desc:
            frontmatter["issues"].append("description missing or empty")
        elif len(desc) > DESCRIPTION_MAX:
            frontmatter["issues"].append(f"description over {DESCRIPTION_MAX} chars ({len(desc)})")
        if is_skill and name and name != path.parent.name:
            frontmatter["issues"].append(f"name '{name}' differs from folder '{path.parent.name}'")
    if fm is not None:
        lic = fm.get("license", "")
        if "LICENSE" in lic and not any((p / "LICENSE").exists()
                                        for p in [path.parent, *path.parent.parents]
                                        if p == root or root in p.parents):
            frontmatter["issues"].append("license field names LICENSE but no LICENSE file up to root")
    elif is_skill:
        frontmatter["issues"].append("SKILL.md has no frontmatter")

    context = context or []
    context_total = sum(c.get("directive_sentences", 0) for c in context)
    total = directives + context_total
    rule_load = {"target": directives, "loaded_with": context, "loaded_with_total": context_total,
                 "total": total, "over_threshold": total > warn_rules, "not_counted": NOT_COUNTED}
    if context_error:
        rule_load["context_error"] = context_error
    return {
        "path": str(path),
        "instruction_lines": len(instr),
        "directive_sentences": directives,
        "directive_candidates": candidates,
        "prohibition_lines": len(prohib),
        "rule_load": rule_load,
        "over_threshold": rule_load["over_threshold"],
        "prohibition_line_numbers": prohib,
        "missing_paths": missing,
        "skipped_paths": skipped,
        "duplicates": duplicates,
        "history_comment_lines": history,
        "history_over_limit": len(history) > HISTORY_COMMENTS_ALLOWED,
        "frontmatter": frontmatter,
    }


def collect(paths: list[str]) -> list[Path]:
    out: list[Path] = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            out.extend(sorted(x for x in pp.rglob("*.md") if x.is_file()))
        elif pp.is_file():
            out.append(pp)
        else:
            raise FileNotFoundError(p)
    return out


def has_findings(r: dict) -> bool:
    if "error" in r:
        return True
    return bool(r["missing_paths"] or r["history_over_limit"] or r["frontmatter"]["issues"])


def summary(results: list[dict], warn_rules: int) -> str:
    out = []
    for r in results:
        out.append(f"== {r['path']}")
        if "error" in r:
            out.append(f"  not checked: {r['error']}")
            continue
        rl = r["rule_load"]
        flag = "  WARN over guide" if rl["over_threshold"] else ""
        out.append(f"  rules (directive sentences) {rl['target']}; loaded with it {rl['loaded_with_total']} "
                   f"in {len(rl['loaded_with'])} files; total loaded {rl['total']} / guide {warn_rules}{flag}; "
                   f"prohibition lines {r['prohibition_lines']}")
        if "context_error" in rl:
            out.append(f"  loaded-with scan stopped: {rl['context_error']}")
        for c in rl["loaded_with"]:
            if "error" in c:
                out.append(f"  loaded-with file not counted: {c['path']}: {c['error']}")
        for m in r["missing_paths"]:
            out.append(f"  unresolved path L{m['line']}: {m['path']}")
        if r["skipped_paths"]:
            out.append("  paths not probed: " + ", ".join(f"{k} {v}" for k, v in sorted(r["skipped_paths"].items())))
        for d in r["duplicates"]:
            out.append(f"  info: duplicate L{','.join(map(str, d['lines']))}: {d['text']}")
        if r["history_over_limit"]:
            out.append(f"  version-history comments in body (keep {HISTORY_COMMENTS_ALLOWED}, move the rest "
                       f"to the history folder): L{','.join(map(str, r['history_comment_lines']))}")
        for i in r["frontmatter"]["issues"]:
            out.append(f"  frontmatter: {i}")
    out.append("note: " + THRESHOLD_NOTE)
    out.append("note: unresolved paths are checked against the file's folder and its ancestors up to the "
               "repository or plugin root; generated or out-of-repo paths can show here without being wrong.")
    return "\n".join(out)


def run(paths: list[str], warn_rules: int, root: str | None, dup_min: int, context: bool = True,
        home: Path | None = None, top: Path | None = None, managed: Path | None = None) -> list[dict]:
    files = collect(paths)
    home = Path.home() if home is None else home
    managed = managed_policy_path() if managed is None else managed
    cache: dict = {}
    results = []
    for f in files:
        fr = f.resolve()
        r = Path(root).resolve() if root else find_root(fr.parent)
        ctx, ctx_err = [], None
        if context:
            try:
                ctx = loaded_with(fr, home, top, managed, cache)
            except (OSError, ValueError) as e:
                ctx_err = read_error(e)
        try:
            results.append(check_file(fr, r, warn_rules, dup_min, ctx, ctx_err))
        except (UnicodeDecodeError, OSError) as e:
            results.append({"path": str(fr), "error": read_error(e)})
    return results


def self_test() -> int:
    here = Path(__file__).resolve().parent / "fixtures"
    expected = json.loads((here / "expected.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "a-sjis.md").write_bytes("日本語".encode("shift_jis"))
        (Path(tmp) / "b-ok.md").write_text("ok\n", encoding="utf-8")
        scan = run([tmp], DEFAULT_WARN_RULES, tmp, 20, context=False)
    with tempfile.TemporaryDirectory() as tmp:
        plugin = Path(tmp) / "plugin"
        skill = plugin / "skills" / "s"
        (plugin / ".claude-plugin").mkdir(parents=True)
        skill.mkdir(parents=True)
        (plugin / ".claude-plugin" / "plugin.json").write_text('{"name": "p"}\n', encoding="utf-8")
        (plugin / "LICENSE").write_text("MIT\n", encoding="utf-8")
        (plugin / "CHANGELOG.md").write_text("x\n", encoding="utf-8")
        (skill / "SKILL.md").write_text(
            "---\nname: s\ndescription: d\nlicense: Complete terms in LICENSE (MIT)\n---\n"
            "See `CHANGELOG.md`.\n", encoding="utf-8")
        pr = run([str(skill / "SKILL.md")], DEFAULT_WARN_RULES, None, 20, context=False)[0]
        plugin_root_findings = [m["path"] for m in pr["missing_paths"]] + pr["frontmatter"]["issues"]
    # The temp folder sits under the real home, so `top` must stop the ancestor walk there, and home and
    # managed must be passed, or the real ~/.claude and policy file leak into the expected counts.
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp).resolve()
        home = t / "home"
        proj = t / "proj"
        files = {
            t / "CLAUDE.md": "Use English. Never push.\n@imp/extra.md\nSee `@imp/skip.md` for background.\n",
            t / "imp" / "extra.md": "Always add tests.\n@../CLAUDE.md\n",
            t / "imp" / "skip.md": "Always skip.\n",
            t / ".claude" / "CLAUDE.md": "Never rebase.\n",
            t / ".claude" / "rules" / "a.md": "Always run tests.\n",
            proj / ".git": "gitdir: elsewhere\n",
            proj / ".claude" / "CLAUDE.md": "Never deploy on Friday.\n",
            proj / ".claude" / "rules" / "sub" / "r.md": "Always lint.\n",
            proj / ".claude" / "rules" / "p.md": '---\npaths: ["x/**"]\n---\nAlways check x.\n',
            proj / "sub" / "CLAUDE.local.md": "Keep logs.\n",
            proj / "sub" / "t.txt": "hello\n",
            home / ".claude" / "CLAUDE.md": "Keep replies short.\n",
            home / ".claude" / "rules" / "u.md": "Always cite sources.\n",
            t / "managed" / "CLAUDE.md": "Never share secrets.\n",
        }
        for p, body in files.items():
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(body, encoding="utf-8")
        cr = run([str(proj / "sub" / "t.txt")], DEFAULT_WARN_RULES, str(proj), 20, home=home, top=t,
                 managed=t / "managed" / "CLAUDE.md")[0]["rule_load"]
    ja_cases = [
        ("これはプラグインです。", False),
        ("報告書は利用者の言語で書かれます。", False),
        ("この設定は後から変更できます。", False),
        ("結果は表にまとめてあります。", False),
        ("古い版は使われていません。", False),
        ("前回の実行は失敗しました。", False),
        ("対象のファイルを読みます。", True),
        ("結果を表で返してください。", True),
        ("本番データを更新しないでください。", True),
        ("変更の前に確認します。", True),
        ("出力は日本語で書くこと。", True),
        ("検証は毎回行います。", True),
    ]
    ja_mismatches = [s for s, want in ja_cases if is_instruction(s) != want]
    # Not SKILL.md (Claude Code would load it as a skill) and not *.md (a folder scan of this skill
    # would report the fixture's deliberate findings and fail --strict).
    results = run([str(here / "sample-skill.txt")], DEFAULT_WARN_RULES, str(here), 20, context=False)
    r = results[0]
    got = {
        "folder_scan_entries": len(scan),
        "folder_scan_errors": sum("error" in x for x in scan),
        "plugin_root_findings": plugin_root_findings,
        "strict_ignores_warnings": bool(r["duplicates"]) and not has_findings(
            {**r, "over_threshold": True, "missing_paths": [], "history_over_limit": False,
             "frontmatter": {"issues": []}}),
        "instruction_lines": r["instruction_lines"],
        "directive_sentences": r["directive_sentences"],
        "context_loaded_with_total": cr["loaded_with_total"],
        "context_loaded_with_files": len(cr["loaded_with"]),
        "context_sources": sorted(c["source"] for c in cr["loaded_with"]),
        "ja_polite_mismatches": ja_mismatches,
        "prohibition_lines": r["prohibition_lines"],
        "missing_paths": sorted(m["path"] for m in r["missing_paths"]),
        "duplicate_groups": len(r["duplicates"]),
        "history_comment_lines": len(r["history_comment_lines"]),
        "history_over_limit": r["history_over_limit"],
        "frontmatter_issues": sorted(r["frontmatter"]["issues"]),
    }
    bad = {k: (got[k], v) for k, v in expected.items() if got.get(k) != v}
    print(json.dumps({"tool": "check.py", "self_test": "fail" if bad else "pass", "got": got}, ensure_ascii=False))
    for k, (g, e) in bad.items():
        print(f"MISMATCH {k}: got {g!r}, expected {e!r}")
    if not bad:
        print("self-test pass")
    return 1 if bad else 0


class JsonErrorParser(argparse.ArgumentParser):
    def error(self, message: str):
        print(json.dumps({"tool": "check.py", "error": message}, ensure_ascii=False))
        self.print_usage(sys.stdout)
        sys.exit(2)


def main(argv: list[str]) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = JsonErrorParser(description="Mechanical checks for prompt assets.")
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--warn-rules", type=int, default=DEFAULT_WARN_RULES,
                    help=f"guide for rule_load.total (this tool's own choice, default {DEFAULT_WARN_RULES})")
    ap.add_argument("--root", help="repository root for path resolution (default: nearest ancestor with .git or .claude-plugin/plugin.json)")
    ap.add_argument("--dup-min", type=int, default=20, help="minimum normalized sentence length for duplicates")
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 on findings (over_threshold and duplicates excluded); hooks need exit 2: "
                         "python check.py --strict PATH 1>&2 || exit 2")
    ap.add_argument("--no-context", action="store_true",
                    help="do not add the instruction files Claude Code loads with the target (loaded_with stays empty)")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.paths:
        ap.error("no PATH given")
    if a.root and not Path(a.root).is_dir():
        ap.error(f"--root is not a readable folder: {a.root}")
    try:
        results = run(a.paths, a.warn_rules, a.root, a.dup_min, context=not a.no_context)
    except OSError as e:
        ap.error(f"PATH not found or unreadable: {e}")
    payload = {"tool": "check.py", "version": VERSION, "warn_rules": a.warn_rules,
               "threshold_note": THRESHOLD_NOTE, "files": results}
    print(json.dumps(payload, ensure_ascii=False))
    print(summary(results, a.warn_rules))
    return 1 if a.strict and any(has_findings(r) for r in results) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
