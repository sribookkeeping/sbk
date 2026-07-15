#!/bin/bash
# Type-checks the iOS app sources on a Mac WITHOUT Xcode (Command Line Tools
# only). Since the app moved to the shared REST API there is no SwiftData —
# everything is plain Swift/SwiftUI/Foundation, so this is a full check of all
# app code. iOS-only bits (camera, keyboard types) are behind #if os(iOS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

xcrun swiftc -typecheck -parse-as-library -target arm64-apple-macos14.0 \
  $(find "$ROOT/SriBookKeeping" -name '*.swift')

echo "✅ Type-check passed"
