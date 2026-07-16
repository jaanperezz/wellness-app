import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:janperezgonzalez@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Franjas de comida — mismos slots e índices que MEAL_SLOTS de public/index.html (Extra no notifica).
const MEALS = [
  { icon: '🌅', name: 'Desayuno', window: '7:00 – 9:00',   suggestion: 'Avena proteica · Tostadas aguacate · Yogur griego bowl' },
  { icon: '🍽️', name: 'Comida',   window: '13:00 – 15:00', suggestion: 'Pollo + arroz · Salmón + boniato · Atún + pasta' },
  { icon: '🥗', name: 'Merienda', window: '17:00 – 18:30', suggestion: 'Batido proteína · Yogur + frutos secos · Pan + pavo' },
  { icon: '🌙', name: 'Cena',     window: '20:00 – 21:30', suggestion: 'Salmón + verduras · Tortilla + ensalada · Pechuga + quinoa' },
];

export default async function handler(req, res) {
  if (!process.env.STRETCH_CRON_SECRET || req.query.key !== process.env.STRETCH_CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const subscription = process.env.PUSH_SUBSCRIPTION;
  if (!subscription) return res.status(200).json({ ok: false, reason: 'no subscription' });

  const { type } = req.query;
  const slot = Number(req.query.slot);
  let payload = null;

  if (type === 'repesca') {
    // El SW compone el cuerpo real con el estado local (IndexedDB) — espalda siempre primero.
    payload = { type: 'repesca', title: '📋 Repaso del día', body: 'Abre la app para ver lo pendiente.', tag: 'repesca', url: '/' };
  } else if (type === 'meal_open' && MEALS[slot]) {
    const m = MEALS[slot];
    payload = { type: 'meal_open', slot, title: `${m.icon} ${m.name} — franja abierta`, body: `${m.window}\nIdeas: ${m.suggestion}`, tag: 'meal-' + slot, url: '/?meal=' + slot };
  } else if (type === 'meal_check' && MEALS[slot]) {
    // El SW decide: si el slot ya está registrado muestra refuerzo positivo, si no este aviso.
    const m = MEALS[slot];
    payload = { type: 'meal_check', slot, title: `${m.icon} ${m.name} — la franja cierra pronto`, body: 'Quedan ~30 min y no hay nada registrado. Foto o registro rápido.', tag: 'meal-' + slot, url: '/?meal=' + slot };
  } else {
    return res.status(400).json({ ok: false, error: 'bad type' });
  }

  try {
    await webpush.sendNotification(JSON.parse(subscription), JSON.stringify(payload));
    return res.status(200).json({ ok: true, type, slot: Number.isNaN(slot) ? undefined : slot });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
