"""AI-vs-MESA baseline comparison harness.

Prompts a general-purpose LLM directly (no MESA static analysis) with the same
anti-pattern taxonomy MESA's own detectors use, over the same benchmark systems
MESA is evaluated against, and scores its output with the identical
compare_labels() matching logic used to score MESA itself. Each system is run
multiple times to measure determinism: MESA is deterministic by construction
(same code, same input, same output, every time) while an LLM prompted
directly is not, which this harness measures rather than asserts.

Every call this module makes is a real, billed request to the configured
OpenAI API (MESA_OPENAI_API_KEY) - it is never invoked as a side effect of
building or testing MESA itself.
"""

from __future__ import annotations

from collections import Counter
import itertools
import json
import os
from pathlib import Path
import statistics
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

import yaml

from mesa.analysis.explainer import _extract_output_text
from mesa.analysis.extractor import ANALYZED_TEXT_FILENAMES, ANALYZED_TEXT_SUFFIXES
from mesa.evaluation.runner import compare_labels

_MAX_SOURCE_CHARS_PER_SYSTEM = 60_000
_FINDING_TYPES = (
    "CHATTY_SERVICE",
    "CYCLIC_DEPENDENCY",
    "SHARED_DATABASE",
    "HARD_CODED_SERVICE_DEPENDENCY",
    "GOD_SERVICE",
)

_TAXONOMY_PROMPT = """You are analyzing microservice source code for structural \
anti-patterns. Use exactly these definitions (the same ones a static-analysis \
tool applies):

- CHATTY_SERVICE: one service makes a high number of API call sites to another \
single service.
- CYCLIC_DEPENDENCY: a directed cycle exists in the service-to-service call \
graph (A calls B ... calls A).
- SHARED_DATABASE: two or more services connect to the same underlying \
database.
- HARD_CODED_SERVICE_DEPENDENCY: source or config files contain literal \
service URLs, private IP endpoints, localhost ports, or service-like \
hostnames instead of using dynamic discovery/configuration.
- GOD_SERVICE: one service is disproportionately central - large file count, \
many inbound/outbound dependencies, broad domain responsibility.

You will be given the concatenated source code of every service in one \
system, each file preceded by a header naming its service. Identify every \
anti-pattern instance you can find. For each instance, report which type it \
is and which service(s) are involved (list every service name, using the \
exact service directory names given in the headers)."""


def _iter_source_files(service_path: Path):
    if not service_path.is_dir():
        return
    for file_path in sorted(service_path.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix in ANALYZED_TEXT_SUFFIXES or file_path.name in ANALYZED_TEXT_FILENAMES:
            yield file_path


def _build_source_bundle(base_dir: Path, service_paths: list[str]) -> str:
    parts: list[str] = []
    remaining = _MAX_SOURCE_CHARS_PER_SYSTEM
    for relative_path in service_paths:
        service_dir = (base_dir / relative_path).resolve()
        service_name = service_dir.name
        for file_path in _iter_source_files(service_dir):
            if remaining <= 0:
                return "".join(parts)
            try:
                text = file_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            header = f"\n--- service: {service_name} | file: {file_path.name} ---\n"
            chunk = header + text[: max(remaining - len(header), 0)]
            parts.append(chunk)
            remaining -= len(chunk)
    return "".join(parts)


def _response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "type": {"type": "string", "enum": list(_FINDING_TYPES)},
                        "services": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["type", "services"],
                },
            },
        },
        "required": ["findings"],
    }


def _call_openai_for_findings(source_bundle: str, api_key: str) -> list[dict[str, Any]]:
    base_url = os.getenv("MESA_OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("MESA_OPENAI_MODEL", "gpt-5.4-mini")
    timeout_seconds = float(os.getenv("MESA_OPENAI_TIMEOUT_SECONDS", "60"))

    body = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": _TAXONOMY_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": source_bundle}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "mesa_ai_baseline_findings",
                "schema": _response_schema(),
                "strict": True,
            }
        },
    }

    request = urllib_request.Request(
        f"{base_url}/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=timeout_seconds) as response:
            payload_json = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {detail[:240]}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(str(error.reason)) from error

    structured_text = _extract_output_text(payload_json)
    if not structured_text:
        return []
    parsed = json.loads(structured_text)
    return parsed.get("findings", [])


def _label_set(labels: list[dict[str, Any]]) -> frozenset[tuple[str, tuple[str, ...]]]:
    return frozenset(
        (str(item["type"]), tuple(sorted(str(service) for service in item.get("services", []))))
        for item in labels
    )


def _determinism_stats(runs_labels: list[list[dict[str, Any]]]) -> dict[str, Any]:
    label_sets = [_label_set(labels) for labels in runs_labels]
    exact_counts = Counter(label_sets)
    most_common_count = exact_counts.most_common(1)[0][1] if exact_counts else 0
    exact_match_rate = most_common_count / len(label_sets) if label_sets else 0.0

    pairwise_jaccard = []
    for left, right in itertools.combinations(label_sets, 2):
        union_size = len(left | right)
        jaccard = len(left & right) / union_size if union_size else 1.0
        pairwise_jaccard.append(jaccard)
    mean_jaccard = statistics.mean(pairwise_jaccard) if pairwise_jaccard else 1.0

    return {
        "exact_match_rate": round(exact_match_rate, 4),
        "mean_pairwise_jaccard": round(mean_jaccard, 4),
        "distinct_result_sets": len(exact_counts),
        "run_count": len(label_sets),
    }


def _mean_stdev(values: list[float]) -> dict[str, float]:
    mean = statistics.mean(values) if values else 0.0
    stdev = statistics.stdev(values) if len(values) > 1 else 0.0
    return {"mean": round(mean, 4), "stdev": round(stdev, 4)}


def run_ai_baseline(
    benchmark_path: str | Path,
    system_ids: list[str],
    runs: int = 5,
    api_key: str | None = None,
) -> dict[str, Any]:
    """Run a general-purpose LLM directly (no MESA) against the same
    ground-truth systems MESA is scored on, `runs` times per system, and
    report per-run precision/recall/F1 (mean +/- stdev) plus determinism
    stats (exact-match rate, mean pairwise Jaccard similarity across the
    runs' finding-sets). MESA's own equivalent numbers are deterministic by
    construction and are not re-measured here.

    Makes `runs * len(system_ids)` real, billed calls to the configured
    OpenAI API. Callers must obtain explicit user confirmation before
    invoking this with runs/system_ids that were not already confirmed.
    """
    resolved_key = api_key or os.getenv("MESA_OPENAI_API_KEY")
    if not resolved_key:
        raise RuntimeError("MESA_OPENAI_API_KEY is not configured.")

    path = Path(benchmark_path).resolve()
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    systems_by_id = {system["id"]: system for system in data.get("systems", [])}

    system_results = []
    for system_id in system_ids:
        system = systems_by_id.get(system_id)
        if system is None:
            raise ValueError(f"System '{system_id}' not found in {path}")

        source_bundle = _build_source_bundle(path.parent, system.get("service_paths", []))
        ground_truth = system.get("ground_truth", [])

        run_reports = []
        runs_labels = []
        for _ in range(runs):
            predicted = _call_openai_for_findings(source_bundle, resolved_key)
            runs_labels.append(predicted)
            run_reports.append(compare_labels(ground_truth, predicted))

        precision_values = [report["metrics"]["precision"] for report in run_reports]
        recall_values = [report["metrics"]["recall"] for report in run_reports]
        f1_values = [report["metrics"]["f1_score"] for report in run_reports]

        system_results.append(
            {
                "id": system_id,
                "name": system.get("name", system_id),
                "runs": run_reports,
                "precision": _mean_stdev(precision_values),
                "recall": _mean_stdev(recall_values),
                "f1_score": _mean_stdev(f1_values),
                "determinism": _determinism_stats(runs_labels),
            }
        )

    return {"benchmark": str(path), "runs_per_system": runs, "systems": system_results}


def export_ai_baseline(report: dict[str, Any], output_dir: str | Path) -> dict[str, str]:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    json_path = output / "ai_baseline_comparison.json"
    markdown_path = output / "ai_baseline_comparison.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# AI Baseline Comparison",
        "",
        f"Benchmark: `{report['benchmark']}` | Runs per system: {report['runs_per_system']}",
        "",
        "| System | F1 mean | F1 stdev | Precision mean | Recall mean | Exact-match rate | Mean pairwise Jaccard |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for system in report["systems"]:
        lines.append(
            f"| {system['name']} | {system['f1_score']['mean']} | {system['f1_score']['stdev']} | "
            f"{system['precision']['mean']} | {system['recall']['mean']} | "
            f"{system['determinism']['exact_match_rate']} | {system['determinism']['mean_pairwise_jaccard']} |"
        )
    markdown_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    return {"json": str(json_path), "markdown": str(markdown_path)}
