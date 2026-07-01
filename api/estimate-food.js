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
      messages: [{ role: 'user', content: `Eres nutricionista. Estima los macros de este alimento descrito en lenguaje natural: "${text}"

Reglas para interpretar la cantidad:
- Si se especifican gramos o mililitros explícitos, úsalos directamente.
- Si se usan fracciones o cantidades de unidad ("medio", "media", "un tercio", "entero", "2 unidades", "3 trozos", "una loncha", "un filete", "una rodaja"), aplica el peso de referencia típico de ESE alimento concreto y ajusta proporcionalmente. Ejemplos de referencia (ajusta según el alimento real, esto es solo guía de magnitud): aguacate mediano ≈200g, pechuga de pollo mediana ≈150g, plátano mediano ≈120g, manzana mediana ≈180g, huevo ≈50g, rebanada de pan ≈30g, loncha de queso o fiambre ≈20g.
- Si se usan medidas caseras españolas, conviértelas: 1 vaso de cocina ≈250ml, 1 taza ≈240ml, 1 cucharada ≈15g/ml, 1 cucharadita ≈5g/ml, 1 puñado ≈30g.
- Si no se especifica cantidad, asume una porción individual razonable para ese alimento.

Devuelve ÚNICAMENTE JSON válido sin texto extra: {"name":"nombre del alimento","amount":"porción con el peso asumido, ej: 'medio aguacate (~100g)'","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}` }],
      temperature: 0.1, max_tokens: 300
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
