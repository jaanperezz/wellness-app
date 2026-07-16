// Estado del "modo trabajo" — persistido en Vercel Blob (lecturas/escrituras
// en caliente, sin redeploys, token acotado al store).
import { blobGet, blobSet, WORK_PATH } from './_blob.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const state = await blobGet(WORK_PATH);
      return res.status(200).json({ ok: true, state: state || { on: false, updatedAt: 0 } });
    }
    if (req.method !== 'POST') return res.status(405).end();

    const { action, state: clientState } = req.body || {};
    const now = Date.now();
    const prev = (await blobGet(WORK_PATH)) || { on: false };
    let next;
    if (action === 'on') next = { on: true, since: now, lastBreak: now, lastPush: 0, updatedAt: now };
    else if (action === 'off') next = { on: false, since: 0, lastBreak: 0, lastPush: 0, updatedAt: now };
    else if (action === 'break-done') next = { ...prev, lastBreak: now, updatedAt: now };
    else if (action === 'set' && clientState && typeof clientState.on === 'boolean') {
      // Autocuración: la app re-empuja su estado local si es más nuevo que el del servidor.
      if ((clientState.updatedAt || 0) <= (prev.updatedAt || 0)) {
        return res.status(200).json({ ok: true, state: prev, kept: 'server' });
      }
      next = { on: clientState.on, since: clientState.since || 0, lastBreak: clientState.lastBreak || 0, lastPush: prev.lastPush || 0, updatedAt: clientState.updatedAt };
    }
    else return res.status(400).json({ error: 'bad action' });

    await blobSet(WORK_PATH, next);
    return res.status(200).json({ ok: true, state: next });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
