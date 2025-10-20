/*
 * Automotive Standards Council (ASC) iframe example.
 *
 * Copy this script into your iframe-based plugin to post ASC events to the
 * parent page. Update MEASUREMENT_IDS, INTERNAL_KEY, and the example
 * sendAscEvent call to match your implementation.
 */
(function () {
  "use strict";

  // Replace with the GA4 measurement IDs used by the iframe experience.
  const MEASUREMENT_IDS = ["G-123", "G-456"]; // Example values

  // Optional shared key so the host page can verify messages originated here.
  const INTERNAL_KEY = "123abc";

  const SERIALIZED_MEASUREMENT_IDS = JSON.stringify(MEASUREMENT_IDS);

  /**
   * Posts an ASC event to the parent window.
   * @param {string} eventName - ASC event name (for example, "asc_form_submission").
   * @param {object} eventModel - Event parameters required by ASC/GA4.
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

    window.parent.postMessage(JSON.stringify(payload), "*");
  }

  // Example usage: dispatch when a form submission completes inside the iframe.
  sendAscEvent("asc_form_submission", {
    page_type: "service"
    // ...other ASCDimensions
  });
})();
