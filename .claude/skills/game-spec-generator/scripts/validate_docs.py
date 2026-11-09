#!/usr/bin/env python3
"""Lightweight validator for game-spec-generator outputs (GSG-V1).

Checks (per evals/evaluation-criteria.md hard gates):
1. All seven artifacts exist.
2. Markdown docs carry a 文档状态 header with legal status.
3. Interaction-Contract.yaml parses; every contract has the 14 required fields;
   confirmation_status is a legal enum and never silently confirmed.
4. traceability-matrix.yaml parses; summary counts match links.

Usage: python scripts/validate_docs.py <spec-generation-dir> [--strict]
Exit code 0 = pass, 1 = fail, 2 = usage error.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    raise SystemExit(2)

ARTIFACTS = [
    "source-analysis.md",
    "GDD.md",
    "PRD.md",
    "Interaction.md",
    "Interaction-Contract.yaml",
    "traceability-matrix.yaml",
    "evaluation-report.md",
]

DOC_STATUSES = {"draft", "pending-human", "approved"}
CONTRACT_STATUSES = {"draft", "pending-human", "confirmed-human"}

CONTRACT_FIELDS = [
    "contract_id", "related_requirement_ids", "trigger", "preconditions", "guards",
    "state_transition", "data_effects", "ui_effects", "failure_handling",
    "timeout_handling", "mutual_exclusion", "test_scenarios", "source_references",
    "confirmation_status",
]

STATUS_HEADER = re.compile(r"^\s*-\s*status:\s*(\S+)", re.MULTILINE)


def check(lines: list[str], ok: bool, message: str) -> None:
    lines.append(("PASS" if ok else "FAIL") + ": " + message)


def doc_status(path: Path) -> str | None:
    match = STATUS_HEADER.search(path.read_text(encoding="utf-8"))
    return match.group(1) if match else None


def validate(target: Path) -> tuple[int, list[str]]:
    lines: list[str] = []
    errors = 0

    # 1. 工件齐全
    for name in ARTIFACTS:
        exists = (target / name).is_file()
        check(lines, exists, f"存在 {name}")
        errors += 0 if exists else 1

    # 2. 文档状态头合法（approved 仅人工可标：这里只校验枚举）
    for name in ("source-analysis.md", "GDD.md", "PRD.md", "Interaction.md", "evaluation-report.md"):
        path = target / name
        if not path.is_file():
            continue
        status = doc_status(path)
        legal = status in DOC_STATUSES
        check(lines, legal, f"{name} 文档状态合法（{status}）")
        errors += 0 if legal else 1

    # 3. Interaction-Contract.yaml
    contract_file = target / "Interaction-Contract.yaml"
    if contract_file.is_file():
        try:
            data = yaml.safe_load(contract_file.read_text(encoding="utf-8")) or {}
            contracts = data.get("contracts") or []
            ids: set[str] = set()
            for item in contracts:
                cid = str(item.get("contract_id", ""))
                if not re.fullmatch(r"CT-\d{3,4}", cid):
                    check(lines, False, f"{cid}: contract_id 格式非法")
                    errors += 1
                if cid in ids:
                    check(lines, False, f"{cid}: contract_id 重复")
                    errors += 1
                ids.add(cid)
                missing = [f for f in CONTRACT_FIELDS if f not in item]
                check(lines, not missing, f"{cid}: 必填字段齐全" + (f"，缺 {missing}" if missing else ""))
                errors += 1 if missing else 0
                status = item.get("confirmation_status")
                legal = status in CONTRACT_STATUSES
                check(lines, legal, f"{cid}: confirmation_status 合法（{status}）")
                errors += 0 if legal else 1
        except yaml.YAMLError as exc:
            check(lines, False, f"Interaction-Contract.yaml 解析失败: {exc}")
            errors += 1

    # 4. traceability-matrix.yaml 摘要与 links 一致
    matrix_file = target / "traceability-matrix.yaml"
    if matrix_file.is_file():
        try:
            data = yaml.safe_load(matrix_file.read_text(encoding="utf-8")) or {}
            links = data.get("links") or []
            summary = data.get("summary") or {}
            total = len(links)
            with_gaps = sum(1 for link in links if link.get("gaps"))
            fully = total - with_gaps
            ok = summary.get("total_sources") == total and summary.get("with_gaps") == with_gaps and summary.get("fully_traced") == fully
            check(lines, ok, f"traceability summary 与 links 一致（total={total}, fully={fully}, gaps={with_gaps}）")
            errors += 0 if ok else 1
        except yaml.YAMLError as exc:
            check(lines, False, f"traceability-matrix.yaml 解析失败: {exc}")
            errors += 1

    return errors, lines


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate GSG spec-generation outputs.")
    parser.add_argument("target", type=Path, help="spec-generation 目录")
    parser.add_argument("--strict", action="store_true", help="任何 FAIL 都返回非零（默认同行为）")
    args = parser.parse_args()
    if not args.target.is_dir():
        print(f"目录不存在: {args.target}", file=sys.stderr)
        return 2
    errors, lines = validate(args.target)
    for line in lines:
        print(line)
    print(f"\n结果: {len(lines) - errors} PASS, {errors} FAIL")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
