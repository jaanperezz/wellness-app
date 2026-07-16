// Estado del "modo trabajo" — guardado como env var de Vercel usada como KV:
// se LEE y ESCRIBE via API en caliente (nunca via process.env), así los cambios
// valen al instante sin redeploy.
const KEY = 'WORK_MODE';

function api(H) {
  const PROJECT = process.env.VERCEL_PROJECT_ID;
  return {
    async read() {
      const list = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env`, { headers: H }).then(r => r.json());
      const e = (list.envs || []).find(x => x.key === KEY);
      if (!e) return { state: null, id: null };
      try { return { state: JSON.parse(e.value), id: e.id }; } catch { return { state: null, id: e.id }; }
    },
    async write(state, oldId) {
      if (oldId) await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env/${oldId}`, { method: 'DELETE', headers: H });
      await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env`, {
        method: 'POST', headers: H,
        body: JSON.stringify({ key: KEY, value: JSON.stringify(state), type: 'plain', target: ['production'] })
      });
    }
  };
}

export default async function handler(req, res) {
  const TOKEN = process.env.VERCEL_TOKEN;
  if (!TOKEN || !process.env.VERCEL_PROJECT_ID) return res.status(500).json({ error: 'missing VERCEL_TOKEN / VERCEL_PROJECT_ID' });
  const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  const kv = api(H);

  try {
    if (req.method === 'GET') {
      const { state } = await kv.read();
      return res.status(200).json({ ok: true, state: state || { on: false } });
    }
    if (req.method !== 'POST') return res.status(405).end();

    const { action } = req.body || {};
    const now = Date.now();
    const { state: prev, id } = await kv.read();
    let next;
    if (action === 'on') next = { on: true, since: now, lastBreak: now, lastPush: 0 };
    else if (action === 'off') next = { on: false, since: 0, lastBreak: 0, lastPush: 0 };
    else if (action === 'break-done') next = { ...(prev || { on: false }), lastBreak: now };
    else return res.status(400).json({ error: 'bad action' });

    await kv.write(next, id);
    return res.status(200).json({ ok: true, state: next });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
