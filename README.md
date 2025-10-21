# Automotive-Standards-Council-Event-Configuration
Community examples of ASC Events for automotive dealers

> **Note:** This repository is a community-maintained resource and is not
> affiliated with or endorsed by any official ASC Event program.

## ASC Event iframe integration overview

Automotive Standards Council Event (ASC Event) partners frequently embed their
widgets or applications as iframes inside a dealership website. In this setup
the ASC Event plugin cannot call `gtag()` directly because the Google Analytics
4 (GA4) tag lives on the host page. Installing a separate GA4 instance inside
the iframe will not preserve session attribution because cross-domain
restrictions prevent the iframe from sharing cookies with the host page during
user interactions. Instead, the iframe should **post a message** to its parent
window, and the host page is responsible for
listening for that message and forwarding it to GA4, Google Tag Manager (GTM),
and the ASC Event data layer.

Iframe providers remain responsible for maintaining **both** pieces of this
integration: the `postMessage` logic that runs within their iframe and the
corresponding `eventListener` script that dealership websites install. Keep
both scripts in sync so dealers can rely on up-to-date instructions and code.

The examples below walk through:

1. Formatting the event data within the iframe.
2. Posting the message to the parent window.
3. Listening for messages on the host page and routing them to the appropriate
   destinations.

Ready-to-use scripts that mirror the snippets below are stored in the
[`examples/`](examples/) directory so developers can copy and include them
directly. Choose the validation strategy that matches your integration:

- **Host-origin validation**
  - [`examples/iframe-post-message-hostname.js`](examples/iframe-post-message-hostname.js)
  - [`examples/host-message-listener-hostname.js`](examples/host-message-listener-hostname.js)
- **Shared-key validation**
  - [`examples/iframe-post-message-shared-key.js`](examples/iframe-post-message-shared-key.js)
  - [`examples/host-message-listener-shared-key.js`](examples/host-message-listener-shared-key.js)

## 1. Prepare the event inside the iframe

Within the iframe, construct the event payload using the same structure that
`gtag()` and the various data layers expect. Include the GA4 measurement IDs in
`send_to` when available so they can be forwarded by the host page.

### Option A: Host-origin validation

Use this pattern when the host page restricts messages to specific iframe
origins.

```html
<script src="/path/to/examples/iframe-post-message-hostname.js"></script>
```

To inline the logic instead of loading the shared file:

```html
<script>
  (function () {
    "use strict";

    const HOST_PAGE_ORIGIN = "https://dealer.example.com"; // replace with host site origin
    const measurementIds = ["G-123", "G-456"]; // example values
    const serializedMeasurementIds = JSON.stringify(measurementIds);

    const message = {
      event: "asc_form_submission", // ASC Event name
      eventModel: {
        page_type: "service",
        send_to: serializedMeasurementIds,
        // ...otherAscEventDimensions
      }
    };

    window.parent.postMessage(JSON.stringify(message), HOST_PAGE_ORIGIN);
  })();
</script>
```

### Option B: Shared-key validation

Use this pattern when the host page validates iframe messages using a shared
secret.

```html
<script src="/path/to/examples/iframe-post-message-shared-key.js"></script>
```

Inline version:

```html
<script>
  (function () {
    "use strict";

    const INTERNAL_KEY = "123abc"; // replace with your shared secret
    const measurementIds = ["G-123", "G-456"]; // example values
    const serializedMeasurementIds = JSON.stringify(measurementIds);

    const message = {
      event: "asc_form_submission", // ASC Event name
      internalKey: INTERNAL_KEY,
      eventModel: {
        page_type: "service",
        send_to: serializedMeasurementIds,
        // ...otherAscEventDimensions
      }
    };

    window.parent.postMessage(JSON.stringify(message), "*");
  })();
</script>
```

### Notes for iframe developers

- The payload must be serialized (for example with `JSON.stringify`) because
  many hosts expect a string when processing `postMessage` data.
- For host-origin validation, the second argument of `postMessage` should be the
  dealership's origin. For shared-key validation, set it to `"*"` so the message
  reaches the host regardless of domain, and rely on the shared key for
  validation.
- If the iframe does not manage measurement IDs, leave `send_to` undefined and
  the host can supply its own value.

## 2. Listen for iframe messages on the host page

On the dealership website, add a listener that validates the message source,
merges measurement IDs if desired, and then forwards the event to GA4, GTM, and
the ASC Event data layer. Choose the listener that matches your validation
strategy.

### Option A: Host-origin validation

```html
<script src="/path/to/examples/host-message-listener-hostname.js"></script>
```

Inline version:

```html
<script>
  (function () {
    "use strict";

    const ALLOWED_IFRAME_ORIGINS = ["https://iframe.example.com"]; // replace with trusted iframe origins

    function parseMeasurementIds(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.warn("ASC Event measurement ID parsing failed", error);
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

      if (!ALLOWED_IFRAME_ORIGINS.includes(origin)) return;

      let payload;
      try {
        payload = typeof data === "string" ? JSON.parse(data) : data;
      } catch (error) {
        console.warn("ASC Event iframe payload could not be parsed", error);
        return;
      }

      const eventName = payload && payload.event;
      if (!eventName) return;

      const eventData = {
        ...((payload && payload.eventModel) || {})
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

### Option B: Shared-key validation

```html
<script src="/path/to/examples/host-message-listener-shared-key.js"></script>
```

Inline version:

```html
<script>
  (function () {
    "use strict";

    const ALLOWED_INTERNAL_KEYS = ["123abc"]; // replace with shared secrets from ASC Event partners

    function parseMeasurementIds(value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.warn("ASC Event measurement ID parsing failed", error);
          return [];
        }
      }
      return [];
    }

    function mergeMeasurementIds(hostIds, iframeIds) {
      return [...new Set([...hostIds, ...iframeIds])];
    }

    function manageAscEvent(event) {
      const { data } = event;

      let payload;
      try {
        payload = typeof data === "string" ? JSON.parse(data) : data;
      } catch (error) {
        console.warn("ASC Event iframe payload could not be parsed", error);
        return;
      }

      if (!payload || !ALLOWED_INTERNAL_KEYS.includes(payload.internalKey)) {
        return;
      }

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

- Use the `origin` value from the message event when validating by hostname, or
  a shared `internalKey` for the shared-secret approach. You can also combine
  both strategies if desired.
- Wrap `JSON.parse` in a `try/catch` if you need to guard against malformed
  data.
- Only push to GA4 and GTM after the message has been validated and the payload
  has been normalized.
- Prefixing the GTM event name (for example `dl_`) keeps ASC Events distinct
  from native GTM events.

## 3. Example end-to-end flow

1. The iframe posts the serialized event payload to the parent window.
2. The host page receives the message, validates it using either the iframe
   origin or shared key, and parses the payload.
3. Measurement IDs from the host and iframe are merged and serialized.
4. The host forwards the event to GA4 (`gtag("event", ...)`).
5. The host pushes the normalized event to both `window.dataLayer` and
   `window.asc_data_layer` to enable additional tracking and partner tooling.

By following this pattern, iframe-based partners can rely on the host website
to deliver Automotive Standards Council Events (ASC Events) to all required
analytics destinations without directly embedding GA4 or GTM inside the iframe.
