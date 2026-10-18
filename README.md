# TOUSHIR mobile ordering app

React Native 0.88 with Expo 58. Both native apps share a codebase and use the .NET/ABP commerce API. The browser edition uses the same components and mutations.

Independent React Native project for the merchant ordering app. The .NET 10 / ABP backend and wholesaler back office are maintained separately in [toushir-commerce](https://github.com/AH-AMINE3/toushir-commerce). This repository contains no backend or web back-office project. The default app role is `MERCHANT`; shared mobile source also retains the optional courier variant.

## Start this repository

Install Node.js 24, clone this repository, then install its own dependencies:

```sh
git clone https://github.com/AH-AMINE3/toushir-orders-mobile.git
cd toushir-orders-mobile
npm ci
npm run typecheck
npm run merchant
```

The mobile app needs the commerce API. Start that API from the separate [backend repository](https://github.com/AH-AMINE3/toushir-commerce/blob/main/docs/DEVELOPER-HANDOFF.md), or configure `EXPO_PUBLIC_API_URL` with a reachable HTTPS API origin. The client appends `/api`; do not include that suffix. Public Expo configuration must contain no credentials.

To verify the browser export without launching a native simulator:

```sh
npm run build:web -- --max-workers 1
npm run preview:web
```

Open `http://localhost:8086/mobile/merchant`; the preview proxy targets the API at port 5860. Use the script's `--api` option for a different API host: `python3 scripts/serve-preview.py --api https://your-api.example --port 8086`. Native simulators are optional and are not started by these browser commands.

Source: exported from TOUSHIR Commerce commit `11fb3749b39fcaf295e4c94faefa167f38497eba`. Merchant views live in `src/Merchant.tsx`, `src/MerchantAccount.tsx`, `src/MerchantActivity.tsx`, `src/MerchantDelivery.tsx` and related shared components. Product catalogue images are served by the API; the app's own icons, fonts and design assets are included here.

## Browser previews

Build with `npm ci && npm run build:web`. Serve `dist` at `/mobile`, including `/mobile/_expo` and `/mobile/assets`, and send `/mobile/merchant` and `/mobile/driver` to its `index.html`. Requests to `/api` and product media are same origin.

For local development, start the backend on port 5860, then run `npm run preview:web`. Open:

- `http://localhost:8086/mobile/merchant`
- `http://localhost:8086/mobile/driver`

The bundled preview server preserves the browser Host through its API proxy so local OIDC endpoints and callbacks remain on the same origin. It binds to localhost. Use the main application host for public links.

## Separate native apps

`app.config.js` selects the app name, icon, scheme and iOS/Android identifier from `EXPO_PUBLIC_APP_ROLE`:

| App | Role | Android/iOS identifier |
| --- | --- | --- |
| Toushir Commerce | MERCHANT | com.toushir.commerce |
| Toushir Livreur | DRIVER | com.toushir.livreur |

Set `EXPO_PUBLIC_API_URL` to an API reachable by the device. Android Emulator accesses the Mac through `http://10.0.2.2:5860`; iOS Simulator can use `http://localhost:5860`. A phone requires a reachable LAN or HTTPS URL.

Local Android builds:

```sh
EXPO_PUBLIC_API_URL=http://10.0.2.2:5860 npm run build:merchant:android
EXPO_PUBLIC_API_URL=http://10.0.2.2:5860 npm run build:driver:android
```

For local iOS Simulator builds, use `EXPO_PUBLIC_API_URL=http://localhost:5860 bash scripts/build-native.sh merchant ios` (or `driver ios`). The iOS build uses two workers and a temporary build directory to avoid iCloud Finder metadata interfering with framework signing; the app bundle is copied into `build/ios-merchant` or `build/ios-driver`, with a portable Simulator zip in `build/downloads`.

The supplied iOS Simulator archives were verified against the local API; they are not iPhone installation packages. To regenerate both variants for the confirmed public preview, run these sequentially from `apps/mobile` with Xcode and CocoaPods configured:

```sh
EXPO_PUBLIC_API_URL=https://toushir-commerce-staging.onrender.com bash scripts/build-native.sh merchant ios
EXPO_PUBLIC_API_URL=https://toushir-commerce-staging.onrender.com bash scripts/build-native.sh driver ios
# Restore the default generated native project after retaining both archives.
EXPO_PUBLIC_API_URL=https://toushir-commerce-staging.onrender.com EXPO_PUBLIC_APP_ROLE=MERCHANT ./node_modules/.bin/expo prebuild --platform ios --no-install
```

The script regenerates native configuration for the selected app, compiles with two workers for arm64, and puts the APK in `build/downloads`. The generated local release configuration uses a development signing key for testing. Private signed builds use `scripts/build-android-release.zsh merchant` or `driver` with a verified HTTPS API and the four `TOUSHIR_SIGNING_*` variables. Expo’s signing plugin reads those values only during Gradle execution and preserves the existing keystore; it never writes passwords to generated source. Both commands regenerate the selected variant before building. Production store distribution still requires the owner’s store configuration.

EAS profiles: `merchant-preview`, `driver-preview`, `merchant-production`, `driver-production`. Preview iOS builds target Simulator. Supply a reachable `EXPO_PUBLIC_API_URL` through the build environment. `.easignore` excludes generated native directories so the selected role generates the correct native identifiers during EAS prebuild.

## Connected workflows

Merchant: catalogue search, categories, favorites, persisted basket, RFQ, versioned quote approval, order history, delivery tracking, quantity approval, expiring receipt QR, receipt/payment history and claims.

Courier: assigned manifest, route manifest custody scan, per-order pickup fallback, navigation, foreground location consent, arrival, quantity-bound receipt scan/manual-code fallback, partial or refused delivery, explicit cash tender/change, history and route cash declaration. Warehouse counts and finance reconciliation remain separate operations.

GPS is opt-in and foreground-only. Tracking displays stale fixes honestly; stopping sharing also revokes the last visible position. Browser camera/location require a secure context (localhost or HTTPS).

Live views use authenticated polling every eight seconds and display that mode plus the last successful update. They do not claim a live socket. Financial submission preserves its idempotency reference before sending, so an interrupted payment can be retried with the same amounts. Unconfirmed actions retain their input and surface server failures; the app does not invent successful business operations or silently complete actions offline.

Browser bearer tokens are scoped to each tab's session storage; the demo workspace owner capability is shared in local storage. Native tokens use SecureStore. Merchant and courier tabs can operate concurrently without changing each other's actor.

## Validation

`npm run typecheck` checks the entire mobile app. `npm run build:web` exports the browser edition. Actual simulator/device evidence is reported separately; browser captures are not native test evidence.

## Secure sign-in

Real accounts sign in through the system browser or browser authorization popup using OpenID Connect authorization code with S256 PKCE, the public `toushir-mobile` client and the app variant’s exact callback scheme. The browser callback is `/mobile/auth/callback`. Access and rotating refresh credentials are stored in SecureStore on native and tab-scoped session storage in the browser; no client secret or resource-owner password grant is used. The API client refreshes once on an expired JWT and logout revokes the server session. Demo personas keep the isolated demo session adapter. A lost real-account session returns to secure sign-in instead of silently opening a demo.

Implementation follows the [Expo AuthSession reference](https://docs.expo.dev/versions/latest/sdk/auth-session/) and [authentication guide](https://docs.expo.dev/guides/authentication/).

Messages are persisted in-app conversations with authorized order/delivery/gift context. Offers show published conditions and server-calculated previews; the quote remains authoritative. Points/rewards show the actual wallet, reservation and gift states. `engagement.updated` invalidates these views through SignalR, with the labelled eight-second polling fallback retained.
