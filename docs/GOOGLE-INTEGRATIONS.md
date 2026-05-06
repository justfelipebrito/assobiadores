# Google Analytics and AdSense Setup

The web app has production-gated Google integrations. Nothing is loaded when
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, and nothing is loaded until the public IDs below are set.

## Google Analytics

Create a GA4 web data stream for `assobiador.com`, then set:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

The app loads `gtag.js` once and sends page views on client-side navigation, including query-string
changes.

## Google AdSense Bottom Banner

After the site is approved in Google AdSense, create a responsive display ad unit for the bottom
banner and set:

```bash
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADSENSE_BOTTOM_SLOT=1234567890
```

The banner renders fixed at the bottom of the viewport with a small `Publicidade` label and reserves
bottom spacing so it does not cover page content.

## Local QA

For emulator/local browser QA, keep:

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

This prevents analytics events and ad requests during local testing.
