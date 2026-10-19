from fastapi.testclient import TestClient

from app.main import app


def test_challenge_progress_requires_authentication_in_production(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_anon_key", None)
    response = TestClient(app).get("/api/challenges/entanglement-guardian")
    assert response.status_code == 503
    assert "Authentication is not configured" in response.json()["detail"]


def test_challenge_progress_reports_missing_storage_in_development(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_anon_key", None)
    response = TestClient(app).get("/api/challenges/entanglement-guardian")
    assert response.status_code == 401