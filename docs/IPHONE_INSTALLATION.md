# Install Map on iPhone

## Requirements

- an iPhone with Safari;
- the Windows 11 ROG laptop running Map;
- both devices on the same trusted Wi-Fi network.

The local CA profile is for the developer's personal test device only.

## Start Map on Windows

```powershell
cd C:\path\to\Map
.\scripts\setup.ps1
.\scripts\start.ps1
.\scripts\health.ps1
```

The start script prints the detected LAN address. You can also run `ipconfig` or:

```powershell
Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } |
  Select-Object InterfaceAlias, IPv4Address
```

Use the active Wi-Fi adapter's private IPv4 address, such as `192.168.1.50` (example only).

## Replace the old profile and install the RSA CA profile

Ordinary testing works at `http://WINDOWS_LAN_IP:5173`. Service workers and geolocation need a secure
context on a physical phone, so use the local HTTPS endpoint for a reliable installed PWA. The current
profile replaces the earlier Caddy ECC profile with a dedicated RSA-2048 root and intermediate:

1. On iPhone, open Settings → General → VPN & Device Management, select the existing
   **Map Local Development CA**, and tap **Remove Profile**.
2. Open Settings → General → About → Certificate Trust Settings and confirm the old Map/Caddy ECC
   root is no longer enabled or listed. Remove any separately installed old Map/Caddy certificate.
3. On Windows, stop Map with `.\scripts\stop.ps1`.
4. Pull this PR revision, then run `.\scripts\setup.ps1`. The next start creates the dedicated Map
   RSA PKI in new Docker volumes; it never reads Caddy's old ECC CA files.
5. Restart Map with `.\scripts\start.ps1`. Startup validates that the active root, intermediate,
   and leaf are RSA-2048 before printing the URLs.
6. In iPhone Safari open the new `iPhone CA profile` URL printed by `start.ps1`, for example
   `http://WINDOWS_LAN_IP:5173/local-ca.mobileconfig`.
7. Accept the **Profile Downloaded** prompt, then open Settings → General → VPN & Device Management.
8. Select and install **Map Local Development CA**.
9. Open Settings → General → About → Certificate Trust Settings and enable full trust for the new
   **Map Local Development RSA Root**.
10. In Safari retry `https://WINDOWS_LAN_IP:8443` and confirm Map loads without a certificate warning.
11. Tap Share/Menu → **Add to Home Screen**.
12. Enable **Open as Web App** where shown, tap Add, then launch Map from the Home Screen.

The generated profile contains only the active public RSA root and intermediate CA certificates plus
required Apple metadata. Certificate payloads contain binary DER bytes represented as base64 plist
data, not nested PEM text. The profile contains no private key, password, credential, or secret.
Trusting it does not disable Safari security. Private CA material remains in the persistent Docker
`rsa-pki-private` volume and is never mounted into the API container or committed.

The RSA CA volumes persist across ordinary container restarts and recreation, so iPhone trust remains
valid. If the laptop's LAN IP changes, rerun `setup.ps1` and `start.ps1`. Caddy issues a new leaf
certificate for the new IP using the same CA, so the profile normally does not need to be reinstalled.
If `MAP_HOST` is an explicit hostname, setup preserves it and start warns when it differs from the IP.

### Advanced raw-certificate fallback

`http://WINDOWS_LAN_IP:5173/local-ca.crt` remains available for certificate inspection and manual
installation workflows. The `.mobileconfig` route is preferred because iPhone Safari recognizes it
as an Apple configuration profile more reliably than a raw `.crt` download.

## Remove the development CA

After testing, open Settings → General → VPN & Device Management, select **Map Local Development
CA**, and choose **Remove Profile**. Confirm it no longer appears under Certificate Trust Settings.
This removes trust from the phone without altering the Windows-side Map RSA Docker volumes.

## Troubleshooting

- Confirm both devices use the same Wi-Fi; guest networks may isolate clients.
- Recheck the active LAN IPv4 address after reconnecting or rebooting.
- Allow inbound ports 5173 and 8443 only for Private networks in Windows Defender Firewall.
- Confirm `docker compose ps` shows `web`, `api`, `tiles`, and `db` healthy.
- Confirm Docker publishes `0.0.0.0:5173` and `0.0.0.0:8443`.
- If **Profile Downloaded** does not appear, use Safari rather than an embedded browser and confirm the
  URL ends in `.mobileconfig` and returns HTTP 200 from Windows.
- If HTTPS host changed, rerun setup/start and use the printed HTTPS URL. Reinstall the profile only
  after intentionally deleting the RSA PKI volumes or if the downloaded public CA actually changed.
- For stale assets, close the Home Screen app, reload Safari, or remove and add the app again.
- If the service worker remains stale, clear Safari website data for the LAN host and reinstall.
- Do not use `localhost` on iPhone; it means the iPhone itself.

Physical-iPhone acceptance passed on 2026-08-13 at `https://192.168.8.237:8443`: the trusted RSA
profile produced warning-free HTTPS and Map rendered successfully in Safari.
