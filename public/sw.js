const CACHE = 'wellness-v7';
const ASSETS = ['/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Estado compartido app → SW (IndexedDB 'wellness-sw' / store 'kv') ──────
// La app escribe el snapshot 'state' en cada updateHome(); el SW lo lee para
// componer repescas y avisos de comida con lo que DE VERDAD falta.
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('wellness-sw', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const t = db.transaction('kv').objectStore('kv').get(key);
    t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
  })).catch(() => null);
}
function idbSet(key, val) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const t = db.transaction('kv', 'readwrite').objectStore('kv').put(val, key);
    t.onsuccess = () => res(); t.onerror = () => rej(t.error);
  })).catch(() => {});
}

// Nombres de RUTINA (public/index.html) — espalda SIEMPRE primero en repescas.
const LUMBAR_IDS = [14, 15, 16, 0, 1, 2];
const EX_NAMES = { 0: 'Cat-Cow', 1: "Child's Pose", 2: 'Bird Dog', 3: 'Chin Tuck', 14: 'Hip Flexor Stretch', 15: 'Glute Bridge', 16: 'Pelvic Tilt en pared' };
const MEAL_NAMES = ['Desayuno', 'Comida', 'Merienda', 'Cena'];
// Ventanas de comida en minutos Madrid [inicio, fin) — mismos MEAL_SLOTS de la app.
const MEAL_WINDOWS = [[420, 540], [780, 900], [1020, 1110], [1200, 1290]];
const BREAK_START = 9, BREAK_END = 21;

function nowMadridMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const [h, m] = parts.split(':').map(Number);
  return h * 60 + m;
}
function madridDateString() {
  // Mismo formato que toDateString() de la app pero anclado a Madrid.
  return new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' }).format(new Date()) + ' 12:00:00').toDateString();
}

async function composeRepesca() {
  const st = await idbGet('state');
  if (!st || st.date !== madridDateString()) {
    return { title: '📋 Repaso del día', body: 'Abre la app para sincronizar tu estado de hoy.' };
  }
  const parts = [];
  // 1º ESPALDA — ejercicios lumbares del día sin hacer
  const pendLumbar = LUMBAR_IDS.filter(id => !st.exDone || !st.exDone[id]).map(id => EX_NAMES[id]);
  if (pendLumbar.length) parts.push('🎯 Espalda: ' + pendLumbar.slice(0, 3).join(' · ') + (pendLumbar.length > 3 ? ` (+${pendLumbar.length - 3})` : ''));
  // 2º comidas con franja ya cerrada y sin registrar
  const now = nowMadridMinutes();
  const missedMeals = MEAL_NAMES.filter((_, i) => now >= MEAL_WINDOWS[i][1] && !(st.meals && st.meals[i]));
  if (missedMeals.length) parts.push('🍽️ Sin registrar: ' + missedMeals.join(', '));
  // 3º refuerzo: pausas de trabajo hechas hoy
  const done = (st.breaksList || []).length;
  if (done > 0) parts.push(`🧘 ${done} pausa${done > 1 ? 's' : ''} activa${done > 1 ? 's' : ''} hecha${done > 1 ? 's' : ''} hoy`);

  if (!pendLumbar.length && !missedMeals.length) return { title: '✅ Al día', body: 'Espalda y comidas cubiertas' + (done ? ` · ${done} pausas hechas` : '') + '. Sigue así.' };
  return { title: '📋 Te queda hoy', body: parts.join('\n') };
}

async function composeMealCheck(data) {
  const st = await idbGet('state');
  const slot = data.slot;
  if (st && st.date === madridDateString() && st.meals && st.meals[slot]) {
    return { title: `✓ ${MEAL_NAMES[slot]} registrado`, body: 'Franja cubierta — nada pendiente aquí.', silentish: true };
  }
  return { title: data.title, body: data.body };
}

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil((async () => {
    let n = { title: data.title || 'Wellness', body: data.body || '' };
    if (data.type === 'repesca') n = await composeRepesca();
    else if (data.type === 'meal_check') n = await composeMealCheck(data);

    const opts = {
      body: n.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: n.silentish ? undefined : [200, 100, 200],
      silent: !!n.silentish,
      tag: data.tag || 'wellness',
      renotify: !n.silentish,
      data: { url: data.url || '/', type: data.type || null }
    };
    // Acción rápida en la pausa activa (Android/desktop; iOS la ignora y abre la app)
    if (data.tag === 'stretch-break') {
      opts.actions = [{ action: 'break-done', title: '✅ Pausa hecha' }];
      opts.requireInteraction = true;
    }
    return self.registration.showNotification(n.title, opts);
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();

  // "✅ Hecha" en la notificación de pausa → registrar sin abrir la app
  // y resetear la cadencia de 30 min en el servidor.
  if (e.action === 'break-done') {
    e.waitUntil((async () => {
      const now = new Date();
      const slot = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 30); // mismo índice que el servidor y la app
      const rec = (await idbGet('sw-breaks')) || {};
      const day = madridDateString();
      if (rec.date !== day) { rec.date = day; rec.slots = []; }
      if (!rec.slots.includes(slot)) rec.slots.push(slot);
      await idbSet('sw-breaks', rec);
      try {
        await fetch('/api/work-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'break-done' }) });
      } catch (err) {}
    })());
    return;
  }

  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(cs => {
      const existing = cs.find(c => 'focus' in c);
      if (existing) { existing.navigate(url); return existing.focus(); }
      return clients.openWindow(url);
    })
  );
});
