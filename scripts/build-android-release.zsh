#!/bin/zsh
set -euo pipefail

TASK_ROOT="${0:A:h:h}"
role="${1:-${EXPO_PUBLIC_APP_ROLE:-}}"
case "$role" in
 merchant|MERCHANT) role=merchant;;
 driver|DRIVER) role=driver;;
 *) print -u2 'Choose merchant or driver explicitly: scripts/build-android-release.zsh merchant'; exit 2;;
esac
: "${EXPO_PUBLIC_API_URL:?Set the verified public HTTPS API origin.}"
[[ "$EXPO_PUBLIC_API_URL" == https://* ]] || { print -u2 'The release API origin must use HTTPS.'; exit 1; }
: "${TOUSHIR_SIGNING_STORE_FILE:?Set the private signing keystore path.}"
: "${TOUSHIR_SIGNING_STORE_PASSWORD:?Set the keystore password.}"
: "${TOUSHIR_SIGNING_KEY_ALIAS:?Set the signing alias.}"
: "${TOUSHIR_SIGNING_KEY_PASSWORD:?Set the signing password.}"
: "${JAVA_HOME:?Set JAVA_HOME to JDK 17.}"
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK.}"
[[ -f "$TOUSHIR_SIGNING_STORE_FILE" ]] || { print -u2 'The private signing keystore file does not exist.'; exit 1; }
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export NODE_ENV=production
export EXPO_NO_TELEMETRY=1
export TOUSHIR_RELEASE_SIGNING=1
bash "$TASK_ROOT/scripts/build-native.sh" "$role" android
