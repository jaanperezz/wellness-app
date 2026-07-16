// Estado real de la suscripción push — leído en caliente via API de Vercel
// (process.env quedaría congelado al deploy). No expone valores, solo si existe.
export default async function handler(req, res) {
  const TOKEN = process.env.VERCEL_TOKEN;
  const PROJECT = process.env.VERCEL_PROJECT_ID;
  if (!TOKEN || !PROJECT) return res.status(500).json({ error: 'missing config' });
  try {
    const list = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }).then(r => r.json());
    const sub = (list.envs || []).find(e => e.key === 'PUSH_SUBSCRIPTION');
    return res.status(200).json({ ok: true, subscribed: !!sub, updatedAt: sub ? sub.updatedAt : null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
