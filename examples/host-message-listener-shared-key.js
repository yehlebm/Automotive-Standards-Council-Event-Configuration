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

  /**
   * Handles messages posted by the ASC Event iframe.
   * @param {MessageEvent} event
   */
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

    if (combinedMeasurementIds.length > 0) {
      eventData.send_to = JSON.stringify(combinedMeasurementIds);
      window.asc_datalayer.measurement_ids = combinedMeasurementIds;
    } else {
      delete eventData.send_to;
    }

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
  }

  window.addEventListener("message", manageAscEvent);
})();
