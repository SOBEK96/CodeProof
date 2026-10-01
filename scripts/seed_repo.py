#!/usr/bin/env python3
"""Author the fresh milestone commits that the live grants will be graded on.

Runs BETWEEN `interact_live.py create` and `interact_live.py deliver`, so that every
commit post-dates its grant (the oracle rejects historical commits). For each grant
it commits the matching sources from scripts/seed_milestones/ to the developer's own
repository, pushes, waits for GitHub Actions to finish, and records the SHA and CI
conclusions in deployments/studio-next.json.

The repository belongs to the developer identity (owner == registered handle), which
is exactly what the oracle's provenance check requires.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from common import ROOT, load_deployment, save_deployment

GH_USER = os.environ.get("SEED_GH_USER", "Handik4")
REPO_NAME = os.environ.get("SEED_REPO", "codeproof-milestones")
AUTHOR_NAME = os.environ.get("SEED_AUTHOR_NAME", "Handik4")
AUTHOR_EMAIL = os.environ.get("SEED_AUTHOR_EMAIL", "ehemati08@gmail.com")
SRC = ROOT / "scripts" / "seed_milestones"
SLUG = f"{GH_USER}/{REPO_NAME}"

# grant title -> (source dir, commit message)
MILESTONES = {
    "EVM Token Bridge Implementation": ("ms1", "feat: lock-and-release token bridge with reentrancy guard"),
    "Flash Loan Vault": ("ms2", "wip: flash loan vault"),
    "Decentralized Identity Indexer": ("ms3", "feat: append-only DID identity indexer"),
}


def token() -> str:
    out = subprocess.run(["gh", "auth", "token", "--user", GH_USER], capture_output=True, text=True)
    if out.returncode != 0 or not out.stdout.strip():
        sys.exit(f"gh has no login for {GH_USER}")
    return out.stdout.strip()


ENV = {**os.environ, "GH_TOKEN": "", "GIT_TERMINAL_PROMPT": "0"}


def sh(args, cwd=None, check=True):
    r = subprocess.run(args, cwd=cwd, env=ENV, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"{' '.join(args[:3])}... failed: {r.stderr.strip()[:400]}")
    return r.stdout.strip()


def git(args, cwd):
    # Credentials come from the environment for this one command only.
    helper = "!f() { echo username=%s; echo password=$GH_SEED_TOKEN; }; f" % GH_USER
    # the empty value first clears keychain helpers so only this identity is used
    return sh(["git", "-c", "credential.helper=", "-c", f"credential.helper={helper}", *args], cwd=cwd)


def gh_api(path):
    r = subprocess.run(["gh", "api", path], env={**ENV, "GH_TOKEN": ENV["GH_SEED_TOKEN"]},
                       capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else None


def ensure_repo(tmp: Path) -> Path:
    exists = subprocess.run(["gh", "repo", "view", SLUG], env={**ENV, "GH_TOKEN": ENV["GH_SEED_TOKEN"]},
                            capture_output=True).returncode == 0
    if not exists:
        print(f"creating public repository {SLUG}")
        subprocess.run(["gh", "repo", "create", SLUG, "--public", "--description",
                        "Milestone deliverables graded by the CodeProof oracle on GenLayer Studio Next"],
                       env={**ENV, "GH_TOKEN": ENV["GH_SEED_TOKEN"]}, check=True)
    work = tmp / REPO_NAME
    git(["clone", f"https://github.com/{SLUG}.git", str(work)], cwd=tmp)
    sh(["git", "config", "user.name", AUTHOR_NAME], cwd=work)
    sh(["git", "config", "user.email", AUTHOR_EMAIL], cwd=work)
    if not (work / ".github").exists():
        shutil.copytree(SRC / "base", work, dirs_exist_ok=True)
        sh(["git", "checkout", "-B", "main"], cwd=work)
        sh(["git", "add", "-A"], cwd=work)
        sh(["git", "commit", "-m", "chore: CI workflow and project scaffolding"], cwd=work)
        git(["push", "-u", "origin", "main"], cwd=work)
    return work


def wait_ci(sha: str, timeout: int = 420) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        data = gh_api(f"repos/{SLUG}/commits/{sha}/check-runs?per_page=100")
        runs = (data or {}).get("check_runs", [])
        if runs and all(r["status"] == "completed" for r in runs):
            return {"slugs": sorted({r["app"]["slug"] for r in runs}),
                    "conclusions": [r["conclusion"] for r in runs]}
        time.sleep(10)
    return {"slugs": [], "conclusions": ["timeout"]}


def main() -> int:
    dep = load_deployment()
    grants = {g["title"]: g for g in dep.get("grants", [])}
    if len(grants) < len(MILESTONES):
        sys.exit("run `interact_live.py create` first")
    ENV["GH_SEED_TOKEN"] = token()
    with tempfile.TemporaryDirectory() as t:
        work = ensure_repo(Path(t))
        for title, (folder, message) in MILESTONES.items():
            rec = grants[title]
            if rec.get("seed_commit"):
                print(f"{title}: already committed {rec['seed_commit'][:10]}")
                continue
            # A re-seed must still show whole files in the milestone commit's diff: remove any
            # earlier copy in its own commit first, then add the files back.
            stale = [str(f.relative_to(SRC / folder)) for f in (SRC / folder).rglob("*")
                     if f.is_file() and (work / f.relative_to(SRC / folder)).exists()]
            if stale:
                sh(["git", "rm", "-q", *stale], cwd=work)
                sh(["git", "commit", "-m", f"chore: reset {folder} for a fresh milestone"], cwd=work)
                git(["push", "origin", "main"], cwd=work)
                time.sleep(2)
            shutil.copytree(SRC / folder, work, dirs_exist_ok=True)
            sh(["git", "add", "-A"], cwd=work)
            sh(["git", "commit", "-m", message], cwd=work)
            git(["push", "origin", "main"], cwd=work)
            sha = sh(["git", "rev-parse", "HEAD"], cwd=work)
            print(f"{title}: pushed {sha}, waiting for GitHub Actions...")
            rec["seed_commit"] = sha
            rec["repo_url"] = f"https://github.com/{SLUG}"
            rec["ci"] = wait_ci(sha)
            print(f"   CI: {rec['ci']}")
            dep["grants"] = list(grants.values())
            save_deployment(dep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
