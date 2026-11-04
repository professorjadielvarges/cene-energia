/* Inventário de Energia · CENE
   Guarda a página no próprio celular para ela abrir sem internet.
   O que é conversa com o servidor (POST para o Supabase) nunca passa por aqui:
   quem cuida disso é a fila de envio dentro da página. */

const VERSAO = 'cene-2026-11-04b';
const ESSENCIAIS = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSAO);
    try { await c.addAll(ESSENCIAIS); } catch (err) { /* uma falha não impede instalar */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k !== VERSAO).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // lançamentos passam direto
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.host.indexOf('supabase.co') > -1) return;       // dado nunca fica em cache aqui

  const fonte = url.host.indexOf('fonts.googleapis.com') > -1
             || url.host.indexOf('fonts.gstatic.com') > -1;

  if (fonte) {
    // fonte não muda: serve do cache e só baixa na primeira vez
    e.respondWith((async () => {
      const guardada = await caches.match(req);
      if (guardada) return guardada;
      try {
        const r = await fetch(req);
        if (r && (r.ok || r.type === 'opaque')) {
          const c = await caches.open(VERSAO);
          c.put(req, r.clone());
        }
        return r;
      } catch (err) {
        return new Response('', { status: 504, statusText: 'sem internet' });
      }
    })());
    return;
  }

  // a página: tenta a internet primeiro, para pegar atualização, e cai no cache se falhar
  e.respondWith((async () => {
    try {
      const r = await fetch(req);
      if (r && r.ok) {
        const c = await caches.open(VERSAO);
        c.put(req, r.clone());
      }
      return r;
    } catch (err) {
      const guardada = await caches.match(req);
      if (guardada) return guardada;
      const raiz = await caches.match('./index.html');
      if (raiz) return raiz;
      return new Response('Sem internet e a página ainda não foi guardada neste aparelho.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
