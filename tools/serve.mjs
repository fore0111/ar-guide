// 依存なしの静的サーバー（ar-guide 直下を配信）。使い方: node tools/serve.mjs [port] [--https]
// --https は tools/.cert の自己署名証明書を使用（同一 Wi-Fi のスマートフォンから確認する用途）
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.mind': 'application/octet-stream' };
export function serve(port = 8080, tls = null) {
  return new Promise((ok) => {
    const handler = (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    };
    const s = tls ? https.createServer(tls, handler) : http.createServer(handler);
    s.listen(port, () => ok(s));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const useTls = args.includes('--https');
  const port = Number(args.find((a) => /^\d+$/.test(a)) || (useTls ? 8443 : 8080));
  const dir = path.join(ROOT, 'tools/.cert');
  const tls = useTls ? { key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) } : null;
  serve(port, tls).then(() => {
    const scheme = useTls ? 'https' : 'http';
    console.log(`${scheme}://localhost:${port}/`);
    for (const list of Object.values(os.networkInterfaces()))
      for (const n of list) if (n.family === 'IPv4' && !n.internal) console.log(`${scheme}://${n.address}:${port}/`);
  });
}
