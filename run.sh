#!/bin/bash

set -euo pipefail

BUILD_STARTED_AT=$SECONDS
STAGE_STARTED_AT=$SECONDS

finish_stage() {
	echo "Timing: $1 took $((SECONDS - STAGE_STARTED_AT))s"
	STAGE_STARTED_AT=$SECONDS
}

pip install python-slugify
finish_stage "Python dependency installation"

# Avoid copying over netlify.toml (will ebe exposed to public API)
echo "netlify.toml" >>__obsidian/.gitignore

# Download obsidian-export Linux binary because Netlify runs on Linux (the repo binary is for Mac)
curl -sL https://github.com/zoni/obsidian-export/releases/download/v25.3.0/obsidian-export-x86_64-unknown-linux-gnu.tar.xz | tar xJC /tmp
cp /tmp/obsidian-export-x86_64-unknown-linux-gnu/obsidian-export __site/bin/obsidian-export
chmod +x __site/bin/obsidian-export
finish_stage "obsidian-export download"

# Sync Zola template contents
rsync -a __site/zola/ __site/build
rsync -a __site/content/ __site/build/content
finish_stage "Zola template sync"

# Normalize YAML frontmatter that breaks obsidian-export.
# Some notes contain multiple leading frontmatter blocks; merge them into one and
# keep the first occurrence of duplicate keys.
python3 - <<'PY'
import re
from pathlib import Path

root = Path("__obsidian")


def parse_frontmatter_block(lines, start_idx):
    if start_idx >= len(lines) or lines[start_idx].strip() != "---":
        return None
    for i in range(start_idx + 1, len(lines)):
        if lines[i].strip() == "---":
            return lines[start_idx + 1 : i], i
    return None


for p in root.rglob("*.md"):
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue

    lines = text.splitlines()
    if not lines:
        continue

    pos = 0
    while pos < len(lines) and not lines[pos].strip():
        pos += 1

    prefix_end = pos
    first_block = parse_frontmatter_block(lines, pos)
    if first_block is None:
        continue

    merged = []
    seen = set()
    changed = False
    last_end_idx = pos

    while True:
        block = parse_frontmatter_block(lines, pos)
        if block is None:
            break

        fm, end_idx = block
        last_end_idx = end_idx

        for line in fm:
            s = line.strip()
            if not s or s.startswith("#"):
                merged.append(line)
                continue
            if ":" not in line:
                merged.append(line)
                continue

            key = line.split(":", 1)[0].strip().lower()
            if key in seen:
                changed = True
                continue

            seen.add(key)
            merged.append(line)

        next_pos = end_idx + 1
        while next_pos < len(lines) and not lines[next_pos].strip():
            next_pos += 1

        next_block = parse_frontmatter_block(lines, next_pos)
        if next_block is None:
            break

        changed = True
        pos = next_pos

    if changed:
        rebuilt = [*lines[:prefix_end], "---", *merged, "---", *lines[last_end_idx + 1 :]]
        p.write_text("\n".join(rebuilt) + "\n", encoding="utf-8")
PY
finish_stage "frontmatter normalization"

# Use obsidian-export to export markdown content from obsidian
mkdir -p __site/build/content/docs __site/build/__docs
export VAULT_CONTENT_ROOT="__obsidian"
export VAULT_GIT_ROOT="."
SOURCE_MD_COUNT=$(find __obsidian -type f -name '*.md' | wc -l | tr -d ' ')
if [ -z "${STRICT_LINE_BREAKS:-}" ]; then
	EXPORT_ARGS=(--frontmatter=never --hard-linebreaks --no-recursive-embeds)
else
	EXPORT_ARGS=(--frontmatter=never --no-recursive-embeds)
fi
python3 __site/resolve_missing_links.py __site/bin/obsidian-export __obsidian __site/build/__docs "${EXPORT_ARGS[@]}"
finish_stage "Obsidian export"

# Stub notes created above account for any extra exported files, so the exported
# count is only expected to be >= the original source count, not exactly equal.
EXPORTED_MD_COUNT=$(find __site/build/__docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Source markdown files: $SOURCE_MD_COUNT"
echo "Exported markdown files: $EXPORTED_MD_COUNT"
if [ "$EXPORTED_MD_COUNT" -lt "$SOURCE_MD_COUNT" ]; then
    echo "ERROR: obsidian-export exported only $EXPORTED_MD_COUNT of $SOURCE_MD_COUNT markdown files."
    exit 1
fi

# Run conversion script
STAGE_STARTED_AT=$SECONDS
python __site/convert.py
finish_stage "Markdown conversion"

CONVERTED_MD_COUNT=$(find __site/build/content/docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Converted markdown files: $CONVERTED_MD_COUNT"

# convert.py writes one _index.md per vault folder (section) in addition to
# converting each page, so the converted count legitimately exceeds the
# exported page count whenever the vault has subfolders. Only a deficit
# signals a real problem (e.g. two pages colliding onto the same output
# path), which convert.py itself now detects and fails on immediately with
# a specific message, so this is a backstop.
if [ "$CONVERTED_MD_COUNT" -lt "$EXPORTED_MD_COUNT" ]; then
    echo "ERROR: convert.py produced only $CONVERTED_MD_COUNT of $EXPORTED_MD_COUNT markdown files."
    exit 1
fi

# Build Zola site
STAGE_STARTED_AT=$SECONDS
zola --root __site/build build --output-dir public
finish_stage "Zola build"
echo "Timing: total build took $((SECONDS - BUILD_STARTED_AT))s"
