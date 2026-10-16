// Counts a reader's action through Umami when its script is on the page (lib/analytics.mjs). Each event carries only a
// fixed label from the site's own data, never anything typed and never a chosen value; the privacy page lists them.
// Every caller follows a click, long after the deferred tracker has run, so there is no waiting queue.
const EVENTS = new Set(['evidence-map-opened', 'corpus-switched', 'trial-record-opened', 'shift-explored']);

export function track(event, data) {
  if (!EVENTS.has(event)) return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Counting must never break reading.
  }
}
