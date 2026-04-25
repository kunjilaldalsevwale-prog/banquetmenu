export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, image, mediaType } = req.body;
    const imageList = images || [{ base64: image, mediaType: mediaType || 'image/jpeg' }];
    if (!imageList || imageList.length === 0) return res.status(400).json({ error: 'No image provided' });

    const content = imageList.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
    }));

    const sideText = imageList.length > 1
      ? `There are ${imageList.length} images showing different sides of the same menu. Combine ALL items from ALL images.`
      : 'There is 1 menu image.';

    content.push({
      type: 'text',
      text: `You are a menu scanner. ${sideText}

STRICT RULES - VERY IMPORTANT:
1. ONLY extract items that are CLEARLY VISIBLE and READABLE in the image
2. Do NOT guess, invent, or add any items not explicitly shown
3. Do NOT add items from memory or training data
4. If you cannot clearly read an item name or price, SKIP it
5. ONLY include what you can actually see written in the menu image

Return ONLY this JSON format, no other text:
{"categories":[{"id":"c1","name":"Category Name","items":[{"id":"i1","name":"Exact Item Name As Written","price":100,"type":"veg","desc":""}]}]}

More rules:
- type: "veg" or "nonveg" only
- price: exact number as shown (0 if not visible)
- Keep desc empty unless clearly written
- Use short ids: c1,c2,i1,i2 etc
- Group items exactly as shown in the menu under their headings`
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    // Fix truncated JSON if needed
    if (data.content && data.content[0]) {
      const text = data.content[0].text;
      let jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        try {
          JSON.parse(jsonStr);
        } catch(e) {
          jsonStr = jsonStr.replace(/,\s*$/, '');
          let opens = (jsonStr.match(/\[/g)||[]).length - (jsonStr.match(/\]/g)||[]).length;
          let openBraces = (jsonStr.match(/\{/g)||[]).length - (jsonStr.match(/\}/g)||[]).length;
          for(let i=0; i<opens; i++) jsonStr += ']';
          for(let i=0; i<openBraces; i++) jsonStr += '}';
        }
        data.content[0].text = jsonStr;
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
