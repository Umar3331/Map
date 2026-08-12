# Windows setup

## Requirements

Use Windows 11, Git for Windows, PowerShell 5.1+ (PowerShell 7 recommended), and Docker Desktop with
the Linux-container engine running. Python is optional because the API and its tests run in Docker.

Install Git and Docker Desktop from their official installers, reboot if requested, then verify:

```powershell
git --version
docker --version
docker compose version
docker info
```

## Clone and run

```powershell
git clone https://github.com/Umar3331/Map.git map-platform
cd map-platform
Copy-Item .env.example .env
.\scripts\setup.ps1
.\scripts\start.ps1
.\scripts\health.ps1
```

Review `.env` and use a local-only password. View state and logs with `docker compose ps` and
`docker compose logs -f api db tiles`. Stop with `.\scripts\stop.ps1`.

## LAN and iPhone testing

Run `ipconfig` or `Get-NetIPAddress -AddressFamily IPv4` and find the active Wi-Fi adapter's private
IPv4 address. From another device on the same trusted Wi-Fi, open:

`http://WINDOWS_LAN_IP:8000/health`

If blocked, add a Windows Defender Firewall inbound TCP rule for port 8000 (and 3000 for tiles),
restricted to the **Private** profile and preferably the local subnet. Do not disable the firewall or
open these ports on Public networks.

## Troubleshooting

- Docker command fails: start Docker Desktop and wait for the engine.
- Port conflict: change the corresponding host port in `.env`; keep `TILE_PUBLIC_PORT` aligned with
  `TILE_PORT`.
- API does not start: run `docker compose logs api db`.
- Database is unhealthy: inspect `docker compose logs db` and check `.env`.
- Configuration changed after first database start: initialization SQL runs only on a fresh volume.
- Full local reset: `.\scripts\stop.ps1 -RemoveVolumes`. This permanently removes local database
  data, so use it only when a reset is intended.
