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
      ? `There are ${imageList.length} images showing different sides of the same menu. Combine ALL items.`
      : 'There is 1 menu image.';

    content.push({
      type: 'text',
      text: `Scan this restaurant menu for Food House, Aligarh, India. ${sideText}

Extract ALL categories and items. Return ONLY valid JSON:
{"categories":[{"id":"cat1","name":"Category Name","items":[{"id":"item1","name":"Item Name","price":100,"type":"veg","desc":""}]}]}

Rules:
- type: "veg" or "nonveg" only
- price: number only (0 if not shown)
- Extract every item grouped by category
- Price @75/- means 75
- Keep descriptions SHORT (max 5 words) or empty
- Use short unique ids: c1,c2,i1,i2 etc
- Do NOT add any text before or after the JSON`
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

    // Validate JSON before sending back
    if (data.content && data.content[0]) {
      const text = data.content[0].text;
      // Try to find and fix truncated JSON
      let jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        try {
          JSON.parse(jsonStr); // Test if valid
        } catch(e) {
          // Try to fix truncated JSON by closing open brackets
          let opens = (jsonStr.match(/\[/g)||[]).length - (jsonStr.match(/\]/g)||[]).length;
          let openBraces = (jsonStr.match(/\{/g)||[]).length - (jsonStr.match(/\}/g)||[]).length;
          // Remove trailing comma if any
          jsonStr = jsonStr.replace(/,\s*$/, '');
          // Close any open arrays and objects
          for(let i=0; i<opens; i++) jsonStr += ']';
          for(let i=0; i<openBraces; i++) jsonStr += '}';
        }
        // Return with fixed text
        data.content[0].text = jsonStr;
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
