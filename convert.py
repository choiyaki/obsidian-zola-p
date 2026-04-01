import re
from typing import Dict, List, Tuple

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

import subprocess


def git_commit_time(path: str, first_commit: bool = False) -> int:
    """Returns Unix timestamp of the first or last commit that touched a file."""
    try:
        if first_commit:
            cmd = [
                "git",
                "log",
                "--reverse",
                "--format=%ct",
                "--",
                path,
            ]
        else:
            cmd = ["git", "log", "-1", "--format=%ct", "--", path]

        out = subprocess.check_output(cmd, cwd=str(raw_dir), stderr=subprocess.DEVNULL)
        timestamp = out.decode("utf-8").strip().splitlines()
        if not timestamp:
            raise ValueError("No commit history")
        return int(timestamp[0])
    except Exception:
        # Fallback to filesystem timestamps if git data not available
        st = os.stat(path)
        return int(getattr(st, "st_mtime", st.st_mtime))


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
                
                try:
                    created_tf = git_commit_time(str(doc_path.old_path), first_commit=True)
                except Exception:
                    created_tf = int(doc_path.modified.timestamp())
                
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
                    "modified": doc_path.modified.timestamp(),
                    "created": created_tf,
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
            """Section"""
            # Frontmatter
            # TODO: sort_by depends on settings
            content = [
                "---",
                f'title: "{doc_path.section_title}"',
                "template: docs/section.html",
                f"sort_by: {Settings.options['SORT_BY']}",
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
