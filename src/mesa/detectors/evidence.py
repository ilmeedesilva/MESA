from __future__ import annotations

from typing import Any

from mesa.models import EvidenceChainItem, SourceLocation


def source_location_from_dict(value: Any) -> SourceLocation | None:
    if not isinstance(value, dict):
        return None
    file_path = value.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        return None
    line_number = value.get("line_number")
    return SourceLocation(
        file_path=file_path,
        line_number=line_number if isinstance(line_number, int) else None,
    )


def evidence_chain_item(
    step: str,
    description: str,
    *,
    source: Any = None,
    data: dict[str, Any] | None = None,
) -> EvidenceChainItem:
    return EvidenceChainItem(
        step=step,
        description=description,
        source=source_location_from_dict(source),
        data=data or {},
    )


def source_files_from_evidence(evidence: list[dict[str, Any]]) -> list[str]:
    files: set[str] = set()
    for item in _walk_dicts(evidence):
        source = item.get("source")
        if isinstance(source, dict):
            _add_source(files, source)
        _add_source(files, item)
    return sorted(files)


def _add_source(files: set[str], item: dict[str, Any]) -> None:
    file_path = item.get("file_path")
    if not isinstance(file_path, str) or not file_path:
        return
    line_number = item.get("line_number")
    files.add(f"{file_path}:{line_number}" if isinstance(line_number, int) else file_path)


def _walk_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from _walk_dicts(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _walk_dicts(nested)
