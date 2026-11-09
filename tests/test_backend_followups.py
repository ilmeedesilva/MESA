"""Regression tests for backend issues found while building the responsive UI."""

import threading
import time
from pathlib import Path

from mesa.analysis import analyze_services
from mesa.analysis.explainer import explain_with_grounded_context
from mesa.api import main as api_main
from mesa.models import AIExplainerIntent, AIExplainerRequest
from mesa.storage import InMemoryPersistenceRepository

ROOT = Path(__file__).parent / "fixtures"


def test_scan_summary_names_each_kind_of_risk_once() -> None:
    result = analyze_services([str(ROOT / "hardcoded" / "billing-service")])
    assert len(result.findings) > 1  # several hard-coded dependencies

    response = explain_with_grounded_context(
        AIExplainerRequest(intent=AIExplainerIntent.SCAN_SUMMARY, question="Summarize"),
        result=result,
    )

    assert response.answer.count("hard-coded service dependency") == 1
    assert "The main area to review first is a hard-coded service dependency." in response.answer


def test_scan_summary_lists_two_different_risks() -> None:
    result = analyze_services(
        [
            str(ROOT / "cycle" / "order-service"),
            str(ROOT / "cycle" / "payment-service"),
            str(ROOT / "hardcoded" / "billing-service"),
        ]
    )

    response = explain_with_grounded_context(
        AIExplainerRequest(intent=AIExplainerIntent.SCAN_SUMMARY, question="Summarize"),
        result=result,
    )

    assert "The main areas to review first are " in response.answer
    assert " and " in response.answer


def test_storage_is_set_up_once_when_requests_arrive_together(monkeypatch) -> None:
    calls: list[int] = []

    def slow_initialize(self) -> None:
        calls.append(1)
        time.sleep(0.05)  # widen the window in which a second request could start

    monkeypatch.setattr(InMemoryPersistenceRepository, "initialize", slow_initialize)
    monkeypatch.delenv("MESA_PERSISTENCE", raising=False)
    app = api_main.FastAPI()
    results: list[object] = []

    threads = [
        threading.Thread(target=lambda: results.append(api_main._repository_for(app)))
        for _ in range(8)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert len(calls) == 1
    assert len({id(repository) for repository in results}) == 1


def test_storage_is_set_up_at_startup(monkeypatch) -> None:
    from fastapi.testclient import TestClient

    monkeypatch.delenv("MESA_PERSISTENCE", raising=False)
    monkeypatch.delenv("MESA_NEO4J_ENABLED", raising=False)
    had_repository = hasattr(api_main.app.state, "persistence_repository")
    saved = getattr(api_main.app.state, "persistence_repository", None)
    if had_repository:
        del api_main.app.state.persistence_repository
    try:
        with TestClient(api_main.app):
            assert hasattr(api_main.app.state, "persistence_repository")
    finally:
        if had_repository:
            api_main.app.state.persistence_repository = saved
        elif hasattr(api_main.app.state, "persistence_repository"):
            del api_main.app.state.persistence_repository
