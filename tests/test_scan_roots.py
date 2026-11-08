"""Service paths sent to the API must stay inside the allowed scan roots."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mesa.api.main import app

SERVICE_CODE = 'import requests\n\nrequests.get("http://user-service:8080/users")\n'


@pytest.fixture
def scan_dirs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, Path]:
    allowed = tmp_path / "allowed"
    outside = tmp_path / "outside"
    for root in (allowed, outside):
        service = root / "order-service"
        service.mkdir(parents=True)
        (service / "app.py").write_text(SERVICE_CODE, encoding="utf-8")
    monkeypatch.setenv("MESA_ALLOWED_SCAN_ROOTS", str(allowed))
    return {"allowed": allowed, "outside": outside}


def _escape_path(dirs: dict[str, Path]) -> str:
    # Starts inside the allowed root but climbs out of it with ../
    return str(dirs["allowed"] / ".." / "outside" / "order-service")


def _project_id(client: TestClient) -> str:
    response = client.post("/projects", json={"name": "Scan roots"})
    assert response.status_code == 201
    return response.json()["id"]


# POST /analyze


def test_analyze_accepts_path_inside_allowed_root(scan_dirs: dict[str, Path]) -> None:
    response = TestClient(app).post(
        "/analyze", json={"service_paths": [str(scan_dirs["allowed"] / "order-service")]}
    )
    assert response.status_code == 200
    assert response.json()["summary"]["service_count"] == 1


def test_analyze_rejects_path_outside_allowed_root(scan_dirs: dict[str, Path]) -> None:
    response = TestClient(app).post(
        "/analyze", json={"service_paths": [str(scan_dirs["outside"] / "order-service")]}
    )
    assert response.status_code == 400
    assert "outside the allowed scan roots" in response.json()["detail"]


def test_analyze_rejects_dotdot_escape(scan_dirs: dict[str, Path]) -> None:
    response = TestClient(app).post("/analyze", json={"service_paths": [_escape_path(scan_dirs)]})
    assert response.status_code == 400


def test_analyze_rejects_symlink_pointing_outside(scan_dirs: dict[str, Path]) -> None:
    link = scan_dirs["allowed"] / "linked-service"
    os.symlink(scan_dirs["outside"] / "order-service", link)
    response = TestClient(app).post("/analyze", json={"service_paths": [str(link)]})
    assert response.status_code == 400


# POST /projects/{project_id}/scans


def test_project_scan_accepts_path_inside_allowed_root(scan_dirs: dict[str, Path]) -> None:
    client = TestClient(app)
    project_id = _project_id(client)
    response = client.post(
        f"/projects/{project_id}/scans",
        json={"service_paths": [str(scan_dirs["allowed"] / "order-service")]},
    )
    assert response.status_code == 201
    assert response.json()["result"]["summary"]["service_count"] == 1


def test_project_scan_rejects_path_outside_allowed_root(scan_dirs: dict[str, Path]) -> None:
    client = TestClient(app)
    project_id = _project_id(client)
    response = client.post(
        f"/projects/{project_id}/scans",
        json={"service_paths": [str(scan_dirs["outside"] / "order-service")]},
    )
    assert response.status_code == 400
    assert "outside the allowed scan roots" in response.json()["detail"]
    # Nothing was stored for the rejected request.
    assert client.get(f"/projects/{project_id}/scans").json() == []


def test_project_scan_rejects_dotdot_escape(scan_dirs: dict[str, Path]) -> None:
    client = TestClient(app)
    project_id = _project_id(client)
    response = client.post(
        f"/projects/{project_id}/scans", json={"service_paths": [_escape_path(scan_dirs)]}
    )
    assert response.status_code == 400


def test_default_root_is_the_workspace_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MESA_ALLOWED_SCAN_ROOTS", raising=False)
    monkeypatch.setenv("MESA_WORKSPACE_ROOT", str(tmp_path))
    inside = tmp_path / "order-service"
    inside.mkdir()
    (inside / "app.py").write_text(SERVICE_CODE, encoding="utf-8")
    client = TestClient(app)
    assert client.post("/analyze", json={"service_paths": [str(inside)]}).status_code == 200
    assert (
        client.post("/analyze", json={"service_paths": [str(tmp_path.parent)]}).status_code == 400
    )


def test_allowed_root_prefix_is_not_enough(scan_dirs: dict[str, Path]) -> None:
    # "/x/allowed-other" starts with the string "/x/allowed" but is not inside it.
    sibling = scan_dirs["allowed"].parent / "allowed-other" / "order-service"
    sibling.mkdir(parents=True)
    (sibling / "app.py").write_text(SERVICE_CODE, encoding="utf-8")
    response = TestClient(app).post("/analyze", json={"service_paths": [str(sibling)]})
    assert response.status_code == 400
