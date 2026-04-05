#!/bin/bash

set -euo pipefail

# Check for python-is-python3 installed
if ! command -v python3 &>/dev/null; then
	echo "It appears you do not have python3 installed"
	exit 1
fi

# Check for zola being installed
if [ ! -f "bin/zola" ]; then
	echo "zola could not be found please run the curl download command provided."
	exit 1
fi

# Check for correct slugify package
PYTHON_ERROR=$(eval "python3 -c 'from slugify import slugify; print(slugify(\"Test String One\"))'" 2>&1)

if [[ $PYTHON_ERROR != "test-string-one" ]]; then
	if [[ $PYTHON_ERROR =~ "NameError" ]]; then
		echo "It appears you have the wrong version of slugify installed, the required pip package is python-slugify"
	else
		echo "It appears you do not have slugify installed. Install it with 'pip install python-slugify'"
	fi
	exit 1
fi

# Check for rtoml package
PYTHON_ERROR=$(eval "python3 -c 'import rtoml'" 2>&1)

if [[ $PYTHON_ERROR =~ "ModuleNotFoundError" ]]; then
	echo "It appears you do not have rtoml installed. Install it with 'pip install rtoml'"
	exit 1
fi

# Fetch the vault from the Published repository
if [ ! -d "Published" ]; then
	git clone https://github.com/choiyaki/Published.git Published
else
	cd Published
	git pull origin main
	cd ..
fi
export VAULT="Published"

# Pull environment variables from the vault's netlify.toml when building (by generating env.sh to be sourced)
python3 env.py

# Remove previous build and sync Zola template contents
rm -rf build
rsync -a zola/ build
rsync -a content/ build/content

# Normalize YAML frontmatter that breaks obsidian-export.
python3 - <<'PY'
from pathlib import Path

root = Path("Published")


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

# Use obsidian-export to export markdown content from obsidian
mkdir -p build/content/docs build/__docs
SOURCE_MD_COUNT=$(find "$VAULT" -type f -name '*.md' | wc -l | tr -d ' ')
if [ -z "${STRICT_LINE_BREAKS:-}" ]; then
	bin/obsidian-export --frontmatter=never --hard-linebreaks --no-recursive-embeds $VAULT build/__docs
else
	bin/obsidian-export --frontmatter=never --no-recursive-embeds $VAULT build/__docs
fi

EXPORTED_MD_COUNT=$(find build/__docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Source markdown files: $SOURCE_MD_COUNT"
echo "Exported markdown files: $EXPORTED_MD_COUNT"
if [ "$EXPORTED_MD_COUNT" -ne "$SOURCE_MD_COUNT" ]; then
	echo "ERROR: obsidian-export exported only $EXPORTED_MD_COUNT of $SOURCE_MD_COUNT markdown files."
	exit 1
fi

# Run conversion script
source env.sh && export SITE_URL=local && export REPO_URL=local && python3 convert.py && rm env.sh

CONVERTED_MD_COUNT=$(find build/content/docs -type f -name '*.md' | wc -l | tr -d ' ')
echo "Converted markdown files: $CONVERTED_MD_COUNT"
if [ "$CONVERTED_MD_COUNT" -ne "$EXPORTED_MD_COUNT" ]; then
	echo "ERROR: convert.py produced only $CONVERTED_MD_COUNT of $EXPORTED_MD_COUNT markdown files."
	exit 1
fi

# Serve Zola site
bin/zola --root=build serve
