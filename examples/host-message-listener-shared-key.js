/*
 * Automotive Standards Council Event (ASC Event) host-page example (shared-key
 * validation).
 *
 * Copy this script onto the dealership website when validating iframe messages
 * using a shared secret. Update ALLOWED_INTERNAL_KEYS with the keys that ASC
 * Event partners are expected to send. Logging the normalized payload into
 * window.asc_datalayer is part of the ASC Event specification.
 */
(function () {
  "use strict";

  const ALLOWED_INTERNAL_KEYS = ["123abc"]; // Replace values

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
    var MAX_ATTEMPTS = 10;
    var WARN_AFTER_ATTEMPTS = 10; // ~5 seconds when polling every 500ms
    var POLL_INTERVAL_MS = 500;

    (function poll() {
      if (haveGtagConfigs(ids)) {
        callback();
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.warn(
          "ASC Event listener did not detect gtag('config', ...) after max attempts for",
          ids
        );
        callback();
        return;
      }

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
  function ensureAscDataLayer() {
    var asc = window.asc_datalayer;
    if (!asc || typeof asc !== "object") {
      asc = { events: [] };
      window.asc_datalayer = asc;
    }

    if (!Array.isArray(asc.events)) {
      asc.events = [];
    }

    return asc;
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

    const ascDataLayer = ensureAscDataLayer();
    const hostMeasurementIds = parseMeasurementIds(
      ascDataLayer.measurement_ids
    );
    const iframeMeasurementIds = parseMeasurementIds(eventData.send_to);
    const combinedMeasurementIds = mergeMeasurementIds(
      hostMeasurementIds,
      iframeMeasurementIds
    ); // Helps GA4 properties already on the site that want ASC Events

    var measurementIdsToCheck = combinedMeasurementIds;

    if (combinedMeasurementIds.length > 0) {
      eventData.send_to = combinedMeasurementIds;
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
        event: "dl_" + eventName,
        eventModel: eventData
      });

      ascDataLayer.events.push({
        event: eventName,
        ...eventData
      });
    });
  }

  window.addEventListener("message", manageAscEvent);
})();
