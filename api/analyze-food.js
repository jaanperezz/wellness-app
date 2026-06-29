export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: 'no image' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'no_api_key' });

  const prompt = `Analiza esta imagen. Puede ser una ETIQUETA NUTRICIONAL o un PLATO DE COMIDA.

CASO A — ETIQUETA NUTRICIONAL (tabla con Energía/Calorías, Proteínas, Hidratos de carbono, Grasas):
- Lee los valores EXACTAMENTE de la tabla. NO estimes ni inventes ningún valor.
- Usa la columna "por porción" si existe; si no, usa "por 100g".
- El nombre del alimento es el nombre del producto visible en el envase.
- El campo "amount" indica la porción usada (ej: "30g", "100g", "1 unidad 35g").

CASO B — PLATO DE COMIDA (foto de un plato o alimento sin etiqueta nutricional):
- Identifica todos los alimentos visibles y estima porciones realistas en gramos.
- Usa nombres en español.

Devuelve ÚNICAMENTE JSON válido con este formato exacto, sin texto adicional:
{"foods":[{"name":"nombre","amount":"ej: 100g","kcal":250,"protein_g":20,"carbs_g":30,"fat_g":8}],"total":{"kcal":250,"protein_g":20,"carbs_g":30,"fat_g":8},"confidence":"high"}

Si no puedes identificar comida ni etiqueta nutricional, devuelve {"error":"no_food"}.`;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${image}` } },
          { type: 'text', text: prompt }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  if (!r.ok) {
    const err = await r.text();
    if (r.status === 429) return res.status(429).json({ error: 'quota_exceeded' });
    return res.status(500).json({ error: 'api_error', detail: err.slice(0, 300) });
  }

  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return res.status(500).json({ error: 'parse_error', raw: text.slice(0, 200) });

  try {
    return res.status(200).json(JSON.parse(match[0]));
  } catch {
    return res.status(500).json({ error: 'parse_error', raw: text.slice(0, 200) });
  }
}
