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

    var asc = ensureAscDataLayer();
    asc.events.push(
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
