"""Which web UI paths are production code. The lint-ui and break gates check only those.

Why it exists: the gates fired on prototype pages, inspo and sweep pages, scratch visuals,
tests and stories, which slowed real work. A list of folders would go stale as a filesystem
grows, so the rules below read signals the files carry themselves. Only the one case those
signals cannot settle (a new top-level folder in an app repo) asks the user, once.

A UI path is production only when all of these hold, in this order:
1. Its name is not a test or story (.test., .spec., .stories., .story.), and no folder on
   its path inside the repo is a test or fixture folder (test, tests, __tests__, fixtures, ...).
2. It sits inside a git work tree. Scratchpads, app-support folders and temp folders do not.
   A folder that does not exist yet is judged by the nearest one above it that does.
3. Git does not ignore it (git check-ignore).
4. A build manifest (package.json and the like) sits between the file and the repo root.
   Notes and brain repos have none.
5. The repo's folder record (RECORD, at the repo root) calls its top-level folder
   "production". "prototype" skips it. A folder not in the record is ASK: the gate asks the
   user once on a card and saves the answer (apply_card_answers). Files at the repo root use
   the folder name ".".

Only a user's card answer classifies a folder: the gates write RECORD themselves when they
see one (answer values only, never question text). An agent's own write to RECORD makes the
lint gate block (record_write), so an agent cannot exempt a folder by editing the file.

UI_GATES_SCOPE=all in the environment turns this filter off (every UI path counts, as before
it existed): the gate tests that use made-up paths set it.

Unsure cases lean toward gating: a relative path with no known folder, or a git call that
fails, counts as production.
"""
import functools
import json
import os
import re
import subprocess
import tempfile

PRODUCTION, SKIP, ASK = "production", "skip", "ask"
RECORD = os.path.join(".claude", "ui-gates.json")
RECORD_NAME = "ui-gates.json"
ENV_ALL = "UI_GATES_SCOPE"
TEST_NAME = re.compile(r"\.(?:test|spec|stories|story)\.[^/]+$", re.I)
TEST_DIRS = {"test", "tests", "__tests__", "__mocks__", "__fixtures__", "fixtures", "e2e"}
MANIFESTS = ("package.json", "deno.json", "pyproject.toml", "Cargo.toml", "go.mod",
             "Gemfile", "composer.json")
# An AskUserQuestion answer that classifies a folder: "Production: spikes/", "Prototype: ./"
CARD_ANSWER = re.compile(r"^\s*(production|prototype)\s*:\s*(\S+?)/?\s*$", re.I)
FEEDBACK = "Stop hook feedback"
GIT_TIMEOUT = 3


def _abs(path, cwd=""):
    p = os.path.expanduser(str(path).strip("'\""))
    if not os.path.isabs(p):
        if not cwd:
            return None
        p = os.path.join(os.path.expanduser(cwd), p)
    return os.path.realpath(p)  # git prints real paths (/var -> /private/var on macOS)


def _existing(d):
    while d and not os.path.isdir(d):
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent
    return d


def _git(args, cwd):
    try:
        out = subprocess.run(["git", "-C", cwd] + args, capture_output=True, text=True,
                             timeout=GIT_TIMEOUT)
    except (OSError, subprocess.SubprocessError):
        return None
    return out


@functools.lru_cache(maxsize=None)
def repo_top(d):
    """The work-tree root holding folder d (or the nearest existing folder above it); "" when
    it is in no git repo, None when git could not answer."""
    here = _existing(d)
    if here is None:
        return ""
    out = _git(["rev-parse", "--show-toplevel"], here)
    if out is None:
        return None
    return out.stdout.strip() if out.returncode == 0 else ""


@functools.lru_cache(maxsize=None)
def _ignored(top, full):
    out = _git(["check-ignore", "-q", "--", full], top)
    return out is not None and out.returncode == 0


@functools.lru_cache(maxsize=None)
def _has_manifest(d, top):
    """True when a build manifest sits in d or a folder above it, up to top."""
    while True:
        if any(os.path.isfile(os.path.join(d, m)) for m in MANIFESTS):
            return True
        if d == top or len(d) <= len(top):
            return False
        d = os.path.dirname(d)


def top_folder(full, top):
    parts = os.path.relpath(full, top).split(os.sep)
    return parts[0] if len(parts) > 1 else "."


def read_record(top):
    try:
        with open(os.path.join(top, RECORD), encoding="utf-8") as fh:
            folders = json.load(fh).get("folders", {})
        return {str(k): str(v).lower() for k, v in folders.items()} if isinstance(folders, dict) else {}
    except (OSError, ValueError, AttributeError):
        return {}


def classify(path, cwd=""):
    """(kind, detail) for a UI path: (PRODUCTION, ""), (SKIP, why) or (ASK, (top, folder))."""
    if os.environ.get(ENV_ALL, "").lower() == "all":
        return PRODUCTION, ""
    full = _abs(path, cwd)
    if full is None:
        return PRODUCTION, ""  # no folder to judge it by: gate
    if TEST_NAME.search(os.path.basename(full)):
        return SKIP, "test or story file"
    top = repo_top(os.path.dirname(full))
    if top is None:
        return PRODUCTION, ""
    if not top:
        return SKIP, "outside any git repo"
    if TEST_DIRS & set(os.path.relpath(full, top).split(os.sep)[:-1]):
        return SKIP, "test or fixture folder"  # only folders inside the repo, not the home path
    if _ignored(top, full):
        return SKIP, "git-ignored"
    if not _has_manifest(os.path.dirname(full), top):
        return SKIP, "no build manifest"
    folder = top_folder(full, top)
    kind = read_record(top).get(folder)
    if kind == "prototype":
        return SKIP, "prototype folder"
    if kind == "production":
        return PRODUCTION, ""
    return ASK, (top, folder)


def label(folder):
    return f"{folder}/"


def ask_reason(asks):
    """The block reason for folders not in the record yet: (top, folder) pairs."""
    names = sorted({label(f) for _, f in asks})
    where = ", ".join(sorted({f"{label(f)} in {os.path.basename(t)}" for t, f in asks}))
    opts = "; ".join(f'"Production: {n}" and "Prototype: {n}"' for n in names)
    return (f"UI changed in a folder the UI gates have not classified yet: {where}. Ask the user "
            "on an AskUserQuestion card, one question per folder, whether it holds production UI "
            "(the lint and break gates check it) or prototypes (they skip it), with exactly "
            f"these option labels: {opts}. The gates save the answer in {RECORD}; never edit "
            "that file yourself. If the answer is Production, the gates then check the change.")


def card_folder_answers(answers):
    """[(kind, folder)] for the classifying answers among a card's answer values."""
    out = []
    for a in answers:
        m = CARD_ANSWER.match(str(a))
        if m:
            out.append(("production" if m.group(1).lower() == "production" else "prototype",
                        m.group(2).strip().rstrip("/") or "."))
    return out


def write_record(top, folder, kind):
    """Set folder -> kind in the repo's record, atomically. Returns True when it changed."""
    folders = read_record(top)
    if folders.get(folder) == kind:
        return False
    folders[folder] = kind
    path = os.path.join(top, RECORD)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = {"_note": "Written by the ui-suite lint and break gates from the user's card "
                     "answers. production: the gates check UI here. prototype: they skip it.",
            "folders": dict(sorted(folders.items()))}
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".ui-gates-")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(body, fh, indent=2)
        fh.write("\n")
    os.replace(tmp, path)
    return True


def apply_card_answers(answer_lists, asks):
    """Save each classifying card answer for the asked folders it names. answer_lists is the
    answer values of each card, oldest first; asks is the (top, folder) pairs still unasked.
    Returns the (top, folder, kind) written."""
    by_name = {}
    for top, folder in asks:
        by_name.setdefault(folder, set()).add(top)
    done = []
    for answers in answer_lists:
        for kind, folder in card_folder_answers(answers):
            for top in by_name.get(folder, ()):
                if write_record(top, folder, kind):
                    done.append((top, folder, kind))
    return done


def is_feedback(entry):
    """A Stop hook's block message as it lands in the transcript."""
    if entry.get("type") != "user" or not entry.get("isMeta"):
        return False
    content = (entry.get("message") or {}).get("content")
    text = content if isinstance(content, str) else " ".join(
        b.get("text", "") for b in content or [] if isinstance(b, dict))
    return text.lstrip().startswith(FEEDBACK)


def rearmed(entries, card_answers):
    """True when a classifying card answer came after the last Stop hook block: the gates
    then check once more although stop_hook_active is set. It cannot loop: the next block
    comes after that answer."""
    last_block = max((i for i, e in enumerate(entries) if is_feedback(e)), default=-1)
    return any(card_folder_answers(card_answers(e)) for e in entries[last_block + 1:])


def record_write(name, inp, cwd="", window=(None, None), edit_tools=()):
    """True when an agent's own tool call wrote a repo's folder record: an Edit/Write on it,
    or a shell command that names it while its modified time falls in the call's window."""
    if name in edit_tools:
        return os.path.basename(str(inp.get("file_path", ""))) == RECORD_NAME
    if name != "Bash":
        return False
    cmd = str(inp.get("command", ""))
    if RECORD_NAME not in cmd:
        return False
    start, end = window
    if start is None or end is None:
        return False
    for m in re.finditer(r"[\w./~${}-]*" + re.escape(RECORD_NAME), cmd):
        full = _abs(m.group(0), cwd)
        if full is None and cwd:
            continue
        candidates = [full] if full else []
        top = repo_top(cwd) if cwd else None
        if top:
            candidates.append(os.path.join(top, RECORD))
        for c in candidates:
            try:
                if start - 2.0 <= os.path.getmtime(c) <= end + 2.0:
                    return True
            except OSError:
                continue
    return False
