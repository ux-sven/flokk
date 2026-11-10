// Flokk service worker: viser push-varsler og åpner riktig side ved trykk.
// Ingen offline-cache foreløpig.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Flokk";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    lang: "nb",
    // Samme tag erstatter forrige varsel for samme tråd (chat, stemmer)
    tag: data.tag,
    renotify: Boolean(data.tag),
    timestamp: data.timestamp || Date.now(),
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Ikontall på hjemskjermen der det støttes
      typeof data.unread === "number" && "setAppBadge" in self.navigator
        ? data.unread > 0
          ? self.navigator.setAppBadge(data.unread)
          : self.navigator.clearAppBadge()
        : Promise.resolve(),
    ]).catch(() => {}),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((c) => ("navigate" in c ? c.navigate(target) : c));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
