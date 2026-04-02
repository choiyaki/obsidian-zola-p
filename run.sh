#!/bin/bash

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

# Use obsidian-export to export markdown content from obsidian
mkdir -p __site/build/content/docs __site/build/__docs
export VAULT_CONTENT_ROOT="__obsidian"
export VAULT_GIT_ROOT="."
if [ -z "$STRICT_LINE_BREAKS" ]; then
	__site/bin/obsidian-export --frontmatter=never --hard-linebreaks --no-recursive-embeds __obsidian __site/build/__docs
else
	__site/bin/obsidian-export --frontmatter=never --no-recursive-embeds __obsidian __site/build/__docs
fi

# Run conversion script
python __site/convert.py

# Build Zola site
zola --root __site/build build --output-dir public
