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
      text: `You are scanning a restaurant menu image for Food House, Aligarh, India. ${sideText}

YOUR JOB: Extract ONLY what is physically written/printed in this menu image.

IMPORTANT RULES:
1. Extract ONLY items you can actually see in the image - do not add any items from your training data
2. Use the EXACT names as written in the menu - do not rename or reword items
3. Use the EXACT prices shown - do not guess prices
4. If an item name is partially unclear, extract what you CAN read
5. If a price is unclear, set it to 0
6. Do NOT add popular dishes that are not visible in this image
7. Only create categories that actually appear as headings in the menu

Return ONLY this JSON, no explanation, no extra text:
{"categories":[{"id":"c1","name":"Category Name","items":[{"id":"i1","name":"Item Name","price":100,"type":"veg","desc":""}]}]}

Format rules:
- type: "veg" or "nonveg" only
- price: number only, 0 if not clearly visible
- desc: empty string unless description is clearly printed
- ids: short unique like c1,c2,i1,i2`
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
        max_tokens: 8000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

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
