const CACHE_NAME = 'share-target-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-comprobante') {
    event.respondWith(handleShareTarget(event));
  }
});

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get('file');
    const cache = await caches.open(CACHE_NAME);
    if (file && typeof file === 'object' && 'arrayBuffer' in file) {
      await cache.put('shared-file', new Response(file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }));
      await cache.put('shared-file-meta', new Response(JSON.stringify({ name: file.name || 'comprobante', type: file.type || 'application/octet-stream' }), { headers: { 'Content-Type': 'application/json' } }));
    }
  } catch (e) {
    // noop, la página cliente mostrará "no se encontró archivo"
  }
  return Response.redirect('/comprobantes/compartir?shared=1', 303);
}
