import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:janperezgonzalez@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SCHEDULE = {
  8:  { title: '🌅 Buenos días, Jan', body: 'Empieza con Cat-Cow, Child\'s Pose y Dead Bug — 15 min.' },
  10: { title: '👅 Fascia oral', body: 'Palatal Sweep + Tongue Press. 3 series cada uno.' },
  16: { title: '💪 Chin Tuck', body: 'Segunda sesión del día — 10 reps × 2 series.' },
  20: { title: '😶 Asimetría facial', body: 'Tongue Press + Asimetría. 60 s por lado.' },
  22: { title: '💊 Suplementos nocturnos', body: 'Magnesio bisglicinato 300 mg antes de dormir.' }
};

export default async function handler(req, res) {
  const subscription = process.env.PUSH_SUBSCRIPTION;
  if (!subscription) return res.status(200).json({ ok: false, reason: 'no subscription' });

  const hourUTC = new Date().getUTCHours();
  const hourSpain = (hourUTC + 2) % 24;
  const msg = SCHEDULE[hourSpain];
  if (!msg) return res.status(200).json({ ok: false, reason: 'no message for this hour' });

  try {
    await webpush.sendNotification(JSON.parse(subscription), JSON.stringify(msg));
    return res.status(200).json({ ok: true, sent: msg.title });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
