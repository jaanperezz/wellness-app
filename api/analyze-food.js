export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: 'no image' });

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: image }
          },
          {
            type: 'text',
            text: `Eres un nutricionista analizando una foto de comida. Identifica todos los alimentos visibles y estima su contenido nutricional con porciones realistas.
Devuelve ÚNICAMENTE JSON válido con este formato exacto:
{"foods":[{"name":"nombre del alimento","amount":"ej: 150g","kcal":300,"protein_g":25,"carbs_g":30,"fat_g":8}],"total":{"kcal":300,"protein_g":25,"carbs_g":30,"fat_g":8},"confidence":"high"}
Usa nombres de alimentos en español. Sé conservador y realista con las porciones. Si no puedes identificar comida en la imagen, devuelve {"error":"no_food"}.`
          }
        ]
      }]
    })
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: 'api_error', detail: err });
  }

  const data = await r.json();
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return res.status(500).json({ error: 'parse_error' });

  try {
    const result = JSON.parse(match[0]);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: 'parse_error', raw: text });
  }
}
