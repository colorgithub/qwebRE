const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3002;

console.log(`Image proxy server starting on port ${PORT}...`);

const server = http.createServer((req, res) => {
  // Parse the target URL from the query parameter
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing "url" query parameter' }));
    return;
  }
  
  console.log(`Proxying: ${targetUrl}`);
  
  // Validate URL scheme
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL scheme' }));
    return;
  }
  
  // Choose http or https module based on target URL
  const lib = targetUrl.startsWith('https://') ? https : http;
  
  // Make the request to the target URL
  lib.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }, (proxyRes) => {
    // Set CORS headers
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream'
    });
    
    // Pipe the response to the client
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to fetch image', message: err.message }));
  });
});

// Handle OPTIONS requests for CORS preflight
server.on('OPTIONS', (req, res) => {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
});

server.listen(PORT, () => {
  console.log(`Image proxy server is running on http://localhost:${PORT}`);
  console.log(`Usage: http://localhost:${PORT}/?url=<encoded_image_url>`);
});
