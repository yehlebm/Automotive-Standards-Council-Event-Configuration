/*
 * Automotive Standards Council (ASC) host-page example (host-origin validation).
 *
 * Copy this script onto the dealership website when validating iframe messages
 * by the iframe's origin. Update ALLOWED_IFRAME_ORIGINS with the ASC partner
 * domains that should be trusted.
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
        console.warn("ASC measurement ID parsing failed", error);
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
   * Handles messages posted by the ASC iframe.
   * @param {MessageEvent} event
   */
  function manageAscEvent(event) {
    const { data, origin } = event;

    if (!ALLOWED_IFRAME_ORIGINS.includes(origin)) return;

    let payload;
    try {
      payload = typeof data === "string" ? JSON.parse(data) : data;
    } catch (error) {
      console.warn("ASC iframe payload could not be parsed", error);
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
