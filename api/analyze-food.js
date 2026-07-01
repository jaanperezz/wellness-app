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
- Identifica TODOS los alimentos visibles. Cada alimento distinto va en una entrada SEPARADA del array "foods" — nunca combines dos alimentos distintos (ej: "arroz" y "frijoles") en una sola entrada, aunque estén en el mismo plato o mezclados.
- Estima la porción en gramos usando referencias visuales de tamaño real, comparando el alimento con objetos de tamaño conocido en la imagen (mano, plato, cubiertos) y con estas referencias estándar:
  · 1 puño cerrado ≈ 150-200g (arroz, pasta, verduras cocidas, ensalada)
  · 1 palma de mano (sin dedos) ≈ 100g (carne, pescado, tofu)
  · 1 baraja de cartas ≈ 85-100g (carne o pescado en filete)
  · 1 mano ahuecada ≈ 30g (frutos secos, snacks, queso rallado)
  · 1 pulgar ≈ 1 cucharada ≈ 15g (aceite, mantequilla, salsas, mermelada)
  · 1 huevo mediano ≈ 50g
- No redondees a valores por defecto genéricos (ej. 100g o 250 kcal) salvo que la estimación visual realmente lo justifique. Ajusta cada valor al tamaño real observado.
- Usa nombres en español, específicos (ej: "pechuga de pollo a la plancha" en vez de "pollo").

Devuelve ÚNICAMENTE JSON válido con este formato exacto, sin texto adicional ni comentarios:
{"foods":[{"name":"nombre","amount":"ej: 100g","kcal":250,"protein_g":20,"carbs_g":30,"fat_g":8}],"total":{"kcal":250,"protein_g":20,"carbs_g":30,"fat_g":8},"confidence":"high"}

Si no puedes identificar comida ni etiqueta nutricional, devuelve {"error":"no_food"}.`;

  async function callGroq(extraInstruction) {
    const finalPrompt = extraInstruction ? `${prompt}\n\n${extraInstruction}` : prompt;
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
            { type: 'text', text: finalPrompt }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' }
      })
    });
    return r;
  }

  let r = await callGroq();

  if (!r.ok) {
    const err = await r.text();
    if (r.status === 429) return res.status(429).json({ error: 'quota_exceeded' });
    return res.status(500).json({ error: 'api_error', detail: err.slice(0, 300) });
  }

  let data = await r.json();
  let text = data.choices?.[0]?.message?.content || '';
  let match = text.match(/\{[\s\S]*\}/);

  let parsed = null;
  if (match) {
    try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
  }

  // One-shot automatic retry if parsing failed
  if (!parsed) {
    r = await callGroq('IMPORTANTE: tu respuesta anterior no era JSON válido. Devuelve EXCLUSIVAMENTE el objeto JSON, sin explicaciones, sin markdown, sin backticks.');
    if (r.ok) {
      data = await r.json();
      text = data.choices?.[0]?.message?.content || '';
      match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }
  }

  if (!parsed) return res.status(500).json({ error: 'parse_error', raw: text.slice(0, 200) });
  return res.status(200).json(parsed);
}
