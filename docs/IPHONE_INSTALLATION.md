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

## Install the preferred CA profile

Ordinary testing works at `http://WINDOWS_LAN_IP:5173`. Service workers and geolocation need a secure
context on a physical phone, so use the local HTTPS endpoint for a reliable installed PWA. If you
installed an earlier Map profile that contained only the root CA, remove it before continuing:

1. Open Settings → General → VPN & Device Management, select the existing
   **Map Local Development CA**, and tap **Remove Profile**. Skip this step if no Map profile exists.
2. In iPhone Safari open the `iPhone CA profile` URL printed by `start.ps1`, for example
   `http://WINDOWS_LAN_IP:5173/local-ca.mobileconfig`.
3. Accept the **Profile Downloaded** prompt.
4. Open Settings → General → VPN & Device Management.
5. Select and install **Map Local Development CA**.
6. Open Settings → General → About → Certificate Trust Settings.
7. Enable full trust for the **Map Local Development CA** root certificate.
8. In Safari retry `https://WINDOWS_LAN_IP:8443` and confirm Map loads without a certificate warning.
9. Tap Share/Menu → **Add to Home Screen**.
10. Enable **Open as Web App** where shown, tap Add, then launch Map from the Home Screen.

The generated profile contains only the active public root and intermediate CA certificates plus
required Apple metadata. Certificate payloads contain binary DER bytes represented as base64 plist
data, not nested PEM text. The profile contains no private key, password, credential, or secret.
Trusting it does not disable Safari security. Private CA material remains in the persistent Docker
volume and is never committed.

The CA volume persists across ordinary container restarts and recreation, so iPhone trust remains
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
This removes trust from the phone without altering Caddy's Windows-side Docker volume.

## Troubleshooting

- Confirm both devices use the same Wi-Fi; guest networks may isolate clients.
- Recheck the active LAN IPv4 address after reconnecting or rebooting.
- Allow inbound ports 5173 and 8443 only for Private networks in Windows Defender Firewall.
- Confirm `docker compose ps` shows `web`, `api`, `tiles`, and `db` healthy.
- Confirm Docker publishes `0.0.0.0:5173` and `0.0.0.0:8443`.
- If **Profile Downloaded** does not appear, use Safari rather than an embedded browser and confirm the
  URL ends in `.mobileconfig` and returns HTTP 200 from Windows.
- If HTTPS host changed, rerun setup/start and use the printed HTTPS URL. Reinstall the profile only
  after intentionally deleting `caddy-data` or if the downloaded public CA actually changed.
- For stale assets, close the Home Screen app, reload Safari, or remove and add the app again.
- If the service worker remains stale, clear Safari website data for the LAN host and reinstall.
- Do not use `localhost` on iPhone; it means the iPhone itself.

Physical-iPhone behavior must be confirmed on the actual device; Windows automation does not claim it.
