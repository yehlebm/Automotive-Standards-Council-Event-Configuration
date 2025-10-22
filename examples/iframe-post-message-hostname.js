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
  function sendAscEvent(eventName, eventModel) {
    const payload = {
      event: eventName,
      eventModel: {
        ...eventModel,
        // Include measurement IDs unless the caller already provided them.
        send_to:
          eventModel && eventModel.send_to
            ? eventModel.send_to
            : SERIALIZED_MEASUREMENT_IDS
      }
    };

    window.parent.postMessage(JSON.stringify(payload), HOST_PAGE_ORIGIN);
    // If you cannot maintain a host-origin list, coordinate with the dealer to
    // use the shared-key variant and post with "*" instead.
  }

  // Example usage: dispatch when a form submission completes inside the iframe.
  sendAscEvent("asc_form_submission", {
    page_type: "service"
    // ...otherAscEventDimensions
  });
})();
