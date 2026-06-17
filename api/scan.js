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

    content.push({
      type: 'text',
      text: `Extract menu items from this image. Return ONLY valid JSON:
{"categories":[{"id":"c1","name":"Category","items":[{"id":"i1","name":"Item","price":100,"type":"veg","desc":""}]}],"theme":{"primary":"#8B1A1A","accent":"#B8953F","bg":"#FBF5E6","font":"serif"}}
Rules: type=veg/nonveg, price=number(0 if unclear), desc=empty unless written, ids=c1/i1 format, theme=dominant colors from menu design`
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.content && data.content[0]) {
      let text = data.content[0].text;
      let jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        try { JSON.parse(jsonStr); } catch(e) {
          jsonStr = jsonStr.replace(/,\s*$/, '');
          let opens = (jsonStr.match(/\[/g)||[]).length - (jsonStr.match(/\]/g)||[]).length;
          let braces = (jsonStr.match(/\{/g)||[]).length - (jsonStr.match(/\}/g)||[]).length;
          for(let i=0;i<opens;i++) jsonStr+=']';
          for(let i=0;i<braces;i++) jsonStr+='}';
        }
        data.content[0].text = jsonStr;
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Scan timed out. Try a clearer or smaller photo.' });
    }
    return res.status(500).json({ error: error.message });
  }
}
