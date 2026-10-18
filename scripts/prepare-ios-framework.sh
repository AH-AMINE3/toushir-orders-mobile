#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Documents folders managed by iCloud add Finder attributes that code signing
# rejects. Build Expo's nested Swift package outside that folder, then copy only
# its generated products. Source dependencies remain unchanged.
package_dir="$PWD/node_modules/expo-modules-jsi/apple"
[ -f "$package_dir/scripts/build-xcframework.sh" ] || exit 0
build_root="$(mktemp -d "${TMPDIR:-/tmp}/toushir-expo-jsi.XXXXXX")"
trap 'rm -rf "$build_root"' EXIT
mkdir -p "$build_root/bin" "$build_root/output/Products"
if [ -d "$package_dir/Products/ExpoModulesJSI.xcframework" ]; then
 COPYFILE_DISABLE=1 cp -R "$package_dir/Products/ExpoModulesJSI.xcframework" "$build_root/output/Products/"
 xattr -cr "$build_root/output/Products/ExpoModulesJSI.xcframework"
fi
cat > "$build_root/bin/xcodebuild" <<'WRAPPER'
#!/bin/bash
case "${1:-}" in build) exec /usr/bin/xcodebuild -jobs 2 "$@";; *) exec /usr/bin/xcodebuild "$@";; esac
WRAPPER
chmod +x "$build_root/bin/xcodebuild"
PATH="$build_root/bin:$PATH" PODS_ROOT="$PWD/ios/Pods" REACT_NATIVE_PATH="$PWD/node_modules/react-native" EXPO_CUSTOM_BUILD_ROOT="$build_root/output" PLATFORM_NAME=iphonesimulator bash "$package_dir/scripts/build-xcframework.sh"
COPYFILE_DISABLE=1 cp -R "$build_root/output/Products/ExpoModulesJSI.xcframework/" "$package_dir/Products/ExpoModulesJSI.xcframework/"
xattr -cr "$package_dir/Products/ExpoModulesJSI.xcframework"
