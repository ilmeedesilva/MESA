import json
from pathlib import Path
from types import SimpleNamespace

import anthropic

from mesa.evaluation import ai_baseline as ai_baseline_module
from mesa.evaluation import compare_labels, export_ai_baseline, run_ai_baseline

ROOT = Path(__file__).parent.parent


class _FakeHTTPResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self) -> "_FakeHTTPResponse":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        return False


def test_compare_labels_reuses_mesa_matching_rules() -> None:
    expected = [{"type": "CYCLIC_DEPENDENCY", "services": ["order-service", "payment-service"]}]
    predicted = [
        {"type": "CYCLIC_DEPENDENCY", "services": ["payment-service", "order-service"]},
        {"type": "CHATTY_SERVICE", "services": ["order-service", "payment-service"]},
    ]

    result = compare_labels(expected, predicted)

    assert result["metrics"]["true_positives"] == 1
    assert result["metrics"]["precision"] == 0.5
    assert result["metrics"]["recall"] == 1.0
    assert result["false_positives"] == [{"type": "CHATTY_SERVICE", "services": ["order-service", "payment-service"]}]
    assert result["false_negatives"] == []


def test_build_source_bundle_concatenates_service_files_with_headers() -> None:
    bundle = ai_baseline_module._build_source_bundle(
        ROOT / "tests" / "fixtures" / "cycle",
        ["order-service", "payment-service"],
    )

    assert "service: order-service" in bundle
    assert "service: payment-service" in bundle


def test_build_source_bundle_respects_max_chars_cap(monkeypatch) -> None:
    monkeypatch.setattr(ai_baseline_module, "_MAX_SOURCE_CHARS_PER_SYSTEM", 50)

    bundle = ai_baseline_module._build_source_bundle(
        ROOT / "tests" / "fixtures" / "cycle",
        ["order-service", "payment-service"],
    )

    assert len(bundle) <= 50 + len("\n--- service: order-service | file: x ---\n")


def test_determinism_stats_identical_runs_score_perfect_agreement() -> None:
    identical_labels = [{"type": "GOD_SERVICE", "services": ["platform-service"]}]
    runs_labels = [identical_labels, identical_labels, identical_labels]

    stats = ai_baseline_module._determinism_stats(runs_labels)

    assert stats["exact_match_rate"] == 1.0
    assert stats["mean_pairwise_jaccard"] == 1.0
    assert stats["distinct_result_sets"] == 1


def test_determinism_stats_divergent_runs_score_partial_agreement() -> None:
    runs_labels = [
        [{"type": "GOD_SERVICE", "services": ["platform-service"]}],
        [{"type": "GOD_SERVICE", "services": ["platform-service"]}],
        [{"type": "CHATTY_SERVICE", "services": ["order-service", "platform-service"]}],
    ]

    stats = ai_baseline_module._determinism_stats(runs_labels)

    assert stats["exact_match_rate"] == round(2 / 3, 4)
    assert 0.0 <= stats["mean_pairwise_jaccard"] < 1.0
    assert stats["distinct_result_sets"] == 2


def test_run_ai_baseline_scores_mocked_llm_output_against_ground_truth(monkeypatch) -> None:
    call_count = {"n": 0}

    def fake_urlopen(request, timeout=None):
        call_count["n"] += 1
        findings = [
            {"type": "CYCLIC_DEPENDENCY", "services": ["order-service", "payment-service"]},
            {"type": "HARD_CODED_SERVICE_DEPENDENCY", "services": ["order-service"]},
            {"type": "HARD_CODED_SERVICE_DEPENDENCY", "services": ["payment-service"]},
        ]
        envelope = json.dumps({"output_text": json.dumps({"findings": findings})}).encode("utf-8")
        return _FakeHTTPResponse(envelope)

    monkeypatch.setattr(ai_baseline_module.urllib_request, "urlopen", fake_urlopen)
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "test-key")

    report = run_ai_baseline(
        ROOT / "benchmarks" / "ground_truth.yml",
        ["cyclic-dependencies"],
        runs=3,
    )

    assert call_count["n"] == 3
    system_result = report["systems"][0]
    assert system_result["id"] == "cyclic-dependencies"
    assert system_result["f1_score"]["mean"] == 1.0
    assert system_result["determinism"]["exact_match_rate"] == 1.0


def test_run_ai_baseline_requires_api_key(monkeypatch) -> None:
    monkeypatch.delenv("MESA_OPENAI_API_KEY", raising=False)

    try:
        run_ai_baseline(ROOT / "benchmarks" / "ground_truth.yml", ["cyclic-dependencies"], runs=1)
        raised = False
    except RuntimeError:
        raised = True

    assert raised


def test_run_ai_baseline_rejects_unknown_system_id(monkeypatch) -> None:
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "test-key")

    try:
        run_ai_baseline(ROOT / "benchmarks" / "ground_truth.yml", ["does-not-exist"], runs=1)
        raised = False
    except ValueError:
        raised = True

    assert raised


def test_run_ai_baseline_rejects_unknown_provider(monkeypatch) -> None:
    monkeypatch.setenv("MESA_OPENAI_API_KEY", "test-key")

    try:
        run_ai_baseline(
            ROOT / "benchmarks" / "ground_truth.yml",
            ["cyclic-dependencies"],
            runs=1,
            provider="does-not-exist",
        )
        raised = False
    except ValueError:
        raised = True

    assert raised


def test_run_ai_baseline_supports_anthropic_provider(monkeypatch) -> None:
    findings = [
        {"type": "CYCLIC_DEPENDENCY", "services": ["order-service", "payment-service"]},
        {"type": "HARD_CODED_SERVICE_DEPENDENCY", "services": ["order-service"]},
        {"type": "HARD_CODED_SERVICE_DEPENDENCY", "services": ["payment-service"]},
    ]
    call_count = {"n": 0}

    class _FakeMessages:
        def create(self, **kwargs):
            call_count["n"] += 1
            text = json.dumps({"findings": findings})
            return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])

    class _FakeAnthropicClient:
        def __init__(self, *args, **kwargs) -> None:
            self.messages = _FakeMessages()

    monkeypatch.setattr(anthropic, "Anthropic", _FakeAnthropicClient)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    report = run_ai_baseline(
        ROOT / "benchmarks" / "ground_truth.yml",
        ["cyclic-dependencies"],
        runs=2,
        provider="anthropic",
    )

    assert call_count["n"] == 2
    assert report["provider"] == "anthropic"
    system_result = report["systems"][0]
    assert system_result["f1_score"]["mean"] == 1.0
    assert system_result["determinism"]["exact_match_rate"] == 1.0


def test_run_ai_baseline_requires_anthropic_api_key(monkeypatch) -> None:
    monkeypatch.delenv("MESA_ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    try:
        run_ai_baseline(
            ROOT / "benchmarks" / "ground_truth.yml",
            ["cyclic-dependencies"],
            runs=1,
            provider="anthropic",
        )
        raised = False
    except RuntimeError:
        raised = True

    assert raised


def test_export_ai_baseline_writes_json_and_markdown(tmp_path) -> None:
    report = {
        "benchmark": "ground_truth.yml",
        "runs_per_system": 3,
        "systems": [
            {
                "id": "cyclic-dependencies",
                "name": "Cyclic dependencies",
                "runs": [],
                "precision": {"mean": 1.0, "stdev": 0.0},
                "recall": {"mean": 1.0, "stdev": 0.0},
                "f1_score": {"mean": 1.0, "stdev": 0.0},
                "determinism": {
                    "exact_match_rate": 1.0,
                    "mean_pairwise_jaccard": 1.0,
                    "distinct_result_sets": 1,
                    "run_count": 3,
                },
            }
        ],
    }

    paths = export_ai_baseline(report, tmp_path)

    assert Path(paths["json"]).exists()
    assert Path(paths["markdown"]).exists()
    assert "Cyclic dependencies" in Path(paths["markdown"]).read_text(encoding="utf-8")
