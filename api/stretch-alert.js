import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:janperezgonzalez@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Ejercicios reales de la sección "Lumbar & Postura — Prioridad" de public/index.html.
// Slot 1 siempre lumbar puro; slots 2-3 rotan para cubrir todo el bloque a lo largo del día.
const LUMBAR = [
  { id: 14, name: 'Hip Flexor Stretch', cue: '45s por lado × 3' },
  { id: 1, name: "Child's Pose", cue: '60s · descompresión lumbar' },
  { id: 16, name: 'Pelvic Tilt en pared', cue: '30s × 3' },
];
const ROTATE = [
  { id: 15, name: 'Glute Bridge', cue: '12 reps × 3' },
  { id: 0, name: 'Cat-Cow', cue: '10 reps × 3' },
  { id: 2, name: 'Bird Dog', cue: '8 reps por lado × 3' },
];

const BREAK_MS = 30 * 60 * 1000;      // cadencia: 30 min desde la última pausa hecha
const REPUSH_MS = 25 * 60 * 1000;     // no re-avisar antes de 25 min del último aviso
const AUTO_OFF_HOUR = 22;             // apagado automático del modo trabajo (hora Madrid)

function hourMadrid() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()));
}

// WORK_MODE como KV en env vars de Vercel — leído/escrito en caliente via API
// (process.env quedaría congelado al deploy). Mismo mecanismo que api/work-mode.js.
function kv(H) {
  const PROJECT = process.env.VERCEL_PROJECT_ID;
  return {
    async read() {
      const list = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env`, { headers: H }).then(r => r.json());
      const e = (list.envs || []).find(x => x.key === 'WORK_MODE');
      if (!e) return { state: null, id: null };
      try { return { state: JSON.parse(e.value), id: e.id }; } catch { return { state: null, id: e.id }; }
    },
    async write(state, oldId) {
      if (oldId) await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env/${oldId}`, { method: 'DELETE', headers: H });
      await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ key: 'WORK_MODE', value: JSON.stringify(state), type: 'plain', target: ['production'] })
      });
    }
  };
}

export default async function handler(req, res) {
  if (!process.env.STRETCH_CRON_SECRET || req.query.key !== process.env.STRETCH_CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const subscription = process.env.PUSH_SUBSCRIPTION;
  if (!subscription) return res.status(200).json({ ok: false, reason: 'no subscription' });

  const H = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
  const store = kv(H);
  const { state, id } = await store.read();

  // El VPS pinguea cada 5 min — este endpoint decide según el modo trabajo de Jan.
  if (!state || !state.on) return res.status(200).json({ ok: true, skip: 'work_mode_off' });

  if (hourMadrid() >= AUTO_OFF_HOUR) {
    await store.write({ on: false, since: 0, lastBreak: 0, lastPush: 0 }, id);
    return res.status(200).json({ ok: true, autoOff: true });
  }

  const now = Date.now();
  const sinceBreak = now - (state.lastBreak || state.since || 0);
  const sincePush = now - (state.lastPush || 0);
  if (sinceBreak < BREAK_MS || sincePush < REPUSH_MS) {
    return res.status(200).json({ ok: true, wait: Math.max(0, Math.ceil((BREAK_MS - sinceBreak) / 60000)) });
  }

  // Toca pausa — mismo trío determinista que muestra la app.
  const slot = Math.floor((new Date().getUTCHours() * 60 + new Date().getUTCMinutes()) / 30);
  const lumbar = LUMBAR[slot % LUMBAR.length];
  const a = ROTATE[slot % ROTATE.length];
  const b = ROTATE[(slot + 1) % ROTATE.length];

  const msg = {
    title: '🧘 Levántate — pausa activa',
    body: `Llevas 30 min sentado.\n1. ${lumbar.name} (${lumbar.cue})\n2. ${a.name} (${a.cue})\n3. ${b.name} (${b.cue})`,
    tag: 'stretch-break',
    url: '/?break=1',
  };

  try {
    await webpush.sendNotification(JSON.parse(subscription), JSON.stringify(msg));
    await store.write({ ...state, lastPush: now }, id);
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
