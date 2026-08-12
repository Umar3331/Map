import hashlib
import os
import plistlib
import ssl
import uuid
from pathlib import Path

ROOT_CA_CERTIFICATE_PATH = Path(
    os.getenv(
        "ROOT_CA_CERTIFICATE_PATH",
        "/caddy-data/caddy/pki/authorities/local/root.crt",
    )
)
INTERMEDIATE_CA_CERTIFICATE_PATH = Path(
    os.getenv(
        "INTERMEDIATE_CA_CERTIFICATE_PATH",
        "/caddy-data/caddy/pki/authorities/local/intermediate.crt",
    )
)
PROFILE_IDENTIFIER = "com.map.local.ca"
PROFILE_DISPLAY_NAME = "Map Local Development CA"


def _load_certificate_der(path: Path) -> bytes:
    certificate_pem = path.read_text(encoding="ascii")
    return ssl.PEM_cert_to_DER_cert(certificate_pem)


def load_ca_certificates_der() -> tuple[bytes, bytes]:
    """Load Caddy's public root and intermediate certificates as DER bytes."""
    return (
        _load_certificate_der(ROOT_CA_CERTIFICATE_PATH),
        _load_certificate_der(INTERMEDIATE_CA_CERTIFICATE_PATH),
    )


def _certificate_payload(
    certificate_der: bytes,
    *,
    role: str,
    payload_type: str,
) -> dict[str, object]:
    fingerprint = hashlib.sha256(certificate_der).hexdigest()
    payload_uuid = uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"{PROFILE_IDENTIFIER}:{role}:{fingerprint}",
    )
    return {
        "PayloadCertificateFileName": f"map-local-ca-{role}.cer",
        "PayloadContent": certificate_der,
        "PayloadDescription": (
            f"Caddy public {role} CA certificate for personal Map development testing."
        ),
        "PayloadDisplayName": f"{PROFILE_DISPLAY_NAME} — {role.title()}",
        "PayloadIdentifier": f"{PROFILE_IDENTIFIER}.{role}",
        "PayloadType": payload_type,
        "PayloadUUID": str(payload_uuid).upper(),
        "PayloadVersion": 1,
    }


def build_mobileconfig(root_der: bytes, intermediate_der: bytes) -> bytes:
    """Build a reproducible Apple profile for Caddy's public CA chain."""
    root_fingerprint = hashlib.sha256(root_der).hexdigest()
    intermediate_fingerprint = hashlib.sha256(intermediate_der).hexdigest()
    profile_uuid = uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"{PROFILE_IDENTIFIER}:profile:{root_fingerprint}:{intermediate_fingerprint}",
    )
    profile = {
        "PayloadContent": [
            _certificate_payload(
                root_der,
                role="root",
                payload_type="com.apple.security.root",
            ),
            _certificate_payload(
                intermediate_der,
                role="intermediate",
                payload_type="com.apple.security.pkcs1",
            ),
        ],
        "PayloadDescription": (
            "Installs the public Map local development root and intermediate CA certificates "
            "on a personal test device."
        ),
        "PayloadDisplayName": PROFILE_DISPLAY_NAME,
        "PayloadIdentifier": PROFILE_IDENTIFIER,
        "PayloadOrganization": "Map",
        "PayloadRemovalDisallowed": False,
        "PayloadType": "Configuration",
        "PayloadUUID": str(profile_uuid).upper(),
        "PayloadVersion": 1,
    }
    return plistlib.dumps(profile, fmt=plistlib.FMT_XML, sort_keys=False)
