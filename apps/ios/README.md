# Map iOS client

Native SwiftUI source wrapping MapLibre Native. The checked-in `project.yml` is an XcodeGen
specification so project files can be generated reproducibly on macOS:

```sh
brew install xcodegen
cd apps/ios
xcodegen generate
open Map.xcodeproj
```

For a physical iPhone, change `API_BASE_URL` in the target build settings to the Windows laptop's
LAN URL, for example `http://192.168.1.20:8000`. Never use `localhost` for a physical device.
See `docs/IOS_INSTALLATION.md`.
