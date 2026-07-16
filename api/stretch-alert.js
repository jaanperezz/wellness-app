import webpush from 'web-push';
import { blobGet, blobSet, getSubscription, WORK_PATH } from './_blob.js';

webpush.setVapidDetails(
  'mailto:janperezgonzalez@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Ejercicios reales de la sección "Lumbar & Postura — Prioridad" de public/index.html.
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

export default async function handler(req, res) {
  if (!process.env.STRETCH_CRON_SECRET || req.query.key !== process.env.STRETCH_CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  try {
    const subscription = await getSubscription();
    if (!subscription) return res.status(200).json({ ok: false, reason: 'no subscription' });

    // El VPS pinguea cada 5 min — este endpoint decide según el modo trabajo de Jan.
    const state = await blobGet(WORK_PATH);
    if (!state || !state.on) return res.status(200).json({ ok: true, skip: 'work_mode_off' });

    const now = Date.now();
    if (hourMadrid() >= AUTO_OFF_HOUR) {
      await blobSet(WORK_PATH, { on: false, since: 0, lastBreak: 0, lastPush: 0, updatedAt: now });
      return res.status(200).json({ ok: true, autoOff: true });
    }

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

    await webpush.sendNotification(subscription, JSON.stringify(msg));
    await blobSet(WORK_PATH, { ...state, lastPush: now });
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
