import hashlib
import plistlib
import uuid

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


def test_mobileconfig_contains_only_public_ca_chain(monkeypatch) -> None:
    root_der = b"\x30\x05\x02\x03root"
    intermediate_der = b"\x30\x0d\x02\x0bintermediate"
    monkeypatch.setattr(
        mobileconfig,
        "load_ca_certificates_der",
        lambda: (root_der, intermediate_der),
    )

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
    certificate_payloads = profile["PayloadContent"]
    assert profile["PayloadIdentifier"] == "com.map.local.ca"
    assert profile["PayloadDisplayName"] == "Map Local Development CA"
    assert len(certificate_payloads) == 2
    assert [payload["PayloadIdentifier"] for payload in certificate_payloads] == [
        "com.map.local.ca.root",
        "com.map.local.ca.intermediate",
    ]
    assert [payload["PayloadType"] for payload in certificate_payloads] == [
        "com.apple.security.root",
        "com.apple.security.pkcs1",
    ]
    assert [payload["PayloadContent"] for payload in certificate_payloads] == [
        root_der,
        intermediate_der,
    ]
    assert len({payload["PayloadUUID"] for payload in certificate_payloads}) == 2
    for role, payload, certificate_der in zip(
        ("root", "intermediate"),
        certificate_payloads,
        (root_der, intermediate_der),
        strict=True,
    ):
        fingerprint = hashlib.sha256(certificate_der).hexdigest()
        expected_uuid = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"com.map.local.ca:{role}:{fingerprint}",
        )
        assert payload["PayloadUUID"] == str(expected_uuid).upper()
    assert first_response.content == second_response.content
