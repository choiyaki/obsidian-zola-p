"""
Wraps obsidian-export so that [[wikilinks]] pointing at notes which do not
exist anywhere in the vault still become real, followable links instead of
being flattened into italic plain text.

obsidian-export itself resolves [[wikilinks]] against the files actually
present in the vault: when a target is missing it prints a warning
(`Unable to find referenced note` / `Reference: 'xxx'`) and emits the link
title as plain italic text with no href, discarding the target path entirely.

Strategy: run obsidian-export once, parse those warnings to find which
references did not resolve, create an empty stub note for each one at the
exact relative path obsidian-export was looking for, then run obsidian-export
again. On the second pass the links resolve normally and flow through
convert.py like any other page (empty body, real title, real URL). The stub
files are removed from the vault again once the second export has captured
them, so the vault working copy is left as it was found.
"""

import re
import subprocess
import sys
from pathlib import Path

REFERENCE_RE = re.compile(r"Reference: '(.*)'")


def run_export(binary: str, vault_dir: Path, output_dir: Path, extra_args: list) -> str:
    proc = subprocess.run(
        [binary, *extra_args, str(vault_dir), str(output_dir)],
        stderr=subprocess.PIPE,
        text=True,
    )
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        sys.exit(proc.returncode)
    return proc.stderr


def collect_missing_refs(stderr_text: str) -> list:
    seen_lower = set()
    refs = []
    for match in REFERENCE_RE.finditer(stderr_text):
        ref = match.group(1).strip()
        if not ref or ref.startswith("#"):
            continue
        key = ref.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        refs.append(ref)
    return refs


def create_stub_notes(vault_dir: Path, refs: list) -> list:
    created = []
    for ref in refs:
        rel_path = Path(ref)
        if rel_path.is_absolute() or ".." in rel_path.parts:
            print(f"Skipping unresolvable reference: {ref!r}")
            continue

        stub_path = vault_dir / f"{ref}.md"
        if stub_path.exists():
            continue

        stub_path.parent.mkdir(parents=True, exist_ok=True)
        stub_path.write_text("", encoding="utf-8")
        created.append(stub_path)
    return created


def remove_stub_notes(vault_dir: Path, stubs: list):
    for stub in stubs:
        stub.unlink(missing_ok=True)
        parent = stub.parent
        while parent != vault_dir and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent


def main():
    binary, vault_dir, output_dir, *extra_args = sys.argv[1:]
    vault_dir = Path(vault_dir)
    output_dir = Path(output_dir)

    first_pass_stderr = run_export(binary, vault_dir, output_dir, extra_args)
    refs = collect_missing_refs(first_pass_stderr)

    if not refs:
        print("No broken wikilinks found.")
        return

    stubs = create_stub_notes(vault_dir, refs)
    if not stubs:
        return

    print(f"Creating {len(stubs)} stub note(s) for links with no existing target:")
    for stub in stubs:
        print(f"  {stub.relative_to(vault_dir)}")

    run_export(binary, vault_dir, output_dir, extra_args)
    remove_stub_notes(vault_dir, stubs)


if __name__ == "__main__":
    main()
