import hashlib
import os
import plistlib
import ssl
import uuid
from pathlib import Path

CA_CERTIFICATE_PATH = Path(
    os.getenv(
        "CA_CERTIFICATE_PATH",
        "/caddy-data/caddy/pki/authorities/local/root.crt",
    )
)
PROFILE_IDENTIFIER = "com.map.local.ca"
PROFILE_DISPLAY_NAME = "Map Local Development CA"


def load_ca_certificate_der() -> bytes:
    """Load Caddy's public root certificate and return DER bytes."""
    certificate_pem = CA_CERTIFICATE_PATH.read_text(encoding="ascii")
    return ssl.PEM_cert_to_DER_cert(certificate_pem)


def build_mobileconfig(certificate_der: bytes) -> bytes:
    """Build a reproducible Apple root-certificate configuration profile."""
    fingerprint = hashlib.sha256(certificate_der).hexdigest()
    payload_uuid = uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"{PROFILE_IDENTIFIER}:certificate:{fingerprint}",
    )
    profile_uuid = uuid.uuid5(
        uuid.NAMESPACE_URL,
        f"{PROFILE_IDENTIFIER}:profile:{fingerprint}",
    )
    certificate_payload = {
        "PayloadCertificateFileName": "map-local-ca.cer",
        "PayloadContent": certificate_der,
        "PayloadDescription": "Caddy public root CA for personal Map development testing.",
        "PayloadDisplayName": PROFILE_DISPLAY_NAME,
        "PayloadIdentifier": f"{PROFILE_IDENTIFIER}.certificate",
        "PayloadType": "com.apple.security.root",
        "PayloadUUID": str(payload_uuid).upper(),
        "PayloadVersion": 1,
    }
    profile = {
        "PayloadContent": [certificate_payload],
        "PayloadDescription": (
            "Installs the public Map local development root CA on a personal test device."
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
