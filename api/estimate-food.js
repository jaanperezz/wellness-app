export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'no text' });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'no_api_key' });

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: `Eres nutricionista. Estima los macros de: "${text}". Devuelve ÚNICAMENTE JSON válido sin texto extra: {"name":"nombre","amount":"porción","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}` }],
      temperature: 0.1, max_tokens: 256
    })
  });
  if (!r.ok) return res.status(500).json({ error: 'api_error' });
  const data = await r.json();
  const txt = data.choices?.[0]?.message?.content || '';
  const match = txt.match(/\{[\s\S]*\}/);
  if (!match) return res.status(500).json({ error: 'parse_error' });
  try { return res.status(200).json(JSON.parse(match[0])); }
  catch { return res.status(500).json({ error: 'parse_error' }); }
}
