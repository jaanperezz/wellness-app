// Estado real de la suscripción push — mira el blob, no adivina.
import { blobMeta, SUB_PATH } from './_blob.js';

export default async function handler(req, res) {
  try {
    const b = await blobMeta(SUB_PATH);
    return res.status(200).json({ ok: true, subscribed: !!b, updatedAt: b ? b.uploadedAt : null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
