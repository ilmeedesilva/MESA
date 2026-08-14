from __future__ import annotations

import csv
import io
import json
from collections import Counter
from pathlib import Path

from mesa.evaluation import evaluate_findings_against_ground_truth, find_matching_ground_truth_system
from mesa.models import (
    AnalysisResult,
    ProjectSetup,
    ResearchEvaluationAccuracyMode,
    ResearchEvaluationDraft,
    ResearchEvaluationRecord,
    ResearchEvaluationRecordCreate,
    ResearchEvaluationRecordUpdate,
    ScanRecord,
    Severity,
)


def calculate_metrics(
    true_positives: int | None,
    false_positives: int | None,
    false_negatives: int | None,
) -> tuple[float | None, float | None, float | None]:
    if true_positives is None or false_positives is None or false_negatives is None:
        return None, None, None
    precision_denominator = true_positives + false_positives
    recall_denominator = true_positives + false_negatives
    precision = true_positives / precision_denominator if precision_denominator else None
    recall = true_positives / recall_denominator if recall_denominator else None
    if precision is None or recall is None or precision + recall == 0:
        f1_score = None
    else:
        f1_score = 2 * precision * recall / (precision + recall)
    return _round_metric(precision), _round_metric(recall), _round_metric(f1_score)


def with_calculated_metrics(
    record: ResearchEvaluationRecordCreate | ResearchEvaluationRecordUpdate,
) -> dict:
    data = record.model_dump()
    precision, recall, f1_score = calculate_metrics(
        data.get("true_positives"),
        data.get("false_positives"),
        data.get("false_negatives"),
    )
    data.update({"precision": precision, "recall": recall, "f1_score": f1_score})
    return data


def record_draft_from_scan(
    scan: ScanRecord,
    result: AnalysisResult,
    project_setup: ProjectSetup | None = None,
) -> ResearchEvaluationDraft:
    severities = Counter(finding.severity for finding in result.findings)
    languages = sorted({service.language for service in result.services if service.language != "unknown"})
    edge_types = Counter(str(edge.get("type", "unknown")) for edge in result.graph.get("edges", []))
    repository_source = result.summary.get("repository_source", {})
    repo_name = (
        scan.source_label
        or repository_source.get("source_label")
        or scan.repo_url
        or f"Scan {scan.id[:8]}"
    )
    repo_url = scan.repo_url or repository_source.get("repo_url")
    commit_ref = (
        scan.commit_sha
        or scan.repo_ref
        or repository_source.get("commit_sha")
        or repository_source.get("repo_ref")
    )
    warnings = repository_source.get("warnings", [])
    expected_services = _expected_service_count(project_setup)
    detected_services = len({service.name for service in result.services})
    benchmark_match = find_matching_ground_truth_system(
        [service.root_path for service in result.services if service.root_path]
    )

    accuracy_mode = ResearchEvaluationAccuracyMode.MANUAL_VALIDATION_REQUIRED
    matched_benchmark_id = None
    matched_benchmark_name = None
    true_positives = None
    false_positives = None
    false_negatives = None
    precision = None
    recall = None
    f1_score = None

    if benchmark_match:
        metrics_report = evaluate_findings_against_ground_truth(
            result.findings,
            benchmark_match.get("ground_truth", []),
        )
        metrics = metrics_report["metrics"]
        accuracy_mode = ResearchEvaluationAccuracyMode.GROUND_TRUTH
        matched_benchmark_id = str(benchmark_match.get("system_id")) if benchmark_match.get("system_id") else None
        matched_benchmark_name = (
            str(benchmark_match.get("system_name")) if benchmark_match.get("system_name") else None
        )
        true_positives = metrics["true_positives"]
        false_positives = metrics["false_positives"]
        false_negatives = metrics["false_negatives"]
        precision = metrics["precision"]
        recall = metrics["recall"]
        f1_score = metrics["f1_score"]

    notes = _draft_notes(
        scan=scan,
        commit_ref=commit_ref,
        warnings=warnings if isinstance(warnings, list) else [],
        benchmark_name=matched_benchmark_name,
        accuracy_mode=accuracy_mode,
    )

    return ResearchEvaluationDraft(
        project_id=scan.project_id,
        scan_id=scan.id,
        repo_name=str(repo_name),
        repo_url=str(repo_url) if repo_url else None,
        commit_ref=str(commit_ref) if commit_ref else None,
        scan_date=scan.completed_at or scan.created_at,
        project_type=", ".join(languages) if languages else "unknown",
        expected_services=expected_services,
        detected_services=detected_services,
        expected_patterns=None,
        detected_patterns=", ".join(f"{kind}: {count}" for kind, count in sorted(edge_types.items())),
        total_findings=len(result.findings),
        critical_findings=severities.get(Severity.CRITICAL, 0),
        high_findings=severities.get(Severity.HIGH, 0),
        medium_findings=severities.get(Severity.MEDIUM, 0),
        low_findings=severities.get(Severity.LOW, 0),
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        notes=notes,
        limitations=_draft_limitations(accuracy_mode),
        research_relevance=(
            "Use this record to compare expected architecture knowledge with MESA's static detection output."
        ),
        suitable_for_report=False,
        accuracy_mode=accuracy_mode,
        matched_benchmark_id=matched_benchmark_id,
        matched_benchmark_name=matched_benchmark_name,
        precision=precision,
        recall=recall,
        f1_score=f1_score,
    )


def record_create_from_scan(
    scan: ScanRecord,
    result: AnalysisResult,
    project_setup: ProjectSetup | None = None,
) -> ResearchEvaluationRecordCreate:
    draft = record_draft_from_scan(scan, result, project_setup)
    payload = draft.model_dump(
        exclude={
            "project_id",
            "accuracy_mode",
            "matched_benchmark_id",
            "matched_benchmark_name",
            "precision",
            "recall",
            "f1_score",
        }
    )
    return ResearchEvaluationRecordCreate(**payload)


def export_records(records: list[ResearchEvaluationRecord], export_format: str) -> str:
    if export_format == "json":
        return json.dumps([record.model_dump(mode="json") for record in records], indent=2)
    if export_format == "csv":
        return _export_csv(records)
    if export_format == "markdown":
        return _export_markdown(records)
    raise ValueError("Export format must be one of: csv, markdown, json")


def _export_csv(records: list[ResearchEvaluationRecord]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=_export_fields())
    writer.writeheader()
    for record in records:
        writer.writerow(_record_row(record))
    return output.getvalue()


def _export_markdown(records: list[ResearchEvaluationRecord]) -> str:
    fields = _export_fields()
    lines = [
        "| " + " | ".join(fields) + " |",
        "| " + " | ".join("---" for _ in fields) + " |",
    ]
    for record in records:
        row = _record_row(record)
        lines.append("| " + " | ".join(_markdown_cell(row[field]) for field in fields) + " |")
    return "\n".join(lines) + "\n"


def _export_fields() -> list[str]:
    return [
        "repo_name",
        "commit_ref",
        "expected_services",
        "detected_services",
        "total_findings",
        "true_positives",
        "false_positives",
        "false_negatives",
        "precision",
        "recall",
        "f1_score",
        "notes",
    ]


def _record_row(record: ResearchEvaluationRecord) -> dict[str, str]:
    return {
        "repo_name": record.repo_name,
        "commit_ref": record.commit_ref or "",
        "expected_services": _format_optional(record.expected_services),
        "detected_services": str(record.detected_services),
        "total_findings": str(record.total_findings),
        "true_positives": _format_optional(record.true_positives),
        "false_positives": _format_optional(record.false_positives),
        "false_negatives": _format_optional(record.false_negatives),
        "precision": _format_metric(record.precision),
        "recall": _format_metric(record.recall),
        "f1_score": _format_metric(record.f1_score),
        "notes": record.notes or "",
    }


def _format_optional(value: int | None) -> str:
    return "N/A" if value is None else str(value)


def _format_metric(value: float | None) -> str:
    return "N/A" if value is None else f"{value:.4f}"


def _markdown_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def _round_metric(value: float | None) -> float | None:
    return round(value, 4) if value is not None else None


def _expected_service_count(project_setup: ProjectSetup | None) -> int | None:
    if project_setup is None:
        return None
    configured_paths = project_setup.selected_service_paths or project_setup.manual_service_paths
    normalized = {
        _normalized_service_path(path)
        for path in configured_paths
        if isinstance(path, str) and path.strip()
    }
    return len(normalized) if normalized else None


def _normalized_service_path(value: str) -> str:
    return Path(value).as_posix().strip()


def _draft_notes(
    *,
    scan: ScanRecord,
    commit_ref: str | None,
    warnings: list[str],
    benchmark_name: str | None,
    accuracy_mode: ResearchEvaluationAccuracyMode,
) -> str:
    parts = [f"Automatically populated from scan {scan.id}."]
    parts.append(
        f"Commit/ref: {commit_ref}." if commit_ref else "Commit/ref: N/A."
    )
    parts.append("Services and findings were derived from the selected scan.")
    if accuracy_mode == ResearchEvaluationAccuracyMode.GROUND_TRUTH and benchmark_name:
        parts.append(f"TP/FP/FN were calculated from benchmark ground truth '{benchmark_name}'.")
    else:
        parts.append("TP/FP/FN require manual validation because no matching ground-truth findings were available.")
    if warnings:
        parts.append("Warnings: " + "; ".join(str(warning) for warning in warnings[:3]) + ".")
    return " ".join(parts)


def _draft_limitations(accuracy_mode: ResearchEvaluationAccuracyMode) -> str:
    if accuracy_mode == ResearchEvaluationAccuracyMode.GROUND_TRUTH:
        return (
            "Ground-truth metrics were matched against the built-in benchmark methodology. "
            "Interpret them as benchmark-specific validation, not universal real-world accuracy."
        )
    return "Manual validation is still required for true positives, false positives, and false negatives."
