import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:janperezgonzalez@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Ejercicios reales de la sección "Lumbar & Postura — Prioridad" de public/index.html
// (ids r0, r1, r2, r14, r15, r16 — mismas imágenes y series que ya usa la app).
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

export default async function handler(req, res) {
  if (!process.env.STRETCH_CRON_SECRET || req.query.key !== process.env.STRETCH_CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const subscription = process.env.PUSH_SUBSCRIPTION;
  if (!subscription) return res.status(200).json({ ok: false, reason: 'no subscription' });

  // Índice determinista por franja de 30 min transcurrida hoy — rota sin guardar estado.
  const now = new Date();
  const slot = Math.floor((now.getUTCHours() * 60 + now.getUTCMinutes()) / 30);
  const lumbar = LUMBAR[slot % LUMBAR.length];
  const a = ROTATE[slot % ROTATE.length];
  const b = ROTATE[(slot + 1) % ROTATE.length];

  const msg = {
    title: '🧘 Pausa activa — 90 seg',
    body: `1. ${lumbar.name} (${lumbar.cue})\n2. ${a.name} (${a.cue})\n3. ${b.name} (${b.cue})`,
    tag: 'stretch-break',
    url: `/?ex=${lumbar.id}`,
  };

  try {
    await webpush.sendNotification(JSON.parse(subscription), JSON.stringify(msg));
    return res.status(200).json({ ok: true, sent: msg.body });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
