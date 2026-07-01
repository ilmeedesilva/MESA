from __future__ import annotations

from collections import Counter, defaultdict
import csv
import json
from pathlib import Path
from typing import Any

import yaml

from mesa.analysis import analyze_services
from mesa.analysis.explainer import grounded_response_for_request
from mesa.analysis.health import flatten_health_scores
from mesa.discovery import discover_service_candidates
from mesa.models import AIExplainerIntent, AIExplainerRequest, Finding, FindingType

LabelKey = tuple[str, tuple[str, ...]]


def evaluate_benchmark(
    benchmark_path: str | Path, chatty_threshold: int = 3
) -> dict[str, Any]:
    path = Path(benchmark_path).resolve()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    systems = data.get("systems", [])
    system_results = [
        _evaluate_system(path.parent, system, chatty_threshold=chatty_threshold)
        for system in systems
    ]

    detector_systems = [_detector_snapshot(system) for system in system_results]
    detector_overall = _aggregate_detector(detector_systems)
    detector_by_type = _aggregate_detector_by_type(detector_systems)
    discovery = _aggregate_named_metrics(
        [system["discovery"] for system in system_results if system.get("discovery")],
        metrics_keys=("precision", "recall", "f1_score"),
    )
    explanations = _aggregate_named_metrics(
        [system["explanations"] for system in system_results if system.get("explanations")],
        metrics_keys=("helpfulness_score", "grounding_score", "coverage_score"),
    )
    recommendations = _aggregate_named_metrics(
        [system["recommendations"] for system in system_results if system.get("recommendations")],
        metrics_keys=("usefulness_score", "structured_coverage", "step_quality_score"),
    )

    return {
        "benchmark": data.get("benchmark", path.stem),
        "version": data.get("version", 1),
        "matching": data.get("matching", "type_and_service_set"),
        "overall": detector_overall,
        "by_type": detector_by_type,
        "systems": detector_systems,
        "detector": {
            "overall": detector_overall,
            "by_type": detector_by_type,
            "systems": detector_systems,
        },
        "discovery": {
            "overall": discovery,
            "systems": [system["discovery"] for system in system_results if system.get("discovery")],
        },
        "explanations": {
            "overall": explanations,
            "systems": [system["explanations"] for system in system_results if system.get("explanations")],
        },
        "recommendations": {
            "overall": recommendations,
            "systems": [
                system["recommendations"] for system in system_results if system.get("recommendations")
            ],
        },
        "evaluation_notes": {
            "systems_with_notes": [
                {
                    "id": system["id"],
                    "notes": system.get("evaluator_notes", []),
                    "limitations": system.get("known_limitations", []),
                }
                for system in system_results
                if system.get("evaluator_notes") or system.get("known_limitations")
            ],
            "track_summary": {
                "detector_quality_is_separate_from_explanation_quality": True,
                "discovery_evaluated_separately": bool(
                    [system for system in system_results if system.get("discovery")]
                ),
                "explanations_evaluated_separately": bool(
                    [system for system in system_results if system.get("explanations")]
                ),
            },
        },
        "phase_i_systems": system_results,
    }


def export_evaluation(report: dict[str, Any], output_dir: str | Path) -> dict[str, str]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    json_path = output / "mesa_evaluation_results.json"
    csv_path = output / "mesa_evaluation_results.csv"
    markdown_path = output / "mesa_evaluation_summary.md"
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

    markdown_path.write_text(_markdown_summary(report), encoding="utf-8")
    return {"json": str(json_path), "csv": str(csv_path), "markdown": str(markdown_path)}


def _evaluate_system(base_dir: Path, system: dict[str, Any], chatty_threshold: int) -> dict[str, Any]:
    service_paths = [str((base_dir / path).resolve()) for path in system.get("service_paths", [])]
    result = analyze_services(service_paths, chatty_threshold=chatty_threshold)
    expected = [_label_from_truth(item) for item in system.get("ground_truth", [])]
    predicted = [_label_from_finding(finding) for finding in result.findings]
    metrics, false_positives, false_negatives = _compare(expected, predicted)

    system_result = {
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
        "evaluator_notes": system.get("evaluator_notes", []),
        "known_limitations": system.get("known_limitations", []),
    }

    discovery_spec = system.get("service_discovery")
    if discovery_spec:
        system_result["discovery"] = _evaluate_service_discovery(
            base_dir=base_dir, system=system, discovery_spec=discovery_spec
        )

    explanation_checks = system.get("explanation_checks", [])
    if explanation_checks:
        system_result["explanations"] = _evaluate_explanations(
            system=system_result,
            result=result,
            checks=explanation_checks,
        )

    system_result["recommendations"] = _evaluate_recommendations(system_result, result.findings)
    return system_result


def _evaluate_service_discovery(
    *, base_dir: Path, system: dict[str, Any], discovery_spec: dict[str, Any]
) -> dict[str, Any]:
    root = (base_dir / discovery_spec["root"]).resolve()
    expected = sorted(str(item) for item in discovery_spec.get("expected_candidates", []))
    candidates = discover_service_candidates(root)
    predicted = sorted(candidate.relative_path for candidate in candidates)
    metrics, false_positives, false_negatives = _compare_simple_labels(expected, predicted)
    return {
        "system_id": system["id"],
        "root": discovery_spec["root"],
        "expected_candidates": expected,
        "predicted_candidates": predicted,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        **metrics,
    }


def _evaluate_explanations(
    *, system: dict[str, Any], result, checks: list[dict[str, Any]]
) -> dict[str, Any]:
    scores = flatten_health_scores(result.summary.get("health_scores", {}))
    cases = []
    for check in checks:
        payload = _build_explanation_request(check, result)
        response = grounded_response_for_request(
            payload,
            intent=payload.intent,
            result=result,
            scores=scores,
            policies=[],
            comparison=None,
        )
        cases.append(_score_explanation_case(system["id"], check, payload, response))

    return {
        "system_id": system["id"],
        "case_count": len(cases),
        "helpfulness_score": round(_average(case["helpfulness_score"] for case in cases), 4),
        "grounding_score": round(_average(case["grounding_score"] for case in cases), 4),
        "coverage_score": round(_average(case["coverage_score"] for case in cases), 4),
        "cases": cases,
    }


def _evaluate_recommendations(system: dict[str, Any], findings: list[Finding]) -> dict[str, Any]:
    scored = []
    for finding in findings:
        recommendation = finding.recommendations[0] if finding.recommendations else None
        structure_score = 0.0
        step_quality = 0.0
        if recommendation:
            structure_score = sum(
                [
                    0.2 if recommendation.root_cause else 0.0,
                    0.15 if recommendation.architectural_consequence else 0.0,
                    0.15 if recommendation.expected_impact else 0.0,
                    0.2 if recommendation.affected_services else 0.0,
                    0.1 if recommendation.affected_files else 0.0,
                    0.2 if recommendation.refactoring_steps else 0.0,
                ]
            )
            step_quality = min(len(recommendation.refactoring_steps), 4) / 4
        scored.append(
            {
                "finding_id": finding.id,
                "type": finding.type.value,
                "has_structured_recommendation": recommendation is not None,
                "structure_score": round(structure_score, 4),
                "step_quality_score": round(step_quality, 4),
            }
        )

    return {
        "system_id": system["id"],
        "finding_count": len(findings),
        "structured_coverage": round(
            _safe_divide(
                sum(1 for item in scored if item["has_structured_recommendation"]), len(scored)
            ),
            4,
        ),
        "usefulness_score": round(_average(item["structure_score"] for item in scored), 4),
        "step_quality_score": round(_average(item["step_quality_score"] for item in scored), 4),
        "findings": scored,
    }


def _build_explanation_request(check: dict[str, Any], result) -> AIExplainerRequest:
    intent = AIExplainerIntent(str(check.get("intent", "SCAN_SUMMARY")))
    finding_id = None
    score_target = check.get("score_target")
    if "finding_type" in check:
        target_services = set(str(item) for item in check.get("services", []))
        for finding in result.findings:
            if finding.type.value != str(check["finding_type"]):
                continue
            if target_services and set(finding.services) != target_services:
                continue
            finding_id = finding.id
            break
    return AIExplainerRequest(
        intent=intent,
        question=str(check.get("question", "")),
        finding_id=finding_id,
        score_target=str(score_target) if score_target else None,
        doc_query=str(check.get("doc_query", "")) if check.get("doc_query") else None,
    )


def _score_explanation_case(
    system_id: str,
    check: dict[str, Any],
    payload: AIExplainerRequest,
    response,
) -> dict[str, Any]:
    required_kinds = {str(item) for item in check.get("required_evidence_kinds", [])}
    response_kinds = {item.kind for item in response.evidence}
    required_phrases = [str(item).lower() for item in check.get("expected_phrases", [])]
    answer_lower = response.answer.lower()

    helpfulness_score = sum(
        [
            0.3 if response.answer.strip() else 0.0,
            0.2 if len(response.suggestions) >= int(check.get("min_suggestions", 1)) else 0.0,
            0.2
            if len(response.follow_up_questions)
            >= int(check.get("min_follow_up_questions", 1))
            else 0.0,
            0.15
            if len(response.limitations) >= int(check.get("min_limitations", 1))
            else 0.0,
            0.15 if all(phrase in answer_lower for phrase in required_phrases) else 0.0,
        ]
    )
    grounding_score = sum(
        [
            0.5 if response.grounded else 0.0,
            0.3 if required_kinds.issubset(response_kinds) else 0.0,
            0.2 if bool(response.evidence) else 0.0,
        ]
    )
    coverage_score = sum(
        [
            0.4 if response.answer.strip() else 0.0,
            0.3 if bool(response.evidence) else 0.0,
            0.15 if bool(response.suggestions) else 0.0,
            0.15 if bool(response.limitations) else 0.0,
        ]
    )

    return {
        "system_id": system_id,
        "id": str(check.get("id", payload.intent.value.lower())),
        "intent": payload.intent.value,
        "question": payload.question,
        "title": response.title,
        "source": response.source,
        "helpfulness_score": round(helpfulness_score, 4),
        "grounding_score": round(grounding_score, 4),
        "coverage_score": round(coverage_score, 4),
        "evidence_kinds": sorted(response_kinds),
        "suggestion_count": len(response.suggestions),
        "follow_up_count": len(response.follow_up_questions),
        "limitation_count": len(response.limitations),
    }


def _detector_snapshot(system: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": system["id"],
        "name": system.get("name", system["id"]),
        "category": system.get("category", ""),
        "service_paths": system.get("service_paths", []),
        "expected_count": system["expected_count"],
        "predicted_count": system["predicted_count"],
        "metrics": system["metrics"],
        "ground_truth": system["ground_truth"],
        "false_positives": system["false_positives"],
        "false_negatives": system["false_negatives"],
        "predicted_findings": system["predicted_findings"],
    }


def _compare(
    expected: list[LabelKey], predicted: list[LabelKey]
) -> tuple[dict[str, Any], list[LabelKey], list[LabelKey]]:
    expected_counts = Counter(expected)
    predicted_counts = Counter(predicted)
    true_positives = sum(
        min(expected_counts[key], predicted_counts[key])
        for key in expected_counts | predicted_counts
    )
    false_positives = _expand_delta(predicted_counts - expected_counts)
    false_negatives = _expand_delta(expected_counts - predicted_counts)
    metrics = _detector_metrics(true_positives, len(false_positives), len(false_negatives))
    return metrics, false_positives, false_negatives


def _aggregate_detector(system_results: list[dict[str, Any]]) -> dict[str, Any]:
    tp = sum(system["metrics"]["true_positives"] for system in system_results)
    fp = sum(system["metrics"]["false_positives"] for system in system_results)
    fn = sum(system["metrics"]["false_negatives"] for system in system_results)
    return _detector_metrics(tp, fp, fn)


def _aggregate_detector_by_type(system_results: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    counts: dict[str, Counter[str]] = defaultdict(Counter)
    for system in system_results:
        expected = Counter(_dict_to_label(item) for item in system.get("false_negatives", []))
        predicted = Counter(_dict_to_label(item) for item in system.get("false_positives", []))
        for label in expected:
            counts[label[0]]["fn"] += expected[label]
        for label in predicted:
            counts[label[0]]["fp"] += predicted[label]
        matched_by_type = _matched_by_type(system)
        for finding_type, count in matched_by_type.items():
            counts[finding_type]["tp"] += count
    return {
        finding_type: _detector_metrics(values["tp"], values["fp"], values["fn"])
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


def _detector_metrics(tp: int, fp: int, fn: int) -> dict[str, Any]:
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


def _aggregate_named_metrics(
    items: list[dict[str, Any]], *, metrics_keys: tuple[str, ...]
) -> dict[str, Any]:
    if not items:
        return {
            "system_count": 0,
            **{key: None for key in metrics_keys},
        }
    return {
        "system_count": len(items),
        **{key: round(_average(float(item[key]) for item in items), 4) for key in metrics_keys},
    }


def _compare_simple_labels(
    expected: list[str], predicted: list[str]
) -> tuple[dict[str, float], list[str], list[str]]:
    expected_counts = Counter(expected)
    predicted_counts = Counter(predicted)
    tp = sum(min(expected_counts[key], predicted_counts[key]) for key in expected_counts | predicted_counts)
    fp = list((predicted_counts - expected_counts).elements())
    fn = list((expected_counts - predicted_counts).elements())
    precision = _safe_divide(tp, tp + len(fp))
    recall = _safe_divide(tp, tp + len(fn))
    f1 = _safe_divide(2 * precision * recall, precision + recall)
    return (
        {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
        },
        sorted(fp),
        sorted(fn),
    )


def _average(values) -> float:
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


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


def _markdown_summary(report: dict[str, Any]) -> str:
    detector = report["detector"]["overall"]
    discovery = report["discovery"]["overall"]
    explanations = report["explanations"]["overall"]
    recommendations = report["recommendations"]["overall"]

    lines = [
        f"# MESA Evaluation Summary",
        "",
        f"Benchmark: `{report['benchmark']}`",
        "",
        "## Detector Quality",
        "",
        f"- Precision: `{detector['precision']}`",
        f"- Recall: `{detector['recall']}`",
        f"- F1: `{detector['f1_score']}`",
        "",
        "## Service Discovery Quality",
        "",
        f"- Systems evaluated: `{discovery['system_count']}`",
        f"- Precision: `{discovery['precision']}`",
        f"- Recall: `{discovery['recall']}`",
        f"- F1: `{discovery['f1_score']}`",
        "",
        "## Explanation Quality",
        "",
        f"- Systems evaluated: `{explanations['system_count']}`",
        f"- Helpfulness score: `{explanations['helpfulness_score']}`",
        f"- Grounding score: `{explanations['grounding_score']}`",
        f"- Coverage score: `{explanations['coverage_score']}`",
        "",
        "## Recommendation Quality",
        "",
        f"- Systems evaluated: `{recommendations['system_count']}`",
        f"- Usefulness score: `{recommendations['usefulness_score']}`",
        f"- Structured coverage: `{recommendations['structured_coverage']}`",
        f"- Step quality score: `{recommendations['step_quality_score']}`",
        "",
        "## Evaluator Notes",
        "",
    ]

    notes = report["evaluation_notes"]["systems_with_notes"]
    if not notes:
        lines.append("- No manual evaluator notes were recorded in this benchmark.")
    else:
        for item in notes:
            lines.append(f"### {item['id']}")
            lines.append("")
            for note in item.get("notes", []):
                lines.append(f"- Note: {note}")
            for limitation in item.get("limitations", []):
                lines.append(f"- Limitation: {limitation}")
            lines.append("")
    return "\n".join(lines).strip() + "\n"
