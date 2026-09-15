/**
 * Service Worker — StylerNow (02-UX/03_Client_PWA.md).
 *
 * Cachea SOLO el shell de la app (JS/CSS/fuentes/imágenes estáticas) para carga
 * instantánea en visitas posteriores. Nunca cachea datos transaccionales
 * (disponibilidad, estado de Reservas, respuestas de RPC/REST de Supabase) —
 * eso siempre va a red, y sin conexión se muestra "sin conexión" explícito en
 * vez de un dato potencialmente obsoleto sobre disponibilidad real.
 *
 * Estrategia: network-first para documentos HTML (para no servir una versión
 * vieja de una página que cambió), cache-first para assets con hash en el
 * nombre (_next/static, inmutables por definición de Next.js).
 */

const VERSION = "v1";
const CACHE_SHELL = `stylernow-shell-${VERSION}`;

// Nunca cachear estas rutas, aunque coincidan por método/origen: son siempre
// datos en vivo (auth, pagos, RPC de Supabase, webhooks propios).
const NUNCA_CACHEAR = [/\/api\//, /\/auth\//, /supabase\.co/];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_SHELL).then((cache) => cache.addAll(["/manifest.json"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== CACHE_SHELL).map((c) => caches.delete(c)))
      )
      .then(() => self.clients.claim())
  );
});

function esDatoTransaccional(url) {
  return NUNCA_CACHEAR.some((patron) => patron.test(url));
}

function esAssetInmutable(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || esDatoTransaccional(request.url)) return;

  // Assets con hash: cache-first, nunca cambian de contenido bajo el mismo nombre.
  if (esAssetInmutable(url)) {
    event.respondWith(
      caches.open(CACHE_SHELL).then(async (cache) => {
        const cacheado = await cache.match(request);
        if (cacheado) return cacheado;
        const respuesta = await fetch(request);
        if (respuesta.ok) cache.put(request, respuesta.clone());
        return respuesta;
      })
    );
    return;
  }

  // Documentos y el resto del shell: red primero, cache como respaldo offline.
  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_SHELL).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      })
      .catch(async () => {
        const cacheado = await caches.match(request);
        if (cacheado) return cacheado;
        if (request.mode === "navigate") {
          const offline = await caches.match("/");
          if (offline) return offline;
        }
        return new Response("Sin conexión", { status: 503, statusText: "Offline" });
      })
  );
});
