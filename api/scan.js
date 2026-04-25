export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, image, mediaType } = req.body;

    // Support both single image and multiple images
    const imageList = images || [{ base64: image, mediaType: mediaType || 'image/jpeg' }];

    if (!imageList || imageList.length === 0) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Build content array - add all images + instruction
    const content = imageList.map(img => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType || 'image/jpeg',
        data: img.base64
      }
    }));

    // Add text instruction after all images
    const sideText = imageList.length > 1
      ? `There are ${imageList.length} images showing different sides/pages of the same menu. Combine ALL items from ALL images into one complete menu.`
      : 'There is 1 menu image.';

    content.push({
      type: 'text',
      text: `Scan this restaurant menu for Food House, Aligarh, India. ${sideText}

Extract ALL categories and items from ALL images. Return ONLY valid JSON with no other text:
{"categories":[{"id":"cat1","name":"Category Name","items":[{"id":"item1","name":"Item Name","price":100,"type":"veg","desc":"description if visible"}]}]}

Rules:
- type must be "veg" or "nonveg"
- price is a number (0 if not shown)
- Extract EVERY single item from ALL images
- Group items by their category headers
- Price format @75/- means 75
- Use unique ids like cat1, cat2, item1, item2
- Do NOT duplicate categories - merge items from both sides into correct categories
- Include Hindi category names if visible`
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
        max_tokens: 4000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
