self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldCaches = keys.filter((key) => key.startsWith("sanqvx-workspace-"));
      await Promise.all(oldCaches.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (oldCaches.length) {
        const clients = await self.clients.matchAll({type: "window", includeUncontrolled: true});
        await Promise.all(clients.map((client) => client.navigate(new URL("/login.html", client.url).href)));
      }
    }),
  );
});
