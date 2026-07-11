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

import json
import re
import subprocess
import sys
from pathlib import Path

REFERENCE_RE = re.compile(r"Reference: '(.*)'")
URL_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*://")

# Filesystems commonly cap a single path component at 255 bytes. Stay well
# under that so a multi-byte (e.g. Japanese) title never trips it.
MAX_COMPONENT_BYTES = 150


def _component_too_long(name: str) -> bool:
    return len(name.encode("utf-8")) > MAX_COMPONENT_BYTES


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
        if URL_SCHEME_RE.match(ref):
            # A [[wikilink]] pointing at an external URL, not a vault note.
            # Leave it as-is (obsidian-export's italic fallback) rather than
            # creating a stub page for it.
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

        *dir_parts, name = rel_path.parts
        if any(_component_too_long(part) for part in dir_parts) or _component_too_long(
            f"{name}.md"
        ):
            # A component this long would hit the filesystem's filename
            # length limit. There's no way to shorten it without changing
            # the filename away from the reference text (which would just
            # leave an unreachable orphan page, since obsidian-export still
            # couldn't resolve the link on the next pass), so skip it and
            # fall back to the pre-existing italic rendering.
            print(f"Skipping reference too long for a filename: {ref!r}")
            continue

        stub_path = vault_dir / f"{ref}.md"

        if stub_path.exists():
            continue

        try:
            stub_path.parent.mkdir(parents=True, exist_ok=True)
            stub_path.write_text("", encoding="utf-8")
        except OSError as e:
            print(f"Warning: could not create stub note for {ref!r}: {e}")
            continue

        created.append(stub_path)
    return created


def remove_stub_notes(vault_dir: Path, stubs: list):
    for stub in stubs:
        stub.unlink(missing_ok=True)
        parent = stub.parent
        while parent != vault_dir and parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
            parent = parent.parent


def write_stub_manifest(output_dir: Path, vault_dir: Path, stubs: list):
    """
    Records which relative paths were created as empty stub notes (links to
    notes that don't actually exist in the vault), so convert.py can flag
    those pages as non-existent instead of treating them like real notes.
    """
    manifest_path = output_dir.parent / "stub_pages.json"
    manifest_path.write_text(
        json.dumps([str(stub.relative_to(vault_dir)) for stub in stubs]),
        encoding="utf-8",
    )


def main():
    binary, vault_dir, output_dir, *extra_args = sys.argv[1:]
    vault_dir = Path(vault_dir)
    output_dir = Path(output_dir)

    first_pass_stderr = run_export(binary, vault_dir, output_dir, extra_args)
    refs = collect_missing_refs(first_pass_stderr)

    if not refs:
        print("No broken wikilinks found.")
        write_stub_manifest(output_dir, vault_dir, [])
        return

    stubs = create_stub_notes(vault_dir, refs)
    write_stub_manifest(output_dir, vault_dir, stubs)
    if not stubs:
        return

    print(f"Creating {len(stubs)} stub note(s) for links with no existing target:")
    for stub in stubs:
        print(f"  {stub.relative_to(vault_dir)}")

    run_export(binary, vault_dir, output_dir, extra_args)
    remove_stub_notes(vault_dir, stubs)


if __name__ == "__main__":
    main()
