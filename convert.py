import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from utils import (
    DocLink,
    DocPath,
    Settings,
    parse_graph,
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
    vault = os.environ.get("VAULT")
    if not vault:
        return None, None

    vault_dir = Path(vault).resolve()
    if not vault_dir.is_dir():
        return None, None

    try:
        rel = old_path.relative_to(raw_dir)
    except Exception:
        return None, None

    rel_str = str(rel)

    def run_git(extra_args: list) -> Optional[int]:
        try:
            out = subprocess.check_output(
                ["git", "log", "--format=%ct"] + extra_args + ["--", rel_str],
                cwd=str(vault_dir),
                stderr=subprocess.DEVNULL,
            ).decode("utf-8").strip()
            lines = out.splitlines()
            return int(lines[0]) if lines else None
        except Exception:
            return None

    modified_ts = run_git(["-1"])
    created_ts = run_git(["--reverse"])

    return modified_ts, created_ts


if __name__ == "__main__":

    Settings.parse_env()
    Settings.sub_file(site_dir / "config.toml")
    Settings.sub_file(site_dir / "content/_index.md")
    Settings.sub_file(site_dir / "templates/macros/footer.html")
    Settings.sub_file(site_dir / "static/js/graph.js")

    nodes: Dict[str, str] = {}
    edges: List[Tuple[str, str]] = []
    page_meta = []
    section_count = 0

    all_paths = list(sorted(raw_dir.glob("**/*")))

    for path in [raw_dir, *all_paths]:
        doc_path = DocPath(path)
        if doc_path.is_file:
            if doc_path.is_md:
                # Page
                nodes[doc_path.abs_url] = doc_path.page_title

                # Get git-based timestamps (作成日 / 更新日)
                git_modified, git_created = get_git_timestamps(doc_path.old_path)
                fs_ts = int(doc_path.modified.timestamp())
                modified_ts = git_modified if git_modified else fs_ts
                created_ts = git_created if git_created else fs_ts

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
                    f"date: {doc_path.modified}",
                    f"updated: {doc_path.modified}",
                    "template: docs/page.html",
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
    write_settings()
