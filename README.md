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
`send_to` when available so they can be forwarded by the host page, and
serialize them so the host can batch its `gtag()` calls below the 20 calls per
second guidance.

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
    const serializedMeasurementIds = JSON.stringify(
      measurementIds
    ); // Serialize to batch gtag() calls and stay under GA4's 20 calls/second guidance

    const message = {
      event: "asc_form_submission", // ASC Event name
      eventModel: {
        page_type: "service",
        send_to: serializedMeasurementIds,
        // ...otherAscEventDimensions
      }
    };

    const directEventModel = {
      ...message.eventModel,
      send_to: measurementIds
    };

    const isInIframe = window.parent && window.parent !== window;

    if (isInIframe) {
      window.parent.postMessage(JSON.stringify(message), HOST_PAGE_ORIGIN);
      // If you cannot maintain a host-origin list, coordinate with the dealer to
      // use the shared-key variant and post with "*" instead.
    } else {
      if (typeof window.gtag === "function") {
        window.gtag("event", message.event, directEventModel);
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: `dl_${message.event}`,
        eventModel: directEventModel
      });

      window.asc_datalayer = window.asc_datalayer || [];
      window.asc_datalayer.push({
        event: message.event,
        ...directEventModel
      });
    }
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
    const serializedMeasurementIds = JSON.stringify(
      measurementIds
    ); // Serialize to batch gtag() calls and stay under GA4's 20 calls/second guidance

    const message = {
      event: "asc_form_submission", // ASC Event name
      internalKey: INTERNAL_KEY,
      eventModel: {
        page_type: "service",
        send_to: serializedMeasurementIds,
        // ...otherAscEventDimensions
      }
    };

    const directEventModel = {
      ...message.eventModel,
      send_to: measurementIds
    };

    const isInIframe = window.parent && window.parent !== window;

    if (isInIframe) {
      window.parent.postMessage(JSON.stringify(message), "*"); // Shared key gates access
    } else {
      if (typeof window.gtag === "function") {
        window.gtag("event", message.event, directEventModel);
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: `dl_${message.event}`,
        eventModel: directEventModel
      });

      window.asc_datalayer = window.asc_datalayer || [];
      window.asc_datalayer.push({
        event: message.event,
        ...directEventModel
      });
    }
  })();
</script>
```

### Notes for iframe developers

- The payload must be serialized (for example with `JSON.stringify`) because
  many hosts expect a string when processing `postMessage` data. Serializing the
  `send_to` measurement IDs also lets the host batch GA4 calls, keeping the
  integration under the 20 calls/second guidance.
- For host-origin validation, the second argument of `postMessage` should be the
  dealership's origin. If the iframe provider cannot reliably manage host
  origins, coordinate with the dealer to switch to the shared-key flow so you
  can send the message with `"*"` and rely on the shared key for validation.
- If the iframe does not manage measurement IDs, leave `send_to` undefined and
  the host can supply its own value.

## 2. Listen for iframe messages on the host page

On the dealership website, add a listener that validates the message source,
merges measurement IDs if desired, and then forwards the event to GA4, GTM, and
the ASC Event data layer. Logging into `window.asc_datalayer` is part of the ASC
Event specification, so keep that array in sync with each message you process.
Choose the listener that matches your validation strategy.

Each listener pushes an event-specific `dl_<eventName>` entry into
`window.dataLayer` so that Google Tag Manager and other tag-management systems
can hook into the ASC Event directly. The measurement IDs the listener merges
represent GA4 properties that already live on the dealership website and want
to consume ASC Events automatically.

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

    function haveGtagConfigs(ids) {
      if (!ids || ids.length === 0) return true;
      const dataLayer = window.dataLayer || [];
      return ids.every(function (id) {
        return dataLayer.some(function (entry) {
          if (!entry || typeof entry !== "object") return false;
          return entry[0] === "config" && entry[1] === id;
        });
      });
    }

    function waitForGtagConfig(ids, callback) {
      if (typeof callback !== "function") return;
      if (haveGtagConfigs(ids)) {
        callback();
        return;
      }

      let attempts = 0;
      const WARN_AFTER_ATTEMPTS = 40;
      const POLL_INTERVAL_MS = 250;

      (function poll() {
        if (haveGtagConfigs(ids)) {
          callback();
          return;
        }

        attempts += 1;
        if (attempts === WARN_AFTER_ATTEMPTS) {
          console.warn(
            "ASC Event listener is still waiting for gtag('config', ...) to run for",
            ids
          );
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      })();
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

      window.asc_datalayer = window.asc_datalayer || [];
      const hostMeasurementIds = parseMeasurementIds(
        window.asc_datalayer.measurement_ids
      );
      const iframeMeasurementIds = parseMeasurementIds(eventData.send_to);
      const combinedMeasurementIds = mergeMeasurementIds(
        hostMeasurementIds,
        iframeMeasurementIds
      ); // Helps GA4 properties already on the site that want ASC Events

      let measurementIdsToCheck = combinedMeasurementIds;

      if (combinedMeasurementIds.length > 0) {
        eventData.send_to = JSON.stringify(combinedMeasurementIds);
        window.asc_datalayer.measurement_ids = combinedMeasurementIds;
      } else {
        measurementIdsToCheck = [];
        delete eventData.send_to;
      }

      waitForGtagConfig(measurementIdsToCheck, function () {
        if (typeof window.gtag === "function") {
          window.gtag("event", eventName, eventData);
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: `dl_${eventName}`,
          eventModel: eventData
        });

        window.asc_datalayer.push({
          event: eventName,
          ...eventData
        });
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

    function haveGtagConfigs(ids) {
      if (!ids || ids.length === 0) return true;
      const dataLayer = window.dataLayer || [];
      return ids.every(function (id) {
        return dataLayer.some(function (entry) {
          if (!entry || typeof entry !== "object") return false;
          return entry[0] === "config" && entry[1] === id;
        });
      });
    }

    function waitForGtagConfig(ids, callback) {
      if (typeof callback !== "function") return;
      if (haveGtagConfigs(ids)) {
        callback();
        return;
      }

      let attempts = 0;
      const WARN_AFTER_ATTEMPTS = 40;
      const POLL_INTERVAL_MS = 250;

      (function poll() {
        if (haveGtagConfigs(ids)) {
          callback();
          return;
        }

        attempts += 1;
        if (attempts === WARN_AFTER_ATTEMPTS) {
          console.warn(
            "ASC Event listener is still waiting for gtag('config', ...) to run for",
            ids
          );
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      })();
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

      window.asc_datalayer = window.asc_datalayer || [];
      const hostMeasurementIds = parseMeasurementIds(
        window.asc_datalayer.measurement_ids
      );
      const iframeMeasurementIds = parseMeasurementIds(eventData.send_to);
      const combinedMeasurementIds = mergeMeasurementIds(
        hostMeasurementIds,
        iframeMeasurementIds
      ); // Helps GA4 properties already on the site that want ASC Events

      let measurementIdsToCheck = combinedMeasurementIds;

      if (combinedMeasurementIds.length > 0) {
        eventData.send_to = JSON.stringify(combinedMeasurementIds);
        window.asc_datalayer.measurement_ids = combinedMeasurementIds;
      } else {
        measurementIdsToCheck = [];
        delete eventData.send_to;
      }

      waitForGtagConfig(measurementIdsToCheck, function () {
        if (typeof window.gtag === "function") {
          window.gtag("event", eventName, eventData);
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: `dl_${eventName}`,
          eventModel: eventData
        });

        window.asc_datalayer.push({
          event: eventName,
          ...eventData
        });
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
- Merging host and iframe measurement IDs is an attempt to automate tracking as
  soon as your tool is installed—any GA4 properties already configured on the
  dealership site and expecting ASC Events will receive the events without extra
  dealer work.
- Wait to call `gtag("event", ...)` until `gtag("config", "<MEASUREMENT_ID>")`
  has executed for each measurement ID you intend to use. The helper functions
  above poll `window.dataLayer` for `config` entries and delay the GA4 event until
  the configuration has run.
- Push the event-specific `dl_<eventName>` to `window.dataLayer` so GTM and
  other tag management systems can hook into the ASC Event payload.
- Only push to GA4 and the data layers after the message has been validated and
  the payload has been normalized.

## 3. Example end-to-end flow

1. The iframe posts the serialized event payload to the parent window.
2. The host page receives the message, validates it using either the iframe
   origin or shared key, and parses the payload.
3. Measurement IDs from the host and iframe are merged and serialized.
4. The host waits for the relevant `gtag("config", ...)` calls to fire and then
   forwards the event to GA4 (`gtag("event", ...)`).
5. The host pushes the normalized event to both `window.dataLayer` and
   `window.asc_datalayer` to enable additional tracking and partner tooling.

By following this pattern, iframe-based partners can rely on the host website
to deliver Automotive Standards Council Events (ASC Events) to all required
analytics destinations without directly embedding GA4 or GTM inside the iframe.
