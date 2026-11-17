"""Helper for the blog-first-draft skill. Standard library only.

  python draft.py remarks --out FILE [--session ID ...] [--touching TEXT ...] [--since YYYY-MM-DD] [--project-dir DIR]
      Collect what the user typed in Claude Code conversations of the current project, oldest first.
      --session picks conversations by id; --touching picks every conversation whose record contains TEXT
      (for example a file name of the work). Prints the conversations used and the number of remarks.
  python draft.py fill --template FILE --out FILE [--file KEY=PATH ...] [--text KEY=VALUE ...]
      Write the template with each {KEY} replaced by the file's content or the given text. Fails when a
      placeholder is left unfilled.
  python draft.py panel --out FILE --reader NAME=FILE [--reader NAME=FILE ...]
      Read the readers' answers (each a file holding a JSON array of {"claim", "why"}) and write them
      under each reader's name. Prints the number of places per reader as JSON.
"""
import argparse
import datetime
import json
import os
import pathlib
import re
import sys

SKIP_STARTS = ("<", "This session is being continued", "Caveat:", "[Request interrupted")


def project_dir(cwd):
    base = pathlib.Path(os.environ.get("CLAUDE_CONFIG_DIR") or pathlib.Path.home() / ".claude")
    return base / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(cwd))


def typed_text(entry):
    if entry.get("isSidechain"):
        return None
    attachment = entry.get("attachment")
    if entry.get("type") == "attachment" and isinstance(attachment, dict) and attachment.get("type") == "queued_command":
        # Messages the user sent while the assistant was working are recorded only here.
        content = attachment.get("prompt")
    elif entry.get("type") != "user" or entry.get("isMeta") or entry.get("isCompactSummary"):
        return None
    else:
        content = entry.get("message", {}).get("content")
    if isinstance(content, list):
        if any(isinstance(p, dict) and p.get("type") == "tool_result" for p in content):
            return None
        content = "\n".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    if not isinstance(content, str):
        return None
    text = content.strip()
    return None if not text or text.startswith(SKIP_STARTS) else text


def remarks(args):
    folder = pathlib.Path(args.project_dir) if args.project_dir else project_dir(pathlib.Path.cwd())
    if not folder.is_dir():
        sys.exit(f"no conversation records at {folder}")
    files = [folder / f"{s}.jsonl" for s in args.session]
    if args.touching:
        for f in sorted(folder.glob("*.jsonl")):
            text = f.read_text(encoding="utf-8", errors="replace")
            if any(t in text for t in args.touching) and f not in files:
                files.append(f)
    if not files:
        sys.exit("no conversation matched; give --session or --touching")
    seen, rows = set(), []
    for f in files:
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            text, stamp = typed_text(entry), entry.get("timestamp")
            if not text or not stamp:
                continue
            when = datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone()
            key = (when.strftime("%Y-%m-%d %H:%M"), text)
            if key in seen or (args.since and when.strftime("%Y-%m-%d") < args.since):
                continue
            seen.add(key)
            rows.append((when, text))
    rows.sort(key=lambda r: r[0])
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n\n".join(f"[{w.strftime('%m-%d %H:%M')}] {t}" for w, t in rows) + "\n", encoding="utf-8")
    print(json.dumps({"conversations": [f.stem for f in files], "remarks": len(rows), "chars": sum(len(t) for _, t in rows)}))


def fill(args):
    text = pathlib.Path(args.template).read_text(encoding="utf-8")
    values = {}
    for pair in args.file:
        key, path = pair.split("=", 1)
        values[key] = pathlib.Path(path).read_text(encoding="utf-8").strip()
    for pair in args.text:
        key, value = pair.split("=", 1)
        values[key] = value
    names = set(re.findall(r"\{([a-z_]+)\}", text))
    missing = sorted(names - set(values))
    if missing:
        sys.exit(f"unfilled placeholders: {', '.join(missing)}")
    filled = re.sub(r"\{([a-z_]+)\}", lambda m: values[m.group(1)], text)
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(filled, encoding="utf-8")
    print(json.dumps({"out": str(out), "chars": len(filled)}))


def items(path):
    m = re.search(r"\[.*\]", pathlib.Path(path).read_text(encoding="utf-8"), re.S)
    return json.loads(m.group(0)) if m else []


def panel(args):
    parts, counts = [], {}
    for pair in args.reader:
        name, path = pair.split("=", 1)
        found = items(path)
        counts[name] = len(found)
        lines = [f"- {c.get('claim', '')}\n  理由: {c.get('why', '')}" for c in found] or ["（なし）"]
        parts.append(f"<{name}の指摘>\n" + "\n".join(lines) + f"\n</{name}の指摘>")
    pathlib.Path(args.out).write_text("\n\n".join(parts) + "\n", encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))


def opening_of(article):
    lines = article.replace("\r\n", "\n").split("\n")
    start = 0
    if lines and lines[0].startswith("---"):
        start = lines.index("---", 1) + 1
    body = lines[start:]
    while body and not body[0].strip():
        body.pop(0)
    if body and body[0].startswith("# "):
        body.pop(0)
    head = []
    for line in body:
        if line.startswith("#") or line.startswith(":::"):
            break
        head.append(line.rstrip())
    return "\n".join(head).strip()


def same_opening(args):
    opening = "\n".join(
        line.rstrip() for line in pathlib.Path(args.opening).read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
    ).strip()
    found = opening_of(pathlib.Path(args.article).read_text(encoding="utf-8"))
    same = opening == found
    print(json.dumps({"same": same}))
    if not same:
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("remarks")
    p.add_argument("--out", required=True)
    p.add_argument("--session", action="append", default=[])
    p.add_argument("--touching", action="append", default=[])
    p.add_argument("--since")
    p.add_argument("--project-dir")
    p.set_defaults(run=remarks)
    p = sub.add_parser("fill")
    p.add_argument("--template", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--file", action="append", default=[])
    p.add_argument("--text", action="append", default=[])
    p.set_defaults(run=fill)
    p = sub.add_parser("panel")
    p.add_argument("--out", required=True)
    p.add_argument("--reader", action="append", required=True, help="NAME=FILE, once per reader")
    p.set_defaults(run=panel)
    p = sub.add_parser("same-opening")
    p.add_argument("--opening", required=True)
    p.add_argument("--article", required=True)
    p.set_defaults(run=same_opening)
    args = ap.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
