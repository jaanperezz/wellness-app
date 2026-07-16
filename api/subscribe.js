// Guarda la suscripción push en Vercel Blob — lectura en caliente por el resto
// de endpoints, así que NO hace falta redeploy (la versión antigua escribía una
// env var con un token de cuenta inválido y llevaba 18 días fallando en silencio).
import { blobSet, SUB_PATH } from './_blob.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid subscription' });

  try {
    await blobSet(SUB_PATH, subscription);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
