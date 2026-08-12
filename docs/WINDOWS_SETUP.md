# Windows setup

## Requirements

Use Windows 11, Git for Windows, PowerShell 5.1+ (7 recommended), and Docker Desktop running Linux
containers. Node is optional for the standard container workflow and required only for direct
frontend development.

```powershell
git --version
docker --version
docker compose version
docker info
```

## Clone and start

```powershell
git clone https://github.com/Umar3331/Map.git
cd Map
Copy-Item .env.example .env
.\scripts\setup.ps1
.\scripts\start.ps1
.\scripts\health.ps1
```

`setup.ps1` validates Git, Docker, Compose, the environment, and detects a LAN address for local
HTTPS. `start.ps1` creates or reuses the persistent RSA development PKI, builds and waits for the
gateway, validates the active RSA leaf and chain, then prints desktop, LAN, HTTPS, and certificate
URLs. Stop with `.\scripts\stop.ps1`.

## Operations and troubleshooting

- State: `docker compose ps`
- Logs: `docker compose logs -f rsa-pki web api tiles db`
- Port conflict: update the appropriate value in `.env` and keep documented URLs aligned.
- Stale PWA: reload Safari, remove/re-add the Home Screen app, or clear website data.
- Full local-state reset: `.\scripts\stop.ps1 -RemoveVolumes` permanently deletes local PostGIS,
  Caddy, and Map RSA PKI state; rerun setup/start afterward and reinstall the iPhone profile.
- Docker failure: start Docker Desktop and wait for `docker info` to succeed.

For another device, allow inbound TCP 5173 (and 8443 for HTTPS) only on the Windows Defender Firewall
**Private** profile, ideally limited to the local subnet. Never disable the firewall globally. API
8000 need not be exposed to the phone because the web gateway proxies it.
