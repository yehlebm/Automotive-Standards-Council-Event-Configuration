/*
 * Shared ASC Event destination dispatcher.
 *
 * Provides a single helper that forwards ASC Events to gtag, Google Tag Manager's
 * dataLayer, and the ASC Event data layer. Load this script on any page where
 * ASC Events may fire directly (for example, when an iframe is used without an
 * embedding host) or where host pages listen for iframe messages. Keeping all
 * destination logic in one place guarantees matching behavior across both
 * scenarios.
 */
(function () {
  "use strict";

  /**
   * Forwards an ASC Event to gtag, GTM's dataLayer, and window.asc_datalayer.
   * @param {string} eventName
   * @param {object} [eventData]
   */
  function fire(eventName, eventData) {
    if (!eventName) return;

    var payload = eventData || {};

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, payload);
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "dl_" + eventName,
      eventModel: payload
    });

    window.asc_datalayer = window.asc_datalayer || [];
    window.asc_datalayer.push(
      Object.assign(
        {
          event: eventName
        },
        payload
      )
    );
  }

  window.ascEventDestinations = window.ascEventDestinations || {};
  window.ascEventDestinations.fire = fire;
})();
