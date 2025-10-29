/*
 * Automotive Standards Council Event (ASC Event) iframe example (host-origin
 * validation).
 *
 * Copy this script into your iframe-based plugin when the host page will
 * validate incoming messages using the iframe's origin. Update HOST_PAGE_ORIGIN
 * and MEASUREMENT_IDS to match your implementation.
 */
(function () {
  "use strict";

  // Replace with the origin of the dealership website embedding the iframe.
  const HOST_PAGE_ORIGIN = "https://dealer.example.com"; // Example value

  // Replace with the GA4 measurement IDs used by the iframe experience.
  const MEASUREMENT_IDS = ["G-123", "G-456"]; // Example values

  const SERIALIZED_MEASUREMENT_IDS = JSON.stringify(
    MEASUREMENT_IDS
  ); // Serialize to help the host batch gtag() calls under 20/second

  /**
   * Posts an ASC Event to the parent window.
   * @param {string} eventName - ASC Event name (for example,
   *   "asc_form_submission").
   * @param {object} eventModel - Event parameters required by the ASC Event/GA4
   *   integration.
   */
  function normalizeSendTo(sendToValue) {
    if (Array.isArray(sendToValue)) {
      return sendToValue;
    }

    if (typeof sendToValue === "string") {
      try {
        const parsed = JSON.parse(sendToValue);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        // Ignore JSON.parse errors and fall through to return the string value.
      }

      return sendToValue;
    }

    return undefined;
  }

  function sendAscEvent(eventName, eventModel) {
    const providedSendTo = eventModel && eventModel.send_to;
    const payload = {
      event: eventName,
      eventModel: {
        ...eventModel,
        // Include measurement IDs unless the caller already provided them.
        send_to:
          providedSendTo !== undefined
            ? providedSendTo
            : SERIALIZED_MEASUREMENT_IDS
      }
    };

    const isInIframe = window.parent && window.parent !== window;

    if (isInIframe) {
      window.parent.postMessage(JSON.stringify(payload), HOST_PAGE_ORIGIN);
      // If you cannot maintain a host-origin list, coordinate with the dealer to
      // use the shared-key variant and post with "*" instead.
      return;
    }

    const directEventModel = {
      ...eventModel,
      send_to:
        providedSendTo !== undefined
          ? normalizeSendTo(providedSendTo)
          : MEASUREMENT_IDS
    };

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, directEventModel);
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: `dl_${eventName}`,
      eventModel: directEventModel
    });

    window.asc_datalayer = window.asc_datalayer || [];
    window.asc_datalayer.push({
      event: eventName,
      ...directEventModel
    });
  }

  // Example usage: dispatch when a form submission completes inside the iframe.
  sendAscEvent("asc_form_submission", {
    page_type: "service"
    // ...otherAscEventDimensions
  });
})();
