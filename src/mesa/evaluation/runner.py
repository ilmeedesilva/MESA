from __future__ import annotations

from collections import Counter, defaultdict
import csv
import json
from pathlib import Path
from typing import Any

import yaml

from mesa.analysis import analyze_services
from mesa.models import Finding

LabelKey = tuple[str, tuple[str, ...]]


def evaluate_benchmark(benchmark_path: str | Path, chatty_threshold: int = 3) -> dict[str, Any]:
    path = Path(benchmark_path).resolve()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    systems = data.get("systems", [])
    system_results = [
        _evaluate_system(path.parent, system, chatty_threshold=chatty_threshold)
        for system in systems
    ]
    overall = _aggregate(system_results)
    by_type = _aggregate_by_type(system_results)
    return {
        "benchmark": data.get("benchmark", path.stem),
        "version": data.get("version", 1),
        "matching": data.get("matching", "type_and_service_set"),
        "overall": overall,
        "by_type": by_type,
        "systems": system_results,
    }


def export_evaluation(report: dict[str, Any], output_dir: str | Path) -> dict[str, str]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    json_path = output / "mesa_evaluation_results.json"
    csv_path = output / "mesa_evaluation_results.csv"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "system_id",
                "system_name",
                "category",
                "true_positives",
                "false_positives",
                "false_negatives",
                "precision",
                "recall",
                "f1_score",
            ],
        )
        writer.writeheader()
        for system in report["systems"]:
            writer.writerow(
                {
                    "system_id": system["id"],
                    "system_name": system["name"],
                    "category": system.get("category", ""),
                    **system["metrics"],
                }
            )
    return {"json": str(json_path), "csv": str(csv_path)}


def _evaluate_system(base_dir: Path, system: dict[str, Any], chatty_threshold: int) -> dict[str, Any]:
    service_paths = [str((base_dir / path).resolve()) for path in system.get("service_paths", [])]
    result = analyze_services(service_paths, chatty_threshold=chatty_threshold)
    expected = [_label_from_truth(item) for item in system.get("ground_truth", [])]
    predicted = [_label_from_finding(finding) for finding in result.findings]
    metrics, false_positives, false_negatives = _compare(expected, predicted)
    return {
        "id": system["id"],
        "name": system.get("name", system["id"]),
        "category": system.get("category", ""),
        "service_paths": system.get("service_paths", []),
        "expected_count": len(expected),
        "predicted_count": len(predicted),
        "metrics": metrics,
        "ground_truth": [_label_to_dict(label) for label in expected],
        "false_positives": [_label_to_dict(label) for label in false_positives],
        "false_negatives": [_label_to_dict(label) for label in false_negatives],
        "predicted_findings": [
            {
                "id": finding.id,
                "type": finding.type.value,
                "services": sorted(finding.services),
                "severity": finding.severity.value,
                "confidence": finding.confidence,
            }
            for finding in result.findings
        ],
    }


def _compare(expected: list[LabelKey], predicted: list[LabelKey]) -> tuple[dict[str, Any], list[LabelKey], list[LabelKey]]:
    expected_counts = Counter(expected)
    predicted_counts = Counter(predicted)
    true_positives = sum(min(expected_counts[key], predicted_counts[key]) for key in expected_counts | predicted_counts)
    false_positives = _expand_delta(predicted_counts - expected_counts)
    false_negatives = _expand_delta(expected_counts - predicted_counts)
    metrics = _metrics(true_positives, len(false_positives), len(false_negatives))
    return metrics, false_positives, false_negatives


def _aggregate(system_results: list[dict[str, Any]]) -> dict[str, Any]:
    tp = sum(system["metrics"]["true_positives"] for system in system_results)
    fp = sum(system["metrics"]["false_positives"] for system in system_results)
    fn = sum(system["metrics"]["false_negatives"] for system in system_results)
    return _metrics(tp, fp, fn)


def _aggregate_by_type(system_results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for system in system_results:
        matched_tp = system["metrics"]["true_positives"]
        # Type-level metrics are calculated directly from false positives/negatives and matched counts.
        expected = Counter(_dict_to_label(item) for item in system.get("false_negatives", []))
        predicted = Counter(_dict_to_label(item) for item in system.get("false_positives", []))
        for label in expected:
            counts[label[0]]["fn"] += expected[label]
        for label in predicted:
            counts[label[0]]["fp"] += predicted[label]
        matched_by_type = _matched_by_type(system)
        for finding_type, count in matched_by_type.items():
            counts[finding_type]["tp"] += count
        _ = matched_tp
    return {
        finding_type: _metrics(values["tp"], values["fp"], values["fn"])
        for finding_type, values in sorted(counts.items())
    }


def _matched_by_type(system: dict[str, Any]) -> Counter[str]:
    expected = Counter(_label_from_truth(item) for item in system.get("ground_truth", []))
    predicted = Counter(
        (finding["type"], tuple(sorted(finding["services"])))
        for finding in system.get("predicted_findings", [])
    )
    matched: Counter[str] = Counter()
    for key in expected.keys() | predicted.keys():
        count = min(expected[key], predicted[key])
        if count:
            matched[key[0]] += count
    return matched


def _metrics(tp: int, fp: int, fn: int) -> dict[str, Any]:
    precision = _safe_divide(tp, tp + fp)
    recall = _safe_divide(tp, tp + fn)
    f1 = _safe_divide(2 * precision * recall, precision + recall)
    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
    }


def _safe_divide(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 1.0
    return numerator / denominator


def _expand_delta(counter: Counter[LabelKey]) -> list[LabelKey]:
    labels: list[LabelKey] = []
    for label, count in sorted(counter.items()):
        labels.extend([label] * count)
    return labels


def _label_from_truth(item: dict[str, Any]) -> LabelKey:
    return (str(item["type"]), tuple(sorted(str(service) for service in item.get("services", []))))


def _label_from_finding(finding: Finding) -> LabelKey:
    return (finding.type.value, tuple(sorted(finding.services)))


def _label_to_dict(label: LabelKey) -> dict[str, Any]:
    return {"type": label[0], "services": list(label[1])}


def _dict_to_label(item: dict[str, Any]) -> LabelKey:
    return (str(item["type"]), tuple(sorted(item.get("services", []))))
