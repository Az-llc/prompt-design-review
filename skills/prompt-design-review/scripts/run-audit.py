#!/usr/bin/env python3
"""Runs Claude Code's built-in /doctor prompt-audit on prompt assets and reports one JSON line.

Usage:
  python run-audit.py TARGET [TARGET ...]
  python run-audit.py --self-test

stdout: exactly one JSON object:
  tool, version, status ("ok" | "failed" | "not_run"), reason, targets (resolved paths),
  add_dirs (folders passed to --add-dir: a folder target itself, a file target's parent), cost_usd
  (number or null), other_denials (permission denials that do not touch a target: tool, input trimmed
  to 200 chars), result (the audit text).
The child claude runs with --safe-mode, --permission-mode default and --tools Read,Grep,Glob, so it has
no tool that can change files or run commands, whatever the user's settings allow and whatever tools
Claude Code adds later (the audit then cannot inspect git history).
Worst case wall time: version check 10 s + audit 540 s + tree kill 10 s + drain 10 s, under 600 s.
not_run: claude is not on PATH or is older than 2.1.283 (or its version cannot be read).
failed: timeout, non-zero exit, non-JSON output, is_error, empty result, a denied tool call on a target,
a claude.cmd/.bat launcher with a target path containing one of & % ^ | < > " !, or an unexpected
error in this script. For non-JSON output or a non-zero exit, reason ends with the tail of stderr.
Exit: 0 for ok / failed / not_run, 1 self-test mismatch, 2 wrong arguments or a missing TARGET.
Calls the Anthropic API through claude (costs money); --self-test does not.
Standard library only.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path

VERSION = "1.0.1"
MIN_CLAUDE = (2, 1, 283)
TIMEOUT_S = 540
DRAIN_TIMEOUT_S = 10
DENIAL_INPUT_MAX = 200
STDERR_TAIL = 300
ALLOWED_TOOLS = ("Read", "Grep", "Glob")
CMD_METACHARS = set('&%^|<>"!')
PATH_CHARS_RE = re.compile(r"[\w\-.]")
GIT_BASH_DRIVE_RE = re.compile(r"(^|[\s\"'=(,;])/([a-z])(?=/|$|[\s\"'])")


def norm(s: str) -> str:
    return GIT_BASH_DRIVE_RE.sub(r"\1\2:", s.replace("\\", "/").lower())


def norm_target(t: str) -> str:
    n = norm(t)
    return n if n.endswith(":/") or n == "/" else n.rstrip("/")


def strings_in(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for v in value.values() for s in strings_in(v)]
    if isinstance(value, list):
        return [s for v in value for s in strings_in(v)]
    return []


def contains_bounded(text: str, needle: str, slash_before_ok: bool = False) -> bool:
    """needle occurs in text with no path character glued on either side."""
    start = 0
    while needle:
        i = text.find(needle, start)
        if i < 0:
            return False
        j = i + len(needle)
        before = text[i - 1] if i else ""
        after = text[j] if j < len(text) else ""
        before_ok = not before or (before == "/" and slash_before_ok) or (
            before != "/" and not PATH_CHARS_RE.match(before))
        after_ok = not after or after == "/" or not PATH_CHARS_RE.match(after)
        if before_ok and after_ok:
            return True
        start = i + 1
    return False


def denial_on_target(tool_input, targets: list[str]) -> bool:
    texts = [norm(s) for s in strings_in(tool_input)]
    keys = [norm_target(t) for t in targets]
    if any(contains_bounded(s, k) for k in keys for s in texts):
        return True
    if not isinstance(tool_input, dict):
        return False
    path_field = tool_input.get("path")
    if not isinstance(path_field, str):
        return False
    folder = norm_target(path_field)
    others = [norm(s) for k, v in tool_input.items() if k != "path" for s in strings_in(v)]
    for k in keys:
        parent, _, name = k.rpartition("/")
        if parent == folder and any(contains_bounded(s, name, slash_before_ok=True) for s in others):
            return True
    return False


def stderr_tail(stderr_text: str) -> str:
    return " ".join(stderr_text.split())[-STDERR_TAIL:]


def evaluate(returncode: int | None, stdout_text: str, targets: list[str], stderr_text: str = "") -> dict:
    """returncode None means the run timed out."""
    out = {"status": "failed", "reason": "", "cost_usd": None, "other_denials": [], "result": ""}
    tail = stderr_tail(stderr_text)
    with_stderr = (lambda r: f"{r}; stderr: {tail}" if tail else r)
    if returncode is None:
        out["reason"] = with_stderr(f"timed out after {TIMEOUT_S} s")
        return out
    try:
        data = json.loads(stdout_text)
    except ValueError:
        data = None
    if not isinstance(data, dict):
        out["reason"] = with_stderr(
            f"output is not a JSON object (exit {returncode}): {stdout_text.strip()[:200]}")
        return out
    cost = data.get("total_cost_usd")
    out["cost_usd"] = cost if isinstance(cost, (int, float)) else None
    result = data.get("result")
    out["result"] = result if isinstance(result, str) else ""
    hit = []
    for d in data.get("permission_denials") or []:
        d = d if isinstance(d, dict) else {"tool_input": d}
        tool_input = d.get("tool_input", d.get("input"))
        if denial_on_target(tool_input, targets):
            hit.append(d.get("tool_name", "?"))
        else:
            out["other_denials"].append({
                "tool": d.get("tool_name", "?"),
                "input": json.dumps(tool_input, ensure_ascii=False)[:DENIAL_INPUT_MAX]})
    if returncode != 0:
        out["reason"] = with_stderr(f"claude exited {returncode}")
    elif data.get("is_error"):
        out["reason"] = f"is_error ({data.get('subtype', '')})"
    elif not out["result"].strip():
        out["reason"] = "empty result"
    elif hit:
        out["reason"] = "permission denied on a target: " + ", ".join(hit)
    else:
        out["status"] = "ok"
    return out


def build_command(claude_path: str, targets: list[str], is_dir=os.path.isdir) -> dict:
    """Return {"cmd", "add_dirs", "error"}; error is a reason string when the command must not run."""
    add_dirs = list(dict.fromkeys(t if is_dir(t) else os.path.dirname(t) for t in targets))
    # cmd.exe re-parses the command line of a .cmd/.bat launcher; list quoting cannot protect these.
    if claude_path.lower().endswith((".cmd", ".bat")):
        bad = [t for t in targets if CMD_METACHARS & set(t)]
        if bad:
            return {"cmd": [], "add_dirs": add_dirs,
                    "error": "claude is a .cmd/.bat launcher and a target path contains one of "
                             "& % ^ | < > \" ! : " + ", ".join(bad)}
    prompt = "/doctor prompt-audit " + " ".join(f'"{t}"' if " " in t else t for t in targets)
    cmd = [claude_path, "-p", prompt]
    for d in add_dirs:
        cmd += ["--add-dir", d]
    # --safe-mode must stay: without it the user's own CLAUDE.md, rules, skills and plugins leak into the diagnosis.
    cmd += ["--safe-mode", "--permission-mode", "default",
            "--tools", ",".join(ALLOWED_TOOLS), "--output-format", "json"]
    return {"cmd": cmd, "add_dirs": add_dirs, "error": None}


def kill_tree(p: subprocess.Popen) -> None:
    try:
        if os.name == "nt":
            subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], stdin=subprocess.DEVNULL,
                           capture_output=True, timeout=10)
        else:
            os.killpg(p.pid, signal.SIGKILL)
    except (OSError, subprocess.TimeoutExpired):
        pass
    try:
        p.kill()
    except OSError:
        pass


def run_child(cmd: list[str], cwd: str) -> tuple[int | None, str, str]:
    kw = ({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt"
          else {"start_new_session": True})
    p = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE, **kw)
    try:
        out, err = p.communicate(timeout=TIMEOUT_S)
        rc = p.returncode
    except subprocess.TimeoutExpired:
        kill_tree(p)
        try:
            out, err = p.communicate(timeout=DRAIN_TIMEOUT_S)
        except subprocess.TimeoutExpired:
            out, err = b"", b""
        rc = None
    return rc, (out or b"").decode("utf-8", "replace"), (err or b"").decode("utf-8", "replace")


def claude_version(exe: str) -> tuple[int, ...] | None:
    try:
        p = subprocess.run([exe, "--version"], stdin=subprocess.DEVNULL, capture_output=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return None
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", p.stdout.decode("utf-8", "replace"))
    return tuple(int(x) for x in m.groups()) if m else None


def audit(targets: list[str]) -> dict:
    base = {"tool": "run-audit.py", "version": VERSION, "targets": targets, "add_dirs": []}
    empty = {"cost_usd": None, "other_denials": [], "result": ""}
    try:
        exe = shutil.which("claude")
        if not exe:
            return {**base, "status": "not_run", "reason": "claude not found on PATH", **empty}
        built = build_command(exe, targets)
        base["add_dirs"] = built["add_dirs"]
        ver = claude_version(exe)
        if ver is None or ver < MIN_CLAUDE:
            shown = ".".join(map(str, ver)) if ver else "unknown"
            need = ".".join(map(str, MIN_CLAUDE))
            return {**base, "status": "not_run", "reason": f"claude {shown} is older than {need} or unreadable",
                    **empty}
        if built["error"]:
            return {**base, "status": "failed", "reason": built["error"], **empty}
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as cwd:
            rc, text, err = run_child(built["cmd"], cwd)
        return {**base, **evaluate(rc, text, targets, err)}
    except Exception as e:
        return unexpected(targets, base["add_dirs"], e)


def unexpected(targets: list[str], add_dirs: list[str], e: Exception) -> dict:
    return {"tool": "run-audit.py", "version": VERSION, "targets": targets, "add_dirs": add_dirs,
            "status": "failed", "reason": f"unexpected {type(e).__name__}: {e}",
            "cost_usd": None, "other_denials": [], "result": ""}


def self_test() -> int:
    base = r"C:\Work\a b" if os.name == "nt" else "/work/a b"
    t = os.path.join(base, "SKILL.md")
    folder_t = os.path.join(base, "rules")

    def run(**data):
        return json.dumps({"is_error": False, "result": "report", "total_cost_usd": 0.5, **data})

    def denied(tool, **tool_input):
        return run(permission_denials=[{"tool_name": tool, "tool_input": tool_input}])

    # (name, returncode, stdout, stderr, targets, expected status, expected other_denials, reason must contain)
    cases = [
        ("ok", 0, run(), "", [t], "ok", 0, ""),
        ("is_error", 0, run(is_error=True), "", [t], "failed", 0, ""),
        ("empty result", 0, run(result="  \n"), "", [t], "failed", 0, ""),
        ("target read denied", 0, denied("Read", file_path=t.upper().replace("\\", "/")), "", [t], "failed", 0, ""),
        ("unrelated denial", 0, denied("Bash", command="ls /tmp"), "", [t], "ok", 1, ""),
        ("non-JSON", 0, "Error: boom", "", [t], "failed", 0, ""),
        ("returncode 1", 1, run(), "", [t], "failed", 0, ""),
        ("timeout", None, "", "", [t], "failed", 0, ""),
        ("stderr in reason", 1, "", "Error:\n   auth\tfailed  \n", [t], "failed", 0, "stderr: Error: auth failed"),
        ("git-bash path denied", 0, denied("Bash", command="cat '/c/Work/a b/SKILL.md'"),
         "", [r"C:\Work\a b\SKILL.md"], "failed", 0, ""),
        ("file prefix is not a hit", 0, denied("Read", file_path=t + ".bak"), "", [t], "ok", 1, ""),
        ("folder prefix is not a hit", 0, denied("Read", file_path=folder_t + "x/a.md"),
         "", [folder_t], "ok", 1, ""),
        ("file under folder target denied", 0, denied("Read", file_path=os.path.join(folder_t, "a.md")),
         "", [folder_t], "failed", 0, ""),
        ("folder + pattern denied", 0, denied("Grep", pattern="SKILL.md", path=base.upper()),
         "", [t], "failed", 0, ""),
        ("folder + other name is not a hit", 0, denied("Glob", pattern="**/SKILL.md.bak", path=base),
         "", [t], "ok", 1, ""),
    ]
    bad = []
    for name, rc, text, err, targets, status, n_other, reason_part in cases:
        got = evaluate(rc, text, targets, err)
        if (got["status"] != status or len(got["other_denials"]) != n_other
                or reason_part not in got["reason"]):
            bad.append(f"MISMATCH {name}: got {got['status']} / {len(got['other_denials'])} other denials / "
                       f"{got['reason']!r}, expected {status} / {n_other} / {reason_part!r}")

    other = os.path.join(base, "other.md")
    second = os.path.join(base[:-2] + "x", "CLAUDE.md")
    built = build_command("claude.exe", [t, other, folder_t, second], is_dir=lambda p: p == folder_t)
    want_dirs = [base, folder_t, os.path.dirname(second)]
    cmd = built["cmd"]
    build_checks = [
        ("add_dirs deduped", built["add_dirs"] == want_dirs),
        ("each add_dir passed", [cmd[i + 1] for i, a in enumerate(cmd) if a == "--add-dir"] == want_dirs),
        ("spaced path quoted", f'"{t}"' in cmd[2]),
        ("read-only tools only", cmd[cmd.index("--tools") + 1] == "Read,Grep,Glob"),
        ("permission mode", cmd[cmd.index("--permission-mode") + 1] == "default"),
        ("safe mode", "--safe-mode" in cmd),
        ("no error", built["error"] is None),
        (".cmd with metachar refused", bool(build_command("claude.CMD", [base + "&x.md"])["error"])),
        (".cmd without metachar runs", build_command("claude.cmd", [t])["error"] is None),
        (".exe with metachar runs", build_command("claude.exe", [base + "&x.md"])["error"] is None),
    ]
    bad += [f"MISMATCH build_command: {n}" for n, ok in build_checks if not ok]
    n_cases = len(cases) + len(build_checks)
    print(json.dumps({"tool": "run-audit.py", "self_test": "fail" if bad else "pass", "cases": n_cases}))
    for b in bad:
        print(b)
    if not bad:
        print("self-test pass")
    return 1 if bad else 0


def main(argv: list[str]) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    if argv == ["--self-test"]:
        return self_test()
    if not argv or any(a.startswith("-") for a in argv):
        print(json.dumps({"tool": "run-audit.py",
                          "error": "usage: run-audit.py TARGET [TARGET ...] | --self-test"}))
        return 2
    try:
        targets = [str(Path(a).resolve()) for a in argv]
        missing = [t for t in targets if not Path(t).exists()]
    except Exception as e:
        print(json.dumps(unexpected(argv, [], e), ensure_ascii=False))
        return 0
    if missing:
        print(json.dumps({"tool": "run-audit.py", "error": "TARGET not found: " + ", ".join(missing)},
                         ensure_ascii=False))
        return 2
    print(json.dumps(audit(targets), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
