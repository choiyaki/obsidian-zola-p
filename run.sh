#!/bin/bash

set -euo pipefail

pip install python-slugify

# Avoid copying over netlify.toml (will ebe exposed to public API)
echo "netlify.toml" >>__obsidian/.gitignore

# Download obsidian-export Linux binary because Netlify runs on Linux (the repo binary is for Mac)
curl -sL https://github.com/zoni/obsidian-export/releases/download/v25.3.0/obsidian-export-x86_64-unknown-linux-gnu.tar.xz | tar xJC /tmp
cp /tmp/obsidian-export-x86_64-unknown-linux-gnu/obsidian-export __site/bin/obsidian-export
chmod +x __site/bin/obsidian-export

# Sync Zola template contents
rsync -a __site/zola/ __site/build
rsync -a __site/content/ __site/build/content

# Normalize YAML frontmatter keys that break obsidian-export (e.g. duplicate "created")
python3 - <<'PY'
from pathlib import Path

root = Path("__obsidian")

for p in root.rglob("*.md"):
    try:
        text = p.read_text(encoding="utf-8")
    except Exception:
        continue

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        continue

    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        continue

    fm = lines[1:end_idx]
    seen = set()
    new_fm = []
    changed = False

    for line in fm:
        s = line.strip()
        if not s or s.startswith("#"):
            new_fm.append(line)
            continue
        if ":" not in line:
            new_fm.append(line)
            continue

        key = line.split(":", 1)[0].strip().lower()
        if key in seen:
            changed = True
            continue

        seen.add(key)
        new_fm.append(line)

    if changed:
        rebuilt = ["---", *new_fm, "---", *lines[end_idx + 1 :]]
        p.write_text("\n".join(rebuilt) + "\n", encoding="utf-8")
PY

# Use obsidian-export to export markdown content from obsidian
mkdir -p __site/build/content/docs __site/build/__docs
export VAULT_CONTENT_ROOT="__obsidian"
export VAULT_GIT_ROOT="."
SOURCE_MD_COUNT=$(find __obsidian -type f -name '*.md' | wc -l | tr -d ' ')
if [ -z "$STRICT_LINE_BREAKS" ]; then
	__site/bin/obsidian-export --frontmatter=never --hard-linebreaks --no-recursive-embeds __obsidian __site/build/__docs
else
	__site/bin/obsidian-export --frontmatter=never --no-recursive-embeds __obsidian __site/build/__docs
fi

EXPORTED_MD_COUNT=$(find __site/build/__docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Source markdown files: $SOURCE_MD_COUNT"
echo "Exported markdown files: $EXPORTED_MD_COUNT"
if [ "$EXPORTED_MD_COUNT" -ne "$SOURCE_MD_COUNT" ]; then
    echo "ERROR: obsidian-export exported only $EXPORTED_MD_COUNT of $SOURCE_MD_COUNT markdown files."
    exit 1
fi

# Run conversion script
python __site/convert.py

CONVERTED_MD_COUNT=$(find __site/build/content/docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Converted markdown files: $CONVERTED_MD_COUNT"
if [ "$CONVERTED_MD_COUNT" -ne "$EXPORTED_MD_COUNT" ]; then
    echo "ERROR: convert.py produced only $CONVERTED_MD_COUNT of $EXPORTED_MD_COUNT markdown files."
    exit 1
fi

# Build Zola site
zola --root __site/build build --output-dir public
