from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "map-api"}


def test_config_is_vilnius_only() -> None:
    response = client.get("/api/v1/config")
    assert response.status_code == 200
    payload = response.json()
    assert payload["region"] == "vilnius"
    assert payload["country"] == "LT"
    assert payload["center"] == {"latitude": 54.6872, "longitude": 25.2797}
    assert payload["bounding_box"]["west"] < payload["bounding_box"]["east"]


def test_style_uses_request_host_for_tiles() -> None:
    response = client.get("/api/v1/map/style.json", headers={"host": "192.168.1.10:8000"})
    assert response.status_code == 200
    tiles = response.json()["sources"]["vilnius"]["tiles"]
    assert tiles == ["http://192.168.1.10:3000/vilnius_boundary/{z}/{x}/{y}"]
