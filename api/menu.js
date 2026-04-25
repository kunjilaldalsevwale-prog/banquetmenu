export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const empty = { restaurant:{categories:[]}, banquet:{categories:[]}, chaat:{categories:[]} };

  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not set', env: Object.keys(process.env).filter(k => k.includes('BLOB')) });
  }

  // GET
  if (req.method === 'GET') {
    try {
      // List all blobs
      const listRes = await fetch(`https://blob.vercel-storage.com?prefix=foodhouse`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      const blob = listData.blobs?.find(b => b.pathname === 'foodhouse-menus.json');

      if (blob) {
        const dataRes = await fetch(blob.url);
        const data = await dataRes.json();
        return res.status(200).json(data);
      }
      return res.status(200).json(empty);
    } catch(e) {
      return res.status(200).json({ ...empty, _error: e.message });
    }
  }

  // POST
  if (req.method === 'POST') {
    try {
      const { menus } = req.body;
      if (!menus) return res.status(400).json({ error: 'No menu data' });

      const putRes = await fetch(`https://blob.vercel-storage.com/foodhouse-menus.json`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-content-type': 'application/json',
          'x-add-random-suffix': '0'
        },
        body: JSON.stringify(menus)
      });

      const putData = await putRes.json();
      if (putRes.ok) return res.status(200).json({ success: true, url: putData.url });
      return res.status(500).json({ error: putData });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
