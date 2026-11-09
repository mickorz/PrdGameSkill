#!/usr/bin/env python3
"""Initialize a spec-generation workspace for a game (GSG-V1).

Adapted from game-ui-design-workflow (MIT License)
https://github.com/mickorz/game-ui-design-workflow scripts/init_project.py
Changes: scaffold = examples/<game>/spec-generation/ with the seven GSG artifacts;
templates read from this skill's templates/ directory.
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path


PROJECT_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

SCAFFOLD = [
    ("Source-Analysis.template.md", "source-analysis.md"),
    ("GDD.template.md", "GDD.md"),
    ("PRD.template.md", "PRD.md"),
    ("Interaction.template.md", "Interaction.md"),
    ("Interaction-Contract.template.yaml", "Interaction-Contract.yaml"),
    ("Traceability-Matrix.template.yaml", "traceability-matrix.yaml"),
    ("Evaluation-Report.template.md", "evaluation-report.md"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create <base-dir>/<game-id>/spec-generation scaffolds from templates."
    )
    parser.add_argument("project_id", help="Lowercase letters, numbers, and hyphens.")
    parser.add_argument(
        "--root",
        type=Path,
        help="Skill root. Defaults to the parent of this script directory.",
    )
    parser.add_argument(
        "--base-dir",
        default="examples",
        help="Base dir for project outputs relative to repo root. Defaults to examples.",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        help="Repository root containing base-dir. Defaults to skill root's parent's parent.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing template files; user content in other files is never removed.",
    )
    return parser.parse_args()


def copy_template(source: Path, target: Path, project_id: str, force: bool) -> bool:
    if target.exists() and not force:
        return False
    text = source.read_text(encoding="utf-8").replace("{{PROJECT_ID}}", project_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")
    return True


def initialize(
    skill_root: Path, repo_root: Path, base_dir: str, project_id: str, force: bool
) -> tuple[Path, list[Path]]:
    if not PROJECT_ID_PATTERN.fullmatch(project_id):
        raise ValueError("project_id must use lowercase letters, numbers, and single hyphens")

    templates = skill_root / "templates"
    missing = [name for name, _ in SCAFFOLD if not (templates / name).is_file()]
    if missing:
        raise FileNotFoundError(f"templates not found under {templates}: {missing}")

    target_dir = repo_root / base_dir / project_id / "spec-generation"
    written: list[Path] = []
    for template_name, output_name in SCAFFOLD:
        target = target_dir / output_name
        if copy_template(templates / template_name, target, project_id, force):
            written.append(target)
    return target_dir, written


def main() -> int:
    args = parse_args()
    script_root = Path(__file__).resolve().parent.parent
    skill_root = Path(args.root) if args.root else script_root
    repo_root = (
        Path(args.repo_root)
        if args.repo_root
        else script_root.parent.parent  # skills/<skill> -> repo root
    )
    target_dir, written = initialize(
        skill_root, repo_root, args.base_dir, args.project_id, args.force
    )
    print(f"project: {args.project_id}")
    print(f"workspace: {target_dir}")
    if written:
        for path in written:
            print(f"  created: {path.relative_to(repo_root)}")
    else:
        print("  all files already exist (use --force to overwrite)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
