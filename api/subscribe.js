export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid subscription' });

  const TOKEN = process.env.VERCEL_TOKEN;
  const PROJECT = process.env.VERCEL_PROJECT_ID;
  if (!TOKEN || !PROJECT) return res.status(500).json({ error: 'missing VERCEL_TOKEN / VERCEL_PROJECT_ID' });
  const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  try {
    // 1. Upsert de PUSH_SUBSCRIPTION (la versión anterior hacía POST a ciegas:
    //    a la segunda suscripción chocaba con la existente y fallaba).
    const list = await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env`, { headers: H }).then(r => r.json());
    const old = (list.envs || []).find(e => e.key === 'PUSH_SUBSCRIPTION');
    if (old) {
      await fetch(`https://api.vercel.com/v9/projects/${PROJECT}/env/${old.id}`, { method: 'DELETE', headers: H });
    }
    const created = await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ key: 'PUSH_SUBSCRIPTION', value: JSON.stringify(subscription), type: 'plain', target: ['production'] })
    }).then(r => r.json());
    if (created.error) throw new Error('env: ' + created.error.message);

    // 2. Redeploy real del último deployment de producción — las funciones leen
    //    las env al arrancar el deployment; sin esto la suscripción no vive.
    const deps = await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT}&target=production&state=READY&limit=1`, { headers: H }).then(r => r.json());
    const src = deps.deployments?.[0];
    let redeployed = false;
    if (src) {
      const rd = await fetch('https://api.vercel.com/v13/deployments?forceNew=1', {
        method: 'POST', headers: H,
        body: JSON.stringify({ name: src.name, deploymentId: src.uid, target: 'production', meta: { action: 'redeploy' } })
      }).then(r => r.json());
      redeployed = !rd.error;
    }

    return res.status(200).json({ ok: true, redeployed });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
