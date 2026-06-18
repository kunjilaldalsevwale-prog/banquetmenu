export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images } = req.body;
    if (!images || images.length === 0) return res.status(400).json({ error: 'No image provided' });

    const content = images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 }
    }));

    content.push({
      type: 'text',
     text: `Extract all menu items from this image. Return ONLY valid JSON with no markdown, no backticks, no explanation:
{"categories":[{"id":"c1","name":"Category Name","items":[{"id":"i1","name":"Item Name","price":100,"type":"veg","desc":""}]}],"theme":{"primary":"#8B1A1A","accent":"#B8953F","bg":"#FBF5E6","font":"serif"}}
Rules: type=veg or nonveg only, price=number(0 if unclear), desc=empty unless written on menu, ids=c1/i1 format, theme=extract dominant colors from the menu design (primary=main header color, accent=highlight color, bg=background color, font=serif/sans/decorative based on typography)`
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    if (data.content && data.content[0]) {
      let text = data.content[0].text;
      // Strip markdown code blocks
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      // Repair truncated JSON
      const start = text.indexOf('{');
      if (start >= 0) {
        let j = text.substring(start);
        j = j.replace(/,\s*$/, '');
        const opens  = (j.match(/\[/g)||[]).length - (j.match(/\]/g)||[]).length;
        const braces = (j.match(/\{/g)||[]).length - (j.match(/\}/g)||[]).length;
        for (let i = 0; i < opens; i++)  j += ']';
        for (let i = 0; i < braces; i++) j += '}';
        data.content[0].text = j;
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
