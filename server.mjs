// TruffleHog 的本機網頁外殼：貼上的文字經 stdin 交給 trufflehog，不寫檔、不記 log。只綁 127.0.0.1。
import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const PORT = 5199;

function scan(text) {
  return new Promise((resolve) => {
    const p = spawn('trufflehog', ['stdin', '--json', '--results=verified,unverified,unknown', '--no-update', '--no-color']);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)));
    p.stdin.end(text + '\n');
  });
}

const mask = (k) => (k.length > 14 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••');

// TruffleHog 還不認得 Google 新版 AQ. 開頭的 Gemini key，自己查：無效時回 401「API key not valid」
async function geminiAQ(k) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  const body = r ? await r.text() : '';
  const state = r?.status === 200 ? 'valid' : /API key not valid|API_KEY_INVALID/.test(body) ? 'dead' : 'unknown';
  return { key: mask(k), service: 'Gemini（AQ. 新版 key）', state, error: state === 'unknown' ? `HTTP ${r?.status ?? '連線失敗'}` : null, extra: {} };
}

async function check(text) {
  const found = await scan(text);
  const seen = new Set();
  const results = [];
  for (const f of found) {
    const raw = f.Raw ?? '';
    if (seen.has(f.DetectorName + raw)) continue;
    seen.add(f.DetectorName + raw);
    results.push({
      raw,
      key: mask(raw),
      service: f.DetectorName,
      state: f.Verified ? 'valid' : f.VerificationError ? 'unknown' : 'dead',
      error: f.VerificationError ?? null,
      extra: f.ExtraData ?? {},
    });
  }
  // 貼上的每一行裡沒被任何結果涵蓋的，列為認不出
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const unknown = text.trim().startsWith('{') ? [] : lines.filter((l) => !results.some((r) => r.raw && l.includes(r.raw)));
  const value = (l) => (l.includes('=') ? l.split('=').slice(1).join('=') : l).trim();
  const rest = [];
  for (const l of unknown) {
    const v = value(l);
    if (v.startsWith('AQ.')) results.push(await geminiAQ(v));
    else rest.push(mask(v));
  }
  for (const r of results) delete r.raw;
  return { results, unrecognized: rest };
}

http.createServer(async (req, res) => {
  // 擋 DNS rebinding 與跨站請求
  if (req.headers.host !== `127.0.0.1:${PORT}` && req.headers.host !== `localhost:${PORT}`) return res.writeHead(403).end();
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(new URL('./index.html', import.meta.url)));
  }
  if (req.method === 'POST' && req.url === '/scan' && req.headers['x-key-check'] === '1') {
    let body = '';
    for await (const c of req) body += c;
    const out = await check(JSON.parse(body).text ?? '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(out));
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}`));
