import plistlib

from fastapi.testclient import TestClient

from app import mobileconfig
from app.main import VILNIUS, app

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
    assert response.json()["center"] == [
        VILNIUS["center"]["longitude"],
        VILNIUS["center"]["latitude"],
    ]


def test_mobileconfig_contains_only_public_certificate(monkeypatch) -> None:
    certificate_der = b"\x30\x05\x02\x03map"
    monkeypatch.setattr(mobileconfig, "load_ca_certificate_der", lambda: certificate_der)

    first_response = client.get("/local-ca.mobileconfig")
    second_response = client.get("/local-ca.mobileconfig")

    assert first_response.status_code == 200
    assert first_response.headers["content-type"].startswith("application/x-apple-aspen-config")
    assert first_response.headers["content-disposition"] == (
        'attachment; filename="map-local-ca.mobileconfig"'
    )
    assert first_response.headers["cache-control"] == "no-store"
    assert b"<html" not in first_response.content.lower()
    assert b"PRIVATE KEY" not in first_response.content

    profile = plistlib.loads(first_response.content)
    certificate_payload = profile["PayloadContent"][0]
    assert profile["PayloadIdentifier"] == "com.map.local.ca"
    assert profile["PayloadDisplayName"] == "Map Local Development CA"
    assert certificate_payload["PayloadType"] == "com.apple.security.root"
    assert certificate_payload["PayloadContent"] == certificate_der
    assert first_response.content == second_response.content
