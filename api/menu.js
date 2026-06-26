export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  const KEY = 'foodhouse_menus';

  const defaultMenuList = [
    {id:'restaurant', name:'Restaurant',  icon:'🍛'},
    {id:'banquet',    name:'Banquet Hall', icon:'🏛'},
    {id:'chaat',      name:'Chaat Adda',   icon:'🌶'}
  ];

  const empty = {
    menuList: defaultMenuList,
    menus: { restaurant:{categories:[]}, banquet:{categories:[]}, chaat:{categories:[]} }
  };

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  // ── GET ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${REDIS_URL}/get/${KEY}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      const data = await r.json();
      if (data.result) {
        const parsed = JSON.parse(data.result);
        // Handle old format (no menuList)
        if (!parsed.menuList && !parsed.menus) {
          return res.status(200).json({ menuList: defaultMenuList, menus: parsed });
        }
        if (!parsed.menuList) parsed.menuList = defaultMenuList;
        return res.status(200).json(parsed);
      }
      return res.status(200).json(empty);
    } catch(e) {
      return res.status(200).json({ ...empty, _error: e.message });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    try {
      const { menuList, menus } = req.body;
      if (!menus) return res.status(400).json({ error: 'No data' });

      // Strip base64 banner and customQR images before saving to Redis.
      // These are large (100KB+) and corrupt the payload, causing silent save failures.
      // They are stored in localStorage on the client side only.
      const cleanMenus = {};
      for (const [id, menu] of Object.entries(menus)) {
        cleanMenus[id] = {
          categories: menu.categories || [],
          theme: menu.theme || null
          // banner and customQR intentionally excluded — too large for Redis
        };
      }

      const payload = {
        menuList: menuList || defaultMenuList,
        menus: cleanMenus
      };

      const value = JSON.stringify(payload);

      const r = await fetch(`${REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([["SET", KEY, value]])
      });

      const result = await r.json();
      if (r.ok) return res.status(200).json({ success: true });
      return res.status(500).json({ error: result });

    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
