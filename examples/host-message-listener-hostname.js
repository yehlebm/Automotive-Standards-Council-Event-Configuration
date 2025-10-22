/*
 * Automotive Standards Council Event (ASC Event) host-page example (host-origin
 * validation).
 *
 * Copy this script onto the dealership website when validating iframe messages
 * by the iframe's origin. Update ALLOWED_IFRAME_ORIGINS with the ASC Event
 * partner domains that should be trusted. Logging the normalized payload into
 * window.asc_datalayer is part of the ASC Event specification.
 */
(function () {
  "use strict";

  const ALLOWED_IFRAME_ORIGINS = ["https://iframe.example.com"]; // Replace values

  /**
   * Attempts to parse measurement IDs from a variety of formats.
   * @param {unknown} value
   * @returns {string[]}
   */
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

  /**
   * Merges host and iframe measurement IDs, removing duplicates.
   * @param {string[]} hostIds
   * @param {string[]} iframeIds
   * @returns {string[]}
   */
  function mergeMeasurementIds(hostIds, iframeIds) {
    return [...new Set([...hostIds, ...iframeIds])];
  }

  /**
   * Checks whether the GA4 configuration has been run for all provided measurement IDs.
   * @param {string[]} ids
   * @returns {boolean}
   */
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

  /**
   * Waits until gtag('config', '<ID>') has fired for each measurement ID before
   * invoking the callback. Logs a warning if the wait becomes long.
   * @param {string[]} ids
   * @param {() => void} callback
   */
  function waitForGtagConfig(ids, callback) {
    if (typeof callback !== "function") return;
    if (haveGtagConfigs(ids)) {
      callback();
      return;
    }

    var attempts = 0;
    var WARN_AFTER_ATTEMPTS = 40; // ~10 seconds when polling every 250ms
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

  /**
   * Handles messages posted by the ASC Event iframe.
   * @param {MessageEvent} event
   */
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

    var measurementIdsToCheck = combinedMeasurementIds;

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
        event: "dl_asc",
        ascEventName: eventName,
        eventModel: eventData
      });
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
