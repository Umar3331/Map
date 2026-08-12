#!/bin/sh
set -eu

PUBLIC_DIR=/pki/public
PRIVATE_DIR=/pki/private
ROOT_CERT="$PUBLIC_DIR/root.crt"
INTERMEDIATE_CERT="$PUBLIC_DIR/intermediate.crt"
ROOT_KEY="$PRIVATE_DIR/root.key"
INTERMEDIATE_KEY="$PRIVATE_DIR/intermediate.key"

assert_rsa_certificate() {
    certificate_path=$1
    certificate_name=$2
    openssl x509 -in "$certificate_path" -noout -text |
        grep -q 'Public Key Algorithm: rsaEncryption' || {
            echo "$certificate_name is not an RSA certificate." >&2
            exit 1
        }
    openssl x509 -in "$certificate_path" -noout -text |
        grep -q 'Public-Key: (2048 bit)' || {
            echo "$certificate_name is not RSA-2048." >&2
            exit 1
        }
}

assert_key_matches_certificate() {
    key_path=$1
    certificate_path=$2
    key_fingerprint=$(openssl pkey -in "$key_path" -pubout -outform DER | sha256sum | cut -d ' ' -f 1)
    certificate_fingerprint=$(
        openssl x509 -in "$certificate_path" -pubkey -noout |
            openssl pkey -pubin -outform DER |
            sha256sum |
            cut -d ' ' -f 1
    )
    [ "$key_fingerprint" = "$certificate_fingerprint" ] || {
        echo "Private key does not match $certificate_path." >&2
        exit 1
    }
}

validate_stored_pki() {
    assert_rsa_certificate "$ROOT_CERT" 'RSA root'
    assert_rsa_certificate "$INTERMEDIATE_CERT" 'RSA intermediate'
    openssl pkey -in "$ROOT_KEY" -check -noout >/dev/null
    openssl pkey -in "$INTERMEDIATE_KEY" -check -noout >/dev/null
    assert_key_matches_certificate "$ROOT_KEY" "$ROOT_CERT"
    assert_key_matches_certificate "$INTERMEDIATE_KEY" "$INTERMEDIATE_CERT"
    openssl verify -CAfile "$ROOT_CERT" "$INTERMEDIATE_CERT" >/dev/null
}

generate_pki() {
    mkdir -p "$PUBLIC_DIR" "$PRIVATE_DIR"
    existing_count=0
    for path in "$ROOT_CERT" "$INTERMEDIATE_CERT" "$ROOT_KEY" "$INTERMEDIATE_KEY"; do
        if [ -e "$path" ]; then
            existing_count=$((existing_count + 1))
        fi
    done

    if [ "$existing_count" -eq 4 ]; then
        validate_stored_pki
        echo 'Persistent Map RSA PKI is ready.'
        return
    fi
    if [ "$existing_count" -ne 0 ]; then
        echo 'Refusing to reuse partial or mixed local PKI state. Remove only the Map RSA PKI volumes and retry.' >&2
        exit 1
    fi

    generation_dir=$(mktemp -d "$PRIVATE_DIR/.generate.XXXXXX")
    trap 'rm -rf "$generation_dir"' EXIT INT TERM

    openssl genpkey \
        -algorithm RSA \
        -pkeyopt rsa_keygen_bits:2048 \
        -out "$generation_dir/root.key"
    openssl req \
        -x509 \
        -new \
        -key "$generation_dir/root.key" \
        -sha256 \
        -days 3650 \
        -set_serial 0x01 \
        -subj '/O=Map/CN=Map Local Development RSA Root' \
        -addext 'basicConstraints=critical,CA:TRUE,pathlen:1' \
        -addext 'keyUsage=critical,keyCertSign,cRLSign' \
        -addext 'subjectKeyIdentifier=hash' \
        -out "$generation_dir/root.crt"

    openssl genpkey \
        -algorithm RSA \
        -pkeyopt rsa_keygen_bits:2048 \
        -out "$generation_dir/intermediate.key"
    openssl req \
        -new \
        -key "$generation_dir/intermediate.key" \
        -sha256 \
        -subj '/O=Map/CN=Map Local Development RSA Intermediate' \
        -out "$generation_dir/intermediate.csr"
    printf '%s\n' \
        'basicConstraints=critical,CA:TRUE,pathlen:0' \
        'keyUsage=critical,keyCertSign,cRLSign' \
        'subjectKeyIdentifier=hash' \
        'authorityKeyIdentifier=keyid,issuer' \
        > "$generation_dir/intermediate.ext"
    openssl x509 \
        -req \
        -in "$generation_dir/intermediate.csr" \
        -CA "$generation_dir/root.crt" \
        -CAkey "$generation_dir/root.key" \
        -set_serial 0x02 \
        -days 1825 \
        -sha256 \
        -extfile "$generation_dir/intermediate.ext" \
        -out "$generation_dir/intermediate.crt"

    chmod 0600 "$generation_dir/root.key" "$generation_dir/intermediate.key"
    chmod 0644 "$generation_dir/root.crt" "$generation_dir/intermediate.crt"
    mv "$generation_dir/root.key" "$ROOT_KEY"
    mv "$generation_dir/intermediate.key" "$INTERMEDIATE_KEY"
    mv "$generation_dir/root.crt" "$ROOT_CERT"
    mv "$generation_dir/intermediate.crt" "$INTERMEDIATE_CERT"
    validate_stored_pki
    echo 'Generated persistent Map RSA-2048 root and intermediate CAs.'
}

validate_live_tls() {
    : "${MAP_HOST:=localhost}"
    assert_rsa_certificate "$ROOT_CERT" 'RSA root'
    assert_rsa_certificate "$INTERMEDIATE_CERT" 'RSA intermediate'
    openssl verify -CAfile "$ROOT_CERT" "$INTERMEDIATE_CERT" >/dev/null

    validation_dir=$(mktemp -d)
    trap 'rm -rf "$validation_dir"' EXIT INT TERM
    case "$MAP_HOST" in
        *[!0-9.]*|'') identity_option='-verify_hostname' ;;
        *) identity_option='-verify_ip' ;;
    esac
    openssl s_client \
        -connect web:8443 \
        -servername "$MAP_HOST" \
        -showcerts \
        -verify_return_error \
        -CAfile "$ROOT_CERT" \
        "$identity_option" "$MAP_HOST" \
        </dev/null > "$validation_dir/handshake.txt" 2>&1

    awk -v directory="$validation_dir" '
        /-----BEGIN CERTIFICATE-----/ {
            certificate_count++
            output = sprintf("%s/chain-%d.crt", directory, certificate_count)
        }
        output { print > output }
        /-----END CERTIFICATE-----/ { close(output); output = "" }
    ' "$validation_dir/handshake.txt"

    [ -f "$validation_dir/chain-1.crt" ] && [ -f "$validation_dir/chain-2.crt" ] || {
        echo 'TLS handshake did not present both leaf and intermediate certificates.' >&2
        exit 1
    }
    [ ! -f "$validation_dir/chain-3.crt" ] || {
        echo 'TLS handshake unexpectedly presented the root certificate.' >&2
        exit 1
    }

    assert_rsa_certificate "$validation_dir/chain-1.crt" 'Active HTTPS leaf'
    presented_intermediate=$(openssl x509 -in "$validation_dir/chain-2.crt" -outform DER | sha256sum | cut -d ' ' -f 1)
    active_intermediate=$(openssl x509 -in "$INTERMEDIATE_CERT" -outform DER | sha256sum | cut -d ' ' -f 1)
    [ "$presented_intermediate" = "$active_intermediate" ] || {
        echo 'TLS handshake presented an intermediate other than the active Map RSA intermediate.' >&2
        exit 1
    }
    openssl verify \
        -CAfile "$ROOT_CERT" \
        -untrusted "$INTERMEDIATE_CERT" \
        "$validation_dir/chain-1.crt" >/dev/null
    openssl x509 -in "$validation_dir/chain-1.crt" -noout -ext extendedKeyUsage |
        grep -q 'TLS Web Server Authentication' || {
            echo 'Active HTTPS leaf lacks the Server Authentication EKU.' >&2
            exit 1
        }

    echo 'Live Map RSA PKI validation passed.'
    echo 'Root signs intermediate: verified'
    echo 'Intermediate signs leaf: verified'
    openssl x509 -in "$ROOT_CERT" -noout -subject -fingerprint -sha256 -nameopt RFC2253
    openssl x509 -in "$INTERMEDIATE_CERT" -noout -subject -fingerprint -sha256 -nameopt RFC2253
    echo 'Leaf public key:'
    openssl x509 -in "$validation_dir/chain-1.crt" -noout -text |
        grep -E 'Public Key Algorithm:|Public-Key:' |
        head -n 2
    openssl x509 -in "$validation_dir/chain-1.crt" -noout -issuer -nameopt RFC2253
    openssl x509 -in "$validation_dir/chain-1.crt" -noout -ext subjectAltName
    openssl x509 -in "$validation_dir/chain-1.crt" -noout -ext extendedKeyUsage
    echo 'TLS chain: RSA leaf -> Map Local Development RSA Intermediate -> Map Local Development RSA Root'
}

case "${1:-generate}" in
    generate) generate_pki ;;
    validate) validate_live_tls ;;
    *) echo "Unknown command: $1" >&2; exit 2 ;;
esac
