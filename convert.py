import json
import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from utils import (
    DocLink,
    DocPath,
    Settings,
    parse_graph,
    export_missing_pages,
    export_page_data,
    pp,
    raw_dir,
    site_dir,
    write_settings,
)


def get_git_timestamps(old_path: Path) -> Tuple[Optional[int], Optional[int]]:
    """
    Returns (modified_ts, created_ts) from the VAULT git history.
    modified_ts = most recent commit timestamp for the file.
    created_ts  = first commit timestamp for the file.
    Falls back to (None, None) when vault/git history is unavailable.
    """
    content_root = os.environ.get("VAULT_CONTENT_ROOT") or os.environ.get("VAULT")
    if not content_root:
        return None, None

    content_root_dir = Path(content_root).resolve()
    if not content_root_dir.is_dir():
        return None, None

    git_root = os.environ.get("VAULT_GIT_ROOT")
    if git_root:
        git_root_dir = Path(git_root).resolve()
    else:
        # Local run fallback: VAULT itself is typically a git repo.
        git_root_dir = content_root_dir

    if not (git_root_dir / ".git").exists():
        return None, None

    try:
        rel = old_path.relative_to(raw_dir)
    except Exception:
        return None, None

    # Netlify build moves vault files under __obsidian at runtime, but git history
    # still often uses original repo-root paths. Try both pathspec candidates.
    candidates = [str(rel)]
    if git_root_dir != content_root_dir:
        try:
            prefixed = str(content_root_dir.relative_to(git_root_dir) / rel)
            if prefixed not in candidates:
                candidates.append(prefixed)
        except Exception:
            pass

    def run_git(extra_args: list) -> Optional[int]:
        for rel_str in candidates:
            try:
                out = subprocess.check_output(
                    ["git", "log", "--format=%ct"] + extra_args + ["--", rel_str],
                    cwd=str(git_root_dir),
                    stderr=subprocess.DEVNULL,
                ).decode("utf-8").strip()
                lines = out.splitlines()
                if lines:
                    return int(lines[0])
            except Exception:
                continue
        return None

    modified_ts = run_git(["-1"])
    created_ts = run_git(["--reverse"])

    return modified_ts, created_ts


def _parse_timestamp(value: str) -> Optional[int]:
    raw = value.strip().strip('"').strip("'")
    if not raw:
        return None

    # Numeric unix timestamps (seconds / milliseconds)
    if re.fullmatch(r"\d+(\.\d+)?", raw):
        num = float(raw)
        if num > 1_000_000_000_000:  # milliseconds
            num = num / 1000.0
        return int(num)

    normalized = raw.replace("Z", "+00:00")
    fmts = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
    ]

    try:
        return int(datetime.fromisoformat(normalized).timestamp())
    except Exception:
        pass

    for fmt in fmts:
        try:
            return int(datetime.strptime(raw, fmt).timestamp())
        except Exception:
            continue

    return None


def get_yaml_timestamps(old_path: Path) -> Tuple[Optional[int], Optional[int]]:
    """
    Read front matter from original source file and return (updated_ts, created_ts).
    Priority keys:
      - created: created
      - updated: update, updated
    """
    content_root = os.environ.get("VAULT_CONTENT_ROOT") or os.environ.get("VAULT")
    if not content_root:
        return None, None

    content_root_dir = Path(content_root).resolve()
    if not content_root_dir.is_dir():
        return None, None

    try:
        rel = old_path.relative_to(raw_dir)
    except Exception:
        return None, None

    source_file = content_root_dir / rel
    if not source_file.exists() or not source_file.is_file():
        return None, None

    try:
        text = source_file.read_text(encoding="utf-8")
    except Exception:
        return None, None

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, None

    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        return None, None

    frontmatter = lines[1:end_idx]
    created_val = None
    updated_val = None

    for line in frontmatter:
        m = re.match(r"^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$", line)
        if not m:
            continue
        key = m.group(1).strip().lower()
        val = m.group(2)

        if key == "created" and created_val is None:
            created_val = _parse_timestamp(val)
        elif key in ("update", "updated") and updated_val is None:
            updated_val = _parse_timestamp(val)

    return updated_val, created_val


def ts_to_iso(ts: int) -> str:
    return datetime.fromtimestamp(ts).astimezone().isoformat(timespec="seconds")


if __name__ == "__main__":

    Settings.parse_env()
    Settings.sub_file(site_dir / "config.toml")
    Settings.sub_file(site_dir / "content/_index.md")
    Settings.sub_file(site_dir / "templates/macros/footer.html")
    Settings.sub_file(site_dir / "static/js/graph.js")

    # Pages that exist only because something links to them (obsidian-export
    # emits an empty stub note for such broken wikilinks so the link stays
    # followable). These aren't real vault notes, so they're excluded from
    # page listings and flagged for the frontend to style differently,
    # Cosense-style.
    stub_manifest_path = site_dir / "stub_pages.json"
    if stub_manifest_path.exists():
        stub_rel_paths = {
            Path(p) for p in json.loads(stub_manifest_path.read_text(encoding="utf-8"))
        }
    else:
        stub_rel_paths = set()

    nodes: Dict[str, str] = {}
    edges: List[Tuple[str, str]] = []
    page_meta = []
    missing_urls: List[str] = []
    section_count = 0
    written_paths: Dict[Path, Path] = {}

    all_paths = list(sorted(raw_dir.glob("**/*")))

    for path in [raw_dir, *all_paths]:
        doc_path = DocPath(path)
        if doc_path.is_file:
            # Two differently-named source files can slugify/sanitize to the
            # same output path (e.g. differing only by punctuation or case).
            # Writing both would silently overwrite the first with the
            # second, so fail loudly and name both offending files instead
            # of letting the exported-vs-converted file count mismatch.
            if doc_path.new_path in written_paths:
                raise SystemExit(
                    "FATAL: output path collision, two source files produce "
                    f"the same converted path '{doc_path.new_rel_path}':\n"
                    f"  - {written_paths[doc_path.new_path]}\n"
                    f"  - {doc_path.old_rel_path}\n"
                    "Rename one of these files in the vault to make them "
                    "distinct after slugification."
                )
            written_paths[doc_path.new_path] = doc_path.old_rel_path

            if doc_path.is_md:
                # Page
                nodes[doc_path.abs_url] = doc_path.page_title
                is_stub = doc_path.old_rel_path in stub_rel_paths
                if is_stub:
                    missing_urls.append(doc_path.abs_url)

                # Get git-based timestamps (作成日 / 更新日)
                yaml_modified, yaml_created = get_yaml_timestamps(doc_path.old_path)
                git_modified, git_created = get_git_timestamps(doc_path.old_path)
                fs_ts = int(doc_path.modified.timestamp())
                created_ts = yaml_created or git_created or fs_ts
                modified_ts = yaml_modified or git_modified or created_ts

                content = doc_path.content
                parsed_lines: List[str] = []
                for line in content:
                    parsed_line, linked = DocLink.parse(line, doc_path)

                    # Fix LaTEX new lines
                    parsed_line = re.sub(r"\\\\\s*$", r"\\\\\\\\", parsed_line)

                    parsed_lines.append(parsed_line)

                    edges.extend([doc_path.edge(rel_path) for rel_path in linked])

                full_content = "\x0a".join(parsed_lines)
                thumbnail = None
                img_match = re.search(r'!\[.*?\]\((.*?)\)|<img[^>]+src=["\'](.*?)["\']', full_content)
                if img_match:
                    possible_url = img_match.group(1) or img_match.group(2)
                    if not possible_url.startswith("http") and not possible_url.startswith("/"):
                        possible_url = f"/docs/{possible_url}"
                    thumbnail = possible_url

                # Stub pages exist only to keep links followable; they aren't
                # real notes, so they're left out of page listings/search.
                if not is_stub:
                    page_meta.append({
                        "url": doc_path.abs_url,
                        "title": doc_path.page_title,
                        "modified": modified_ts,
                        "created": created_ts,
                        "content": full_content,
                        "thumbnail": thumbnail,
                    })

                content = [
                    "---",
                    f'title: "{doc_path.page_title}"',
                    f"date: {ts_to_iso(created_ts)}",
                    f"updated: {ts_to_iso(modified_ts)}",
                    "template: docs/page.html",
                    "extra:",
                    f"    stub: {'true' if is_stub else 'false'}",
                    "---",
                    # To add last line-break
                    "",
                ]
                doc_path.write(["\n".join(content), *parsed_lines])
                print(f"Found page: {doc_path.new_rel_path}")
            else:
                # Resource
                doc_path.copy()
                print(f"Found resource: {doc_path.new_rel_path}")
        else:
            # Section
            sort_val = Settings.options.get("SORT_BY", "title")
            if sort_val not in ("date", "updatedate", "title", "weight"):
                sort_val = "title"
            content = [
                "---",
                f'title: "{doc_path.section_title}"',
                "template: docs/section.html",
                f"sort_by: {sort_val}",
                f"weight: {section_count}",
                "extra:",
                f"    sidebar: {doc_path.section_sidebar}",
                "---",
                # To add last line-break
                "",
            ]
            section_count += 1
            doc_path.write_to("_index.md", "\n".join(content))
            print(f"Found section: {doc_path.new_rel_path}")

    pp(nodes)
    pp(edges)
    parse_graph(nodes, edges)
    export_page_data(page_meta)
    export_missing_pages(missing_urls)
    write_settings()
