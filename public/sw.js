/* Stage A foundation. No fetch interception, caches, push or notification handlers.
 * Outbound delivery and notification presentation require a separately reviewed Stage B. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
