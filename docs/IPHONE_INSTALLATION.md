# Install Map on iPhone

## Requirements

- an iPhone with Safari;
- the Windows 11 ROG laptop running Map;
- both devices on the same trusted Wi-Fi network.

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

## Open and install

Ordinary testing works at `http://WINDOWS_LAN_IP:5173`. Service workers and browser geolocation need
a secure context on a physical phone, so use the local HTTPS endpoint for a reliable installed PWA:

1. In iPhone Safari open `http://WINDOWS_LAN_IP:5173/local-ca.crt` and allow the profile download.
2. Open Settings → General → VPN & Device Management and install the downloaded Caddy local CA.
3. Open Settings → General → About → Certificate Trust Settings and enable full trust for that CA.
4. In Safari open `https://WINDOWS_LAN_IP:8443` and confirm Map loads without a certificate warning.
5. Tap Share/Menu → **Add to Home Screen**.
6. Enable **Open as Web App** where shown, tap Add, then launch Map from the Home Screen.

This trusts only the project-local CA on your own device. It does not disable Safari security. Remove
the profile when no longer needed. Private CA state stays in a Docker volume and is never committed.

## Troubleshooting

- Confirm both devices use the same Wi-Fi; guest networks may isolate clients.
- Recheck the active LAN IPv4 address after reconnecting or rebooting.
- Allow inbound ports 5173 and 8443 only for Private networks in Windows Defender Firewall.
- Confirm `docker compose ps` shows `web`, `api`, `tiles`, and `db` healthy.
- Confirm Docker publishes `0.0.0.0:5173` and `0.0.0.0:8443`.
- If HTTPS host changed, update `MAP_HOST` in `.env`, recreate `web`, and install its current CA.
- For stale assets, close the Home Screen app, reload Safari, or remove and add the app again.
- If the service worker remains stale, clear Safari website data for the LAN host and reinstall.
- Do not use `localhost` on iPhone; it means the iPhone itself.

Physical-iPhone behavior has to be confirmed on an actual device; automated Windows validation does
not claim that step was performed.
