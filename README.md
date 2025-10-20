# Automotive-Standards-Council-Event-Configuration
Configuration Examples of Automotive Standards Council Events for Automotive Dealers

## ASC iframe integration overview

Automotive Standards Council (ASC) partners frequently embed their widgets or
applications as iframes inside a dealership website. In this setup the ASC
plugin cannot call `gtag()` directly because the Google Analytics 4 (GA4) tag
lives on the host page. Instead, the iframe should **post a message** to its
parent window, and the host page is responsible for listening for that message
and forwarding it to GA4, Google Tag Manager (GTM), and the ASC data layer.

The examples below walk through:

1. Formatting the event data within the iframe.
2. Posting the message to the parent window.
3. Listening for messages on the host page and routing them to the appropriate
   destinations.

Ready-to-use scripts that mirror the snippets below are stored in the
[`examples/`](examples/) directory so developers can copy and include them
directly.

## 1. Prepare the event inside the iframe

Within the iframe, construct the event payload using the same structure that
`gtag()` and the various data layers expect. Include the GA4 measurement IDs in
`send_to` when available so they can be forwarded by the host page. A
copy/paste-ready script lives at [`examples/iframe-post-message.js`](examples/iframe-post-message.js).

```html
<script src="/path/to/examples/iframe-post-message.js"></script>
```

If you prefer to inline the logic instead of loading the shared file, the
following snippet shows the same approach:

```html
<script>
  (function () {
    "use strict";

    const measurementIds = ["G-123", "G-456"]; // example values
    const serializedMeasurementIds = JSON.stringify(measurementIds);

    const message = {
      event: "asc_form_submission", // ASC event name
      internalKey: "123abc", // optional iframe-specific validation key
      eventModel: {
        page_type: "service",
        send_to: serializedMeasurementIds,
        // ...other ASCDimensions
      }
    };

    window.parent.postMessage(JSON.stringify(message), "*");
  })();
</script>
```

### Notes for iframe developers

- The payload must be serialized (for example with `JSON.stringify`) because
  many hosts expect a string when processing `postMessage` data.
- Include a shared `internalKey` if the host and iframe agree to use one for
  validation.
- If the iframe does not manage measurement IDs, leave `send_to` undefined and
  the host can supply its own value.

## 2. Listen for iframe messages on the host page

On the dealership website, add a listener that validates the message source,
merges measurement IDs if desired, and then forwards the event to GA4, GTM, and
the ASC data layer. The ready-made listener is available at
[`examples/host-message-listener.js`](examples/host-message-listener.js).

```html
<script src="/path/to/examples/host-message-listener.js"></script>
```

To inline the logic, copy the snippet below:

```html
<script>
  (function () {
    "use strict";

    const ASC_IFRAME_HOST = "https://iframe.example.com"; // replace with your iframe origin
    const INTERNAL_KEY = "123abc"; // optional shared secret

    function parseMeasurementIds(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.warn("ASC measurement ID parsing failed", error);
          return [];
        }
      }
      return [];
    }

    function mergeMeasurementIds(hostIds, iframeIds) {
      return [...new Set([...hostIds, ...iframeIds])];
    }

    function manageAscEvent(event) {
      const { data, origin } = event;

      if (origin !== ASC_IFRAME_HOST) return;

      let payload;
      try {
        payload = typeof data === "string" ? JSON.parse(data) : data;
      } catch (error) {
        console.warn("ASC iframe payload could not be parsed", error);
        return;
      }

      if (INTERNAL_KEY && payload.internalKey !== INTERNAL_KEY) return;

      const eventName = payload.event;
      if (!eventName) return;

      const eventData = {
        ...(payload.eventModel || {})
      };

      window.asc_data_layer = window.asc_data_layer || [];
      const hostMeasurementIds = parseMeasurementIds(
        window.asc_data_layer.measurement_ids
      );
      const iframeMeasurementIds = parseMeasurementIds(eventData.send_to);
      const combinedMeasurementIds = mergeMeasurementIds(
        hostMeasurementIds,
        iframeMeasurementIds
      );

      if (combinedMeasurementIds.length > 0) {
        eventData.send_to = JSON.stringify(combinedMeasurementIds);
        window.asc_data_layer.measurement_ids = combinedMeasurementIds;
      } else {
        delete eventData.send_to;
      }

      if (typeof window.gtag === "function") {
        window.gtag("event", eventName, eventData);
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: `dl_${eventName}`,
        eventModel: eventData
      });

      window.asc_data_layer.push({
        event: eventName,
        ...eventData
      });
    }

    window.addEventListener("message", manageAscEvent);
  })();
</script>
```

### Host implementation tips

- Use the `origin` value from the message event to ensure the message came from
  a trusted iframe domain.
- Wrap `JSON.parse` in a `try/catch` if you need to guard against malformed
  data. (Omitted here for brevity.)
- Only push to GA4 and GTM after the message has been validated and the payload
  has been normalized.
- Prefixing the GTM event name (for example `dl_`) keeps ASC events distinct
  from native GTM events.

## 3. Example end-to-end flow

1. The iframe posts the serialized event payload to the parent window.
2. The host page receives the message, validates the origin (and optional
   `internalKey`), and parses the payload.
3. Measurement IDs from the host and iframe are merged and serialized.
4. The host forwards the event to GA4 (`gtag("event", ...)`).
5. The host pushes the normalized event to both `window.dataLayer` and
   `window.asc_data_layer` to enable additional tracking and partner tooling.

By following this pattern, iframe-based partners can rely on the host website
to deliver Automotive Standards Council events to all required analytics
destinations without directly embedding GA4 or GTM inside the iframe.
