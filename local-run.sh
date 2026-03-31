#!/bin/bash

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

# Use obsidian-export to export markdown content from obsidian
mkdir -p build/content/docs build/__docs
if [ -z "$STRICT_LINE_BREAKS" ]; then
	bin/obsidian-export --frontmatter=never --hard-linebreaks --no-recursive-embeds $VAULT build/__docs
else
	bin/obsidian-export --frontmatter=never --no-recursive-embeds $VAULT build/__docs
fi

# Run conversion script
source env.sh && export SITE_URL=local && export REPO_URL=local && python3 convert.py && rm env.sh

# Serve Zola site
bin/zola --root=build serve
