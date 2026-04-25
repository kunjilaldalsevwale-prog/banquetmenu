export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const empty = { restaurant:{categories:[]}, banquet:{categories:[]}, chaat:{categories:[]} };
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (req.method === 'GET') {
    try {
      // List blobs
      const r = await fetch('https://blob.vercel-storage.com', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const list = await r.json();
      // Find our menu file
      const found = list.blobs?.find(b => b.pathname === 'foodhouse-menus.json');
      if (found) {
        const data = await fetch(found.url);
        return res.status(200).json(await data.json());
      }
      return res.status(200).json(empty);
    } catch(e) {
      return res.status(200).json({ ...empty, _debug: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { menus } = req.body;
      if (!menus) return res.status(400).json({ error: 'No data' });

      const content = JSON.stringify(menus);
      
      // PUT to Vercel Blob
      const r = await fetch('https://blob.vercel-storage.com/foodhouse-menus.json', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-add-random-suffix': '0',
          'x-content-type': 'application/json'
        },
        body: content
      });

      const result = await r.json();
      
      if (!r.ok) {
        // Debug: return full error details
        return res.status(500).json({ 
          error: result,
          token_prefix: token ? token.substring(0, 20) + '...' : 'NOT SET',
          status: r.status
        });
      }

      return res.status(200).json({ success: true, url: result.url });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
