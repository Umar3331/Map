# iOS installation

## What can be done on Windows

Backend development, PostGIS, OSM processing, tiles, API work, repository maintenance, Swift source
editing, and architecture work can all continue on Windows.

## What requires macOS

Xcode, iOS Simulator, native iOS compilation, code signing, physical-device installation, and
App Store/TestFlight submission require macOS. The iOS source has not been compiled in this Windows
environment, and that expected limitation is not a backend failure.

## Build on a Mac

Install Xcode and XcodeGen, clone the repository, run `xcodegen generate` in `apps/ios`, and open the
generated `Map.xcodeproj`. Select a development team and a unique bundle identifier. For a physical
iPhone, set `API_BASE_URL` in target build settings to `http://WINDOWS_LAN_IP:8000`, connect both
devices to the same trusted Wi-Fi, confirm `/health` is reachable, then build/run from Xcode.

The checked-in Info.plist build settings describe local-network access and permit local HTTP traffic.
Do not use `localhost` for a physical phone. Preserve visible OSM attribution.

## Future options

- Use a Mac temporarily for Xcode, building, and signing.
- Purchase a dedicated Mac mini later.
- Adopt a macOS cloud CI/build provider later.

No paid provider is selected at this milestone.
