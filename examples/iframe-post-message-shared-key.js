/*
 * Automotive Standards Council Event (ASC Event) iframe example (shared-key
 * validation).
 *
 * Copy this script into your iframe-based plugin when the host page validates
 * incoming messages using a shared secret. Update INTERNAL_KEY and
 * MEASUREMENT_IDS to match your implementation.
 */
(function () {
  "use strict";

  // Shared secret that both the iframe and host page agree on.
  const INTERNAL_KEY = "123abc"; // Example value

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
  function sendAscEvent(eventName, eventModel) {
    const payload = {
      event: eventName,
      internalKey: INTERNAL_KEY,
      eventModel: {
        ...eventModel,
        // Include measurement IDs unless the caller already provided them.
        send_to:
          eventModel && eventModel.send_to
            ? eventModel.send_to
            : SERIALIZED_MEASUREMENT_IDS
      }
    };

    window.parent.postMessage(JSON.stringify(payload), "*"); // Shared key gates access
  }

  // Example usage: dispatch when a form submission completes inside the iframe.
  sendAscEvent("asc_form_submission", {
    page_type: "service"
    // ...otherAscEventDimensions
  });
})();
