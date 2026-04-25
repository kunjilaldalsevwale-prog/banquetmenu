export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const KEY = 'foodhouse_menus';
  const empty = { restaurant:{categories:[]}, banquet:{categories:[]}, chaat:{categories:[]} };

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured', vars: Object.keys(process.env).filter(k=>k.includes('UPSTASH')) });
  }

  const redisReq = async (cmd) => {
    const r = await fetch(`${REDIS_URL}/${cmd}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    return r.json();
  };

  // GET — load menu from Redis
  if (req.method === 'GET') {
    try {
      const data = await redisReq(`get/${KEY}`);
      if (data.result) {
        return res.status(200).json(JSON.parse(data.result));
      }
      return res.status(200).json(empty);
    } catch(e) {
      return res.status(200).json({ ...empty, _error: e.message });
    }
  }

  // POST — save menu to Redis
  if (req.method === 'POST') {
    try {
      const { menus } = req.body;
      if (!menus) return res.status(400).json({ error: 'No data' });

      const encoded = encodeURIComponent(JSON.stringify(menus));
      const data = await redisReq(`set/${KEY}/${encoded}`);

      if (data.result === 'OK') {
        return res.status(200).json({ success: true });
      }
      return res.status(500).json({ error: 'Redis set failed', data });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
