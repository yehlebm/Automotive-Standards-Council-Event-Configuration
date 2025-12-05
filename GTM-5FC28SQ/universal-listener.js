/*
 * ASC Event host-page listener (shared key validation) for third-party tools.
 *
 * Drop this script onto any page that should accept ASC Event payloads via
 * postMessage. It merges GA4 measurement IDs from the host and iframe, logs the
 * normalized event into window.asc_datalayer, and forwards the event to GA4
 * (gtag), GTM's dataLayer, and the ASC data layer via the shared
 * asc-event-destinations helper when available.
 */
(function () {
  "use strict";

  // Replace with the shared secrets that third parties are allowed to use.
  const ALLOWED_INTERNAL_KEYS = ["123abc"]; // Replace values

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

    var attempts = 0;
    var WARN_AFTER_ATTEMPTS = 40;
    var POLL_INTERVAL_MS = 250;

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
    );

    var measurementIdsToCheck = combinedMeasurementIds;

    if (combinedMeasurementIds.length > 0) {
      eventData.send_to = combinedMeasurementIds;
      window.asc_datalayer.measurement_ids = combinedMeasurementIds;
    } else {
      measurementIdsToCheck = [];
      delete eventData.send_to;
    }

    waitForGtagConfig(measurementIdsToCheck, function () {
      if (
        window.ascEventDestinations &&
        typeof window.ascEventDestinations.fire === "function"
      ) {
        window.ascEventDestinations.fire(eventName, eventData);
      } else {
        console.warn(
          "ASC Event destinations helper not found; event dispatch skipped",
          eventName
        );
      }
    });
  }

  window.addEventListener("message", manageAscEvent);
})();
