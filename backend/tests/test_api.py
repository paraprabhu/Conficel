import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main


@pytest.fixture()
def client(monkeypatch):
    main.app.dependency_overrides[main.get_verified_user] = lambda: {"id": "test-user", "email": "test@example.com"}
    monkeypatch.setattr(main, "_extract_pdf", lambda data: ("ACME SUPPLIES\nInvoice No: INV-100\nTotal 1250.00", 1))
    monkeypatch.setattr(main, "_ocr_image", lambda image: "ACME BANK\nDate 01/02/2026")
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


def test_health_is_available(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_conversion_requires_auth_when_not_overridden():
    main.app.dependency_overrides.clear()
    with TestClient(main.app) as test_client:
        response = test_client.post(
            "/api/convert",
            params={"mode": "invoice"},
            files={"file": ("invoice.pdf", b"%PDF-1.7 test", "application/pdf")},
        )
    assert response.status_code == 401


def test_invoice_pdf_returns_review_draft(client):
    response = client.post(
        "/api/convert",
        params={"mode": "invoice"},
        files={"file": ("invoice.pdf", b"%PDF-1.7 test", "application/pdf")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "draft_review"
    assert body["credits_charged"] == 0
    assert body["draft"]["review_required"] is True
    assert body["draft"]["invoice_date"] == ""
    assert "raw_text" in body["draft"]


def test_rejects_mime_signature_mismatch(client):
    response = client.post(
        "/api/convert",
        params={"mode": "invoice"},
        files={"file": ("fake.pdf", b"not a pdf", "application/pdf")},
    )
    assert response.status_code == 400


def test_rejects_unsupported_mode(client):
    response = client.post(
        "/api/convert",
        params={"mode": "unknown"},
        files={"file": ("invoice.pdf", b"%PDF-1.7 test", "application/pdf")},
    )
    assert response.status_code == 400


def test_rejects_empty_upload(client):
    response = client.post(
        "/api/convert",
        params={"mode": "invoice"},
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code in (400, 422)


def test_export_returns_xlsx(client):
    response = client.post(
        "/api/export.xlsx",
        json={"mode": "invoice", "fields": {"supplier": "ACME", "total": "1250.00"}, "rows": [{"item": "Paper", "qty": 2}]},
    )
    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert response.content[:2] == b"PK"
    assert "attachment;" in response.headers.get("content-disposition", "")


def test_export_rejects_invalid_mode(client):
    response = client.post("/api/export.xlsx", json={"mode": "unknown", "fields": {}})
    assert response.status_code == 422
