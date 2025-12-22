# ASC Event universal listener (GTM-5FC28SQ)

This folder contains a universal version of the ASC Event host listener that validates shared keys and forwards events to GA4, GTM's `dataLayer`, and the ASC data layer. A lightweight singleton guard prevents duplicate listeners when the snippet is injected multiple times (for example, through GTM).

## Files
- `universal-listener.js` – drop-in listener that accepts ASC Event payloads sent via `postMessage` and dispatches them directly through `gtag`, `dataLayer`, and `asc_datalayer`.

## Quick start (local testing)
1. Serve a simple HTML page locally (for example, with `python -m http.server`) and include the contents of `universal-listener.js` in a `<script>` tag.
2. Configure the `ALLOWED_INTERNAL_KEYS` array in `universal-listener.js` to include the shared secret you expect from the iframe or third-party tool (the default `universal_asc_listener_v1` value is versioned so you can rotate or add future keys).
3. Open the page in your browser and fire a test payload from the console or another iframe using `window.postMessage`.

```js
window.postMessage(
  {
    internalKey: "universal_asc_listener_v1", // must match one of ALLOWED_INTERNAL_KEYS
    event: "asc_purchase",
    eventModel: {
      send_to: ["G-XXXXXXX"],
      currency: "USD",
      value: 12500,
      vehicle_id: "1FTFW1E58JKD12345"
    }
  },
  "*"
);
```

The listener parses the payload, merges any GA4 measurement IDs (`send_to`) with IDs already present on the host page (without replacing `asc_datalayer.measurement_ids`), and then waits for `gtag('config', ...)` to run before dispatching the event to `gtag`, `dataLayer`, and `asc_datalayer`.

## Notes
- Events are pushed into `window.dataLayer` as `{ event: "dl_<event>", eventModel: <payload> }`, into `window.asc_datalayer.events` as `{ event: <event>, ...payload }`, and to `gtag('event', ...)`.
- Ensure the page defines `window.asc_datalayer` (the listener will initialize `{ events: [] }` if missing) and includes GA4/GTM as needed for your measurement IDs.
- Third-party tools embedding this listener should retain the IIFE wrapper and avoid modifying the dispatch logic beyond updating `ALLOWED_INTERNAL_KEYS` and measurement IDs.
- The script avoids ES2015 features so it can run inside GTM Custom HTML tags without enabling newer language modes.
