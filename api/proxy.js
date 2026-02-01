/**
 * Vercel Serverless API Route for CORS Proxy
 * Fetches content from external URLs and returns it with proper CORS headers
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Parse and validate URL properly to prevent bypass attacks
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate URL is for Telegram NFT pages only (security measure)
    // Strict validation: must be exactly t.me domain with /nft/ path prefix
    if (parsedUrl.hostname !== 't.me' || !parsedUrl.pathname.startsWith('/nft/')) {
      return res.status(403).json({ error: 'Only t.me/nft URLs are allowed' });
    }

    // Reconstruct a safe URL from parsed components
    const targetUrl = `https://t.me${parsedUrl.pathname}`;

    // Fetch the content
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NFT Gift Planner Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Upstream request failed with status ${response.status}`,
      });
    }

    const html = await response.text();

    // Return the HTML content
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[proxy] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
