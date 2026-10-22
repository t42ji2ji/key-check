// TruffleHog 的本機網頁外殼：貼上的文字經 stdin 交給 trufflehog，不寫檔、不記 log。只綁 127.0.0.1。
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';

const PORT = 5199;
const LOCAL_BIN = path.join(os.homedir(), '.cache', 'key-check', 'bin', process.platform === 'win32' ? 'trufflehog.exe' : 'trufflehog');

// 各服務的後台：撤銷 key 的頁面、用量頁。key 是 TruffleHog 的 DetectorName（小寫、去符號後比對）
const DASH = {
  openai: ['https://platform.openai.com/api-keys', 'https://platform.openai.com/usage'],
  anthropic: ['https://console.anthropic.com/settings/keys', 'https://console.anthropic.com/usage'],
  googlegeminiapikey: ['https://aistudio.google.com/apikey', 'https://aistudio.google.com/usage'],
  gemini: ['https://aistudio.google.com/apikey', 'https://aistudio.google.com/usage'],
  gcp: ['https://console.cloud.google.com/iam-admin/serviceaccounts', 'https://console.cloud.google.com/billing'],
  googleapikey: ['https://console.cloud.google.com/apis/credentials', 'https://console.cloud.google.com/apis/dashboard'],
  github: ['https://github.com/settings/tokens', 'https://github.com/settings/security-log'],
  gitlab: ['https://gitlab.com/-/user_settings/personal_access_tokens', null],
  stripe: ['https://dashboard.stripe.com/apikeys', 'https://dashboard.stripe.com/logs'],
  slack: ['https://api.slack.com/apps', null],
  aws: ['https://console.aws.amazon.com/iam/home#/security_credentials', 'https://console.aws.amazon.com/billing/home'],
  huggingface: ['https://huggingface.co/settings/tokens', 'https://huggingface.co/settings/billing'],
  replicate: ['https://replicate.com/account/api-tokens', 'https://replicate.com/account/billing'],
  groq: ['https://console.groq.com/keys', 'https://console.groq.com/settings/usage'],
  openrouter: ['https://openrouter.ai/settings/keys', 'https://openrouter.ai/activity'],
  mistral: ['https://console.mistral.ai/api-keys', 'https://console.mistral.ai/usage'],
  elevenlabs: ['https://elevenlabs.io/app/settings/api-keys', 'https://elevenlabs.io/app/usage'],
  deepseek: ['https://platform.deepseek.com/api_keys', 'https://platform.deepseek.com/usage'],
  perplexity: ['https://www.perplexity.ai/account/api/keys', 'https://www.perplexity.ai/account/api/billing'],
  cohere: ['https://dashboard.cohere.com/api-keys', 'https://dashboard.cohere.com/billing'],
  supabase: ['https://supabase.com/dashboard/projects', 'https://supabase.com/dashboard/projects'],
  vercel: ['https://vercel.com/account/settings/tokens', 'https://vercel.com/dashboard/usage'],
  cloudflareapitoken: ['https://dash.cloudflare.com/profile/api-tokens', null],
  netlify: ['https://app.netlify.com/user/applications', null],
  sendgrid: ['https://app.sendgrid.com/settings/api_keys', 'https://app.sendgrid.com/statistics'],
  resend: ['https://resend.com/api-keys', 'https://resend.com/emails'],
  twilio: ['https://console.twilio.com/us1/account/keys-credentials/api-keys', 'https://console.twilio.com/us1/monitor/usage'],
  mailgun: ['https://app.mailgun.com/settings/api_security', 'https://app.mailgun.com/reporting'],
  telegrambottoken: ['https://t.me/BotFather', null],
  discordbottoken: ['https://discord.com/developers/applications', null],
  notion: ['https://www.notion.so/my-integrations', null],
  figma: ['https://www.figma.com/settings', null],
  linear: ['https://linear.app/settings/account/security', null],
  sentry: ['https://sentry.io/settings/account/api/auth-tokens/', null],
  npm: ['https://www.npmjs.com/settings/~/tokens', null],
  dockerhub: ['https://app.docker.com/settings/personal-access-tokens', null],
  mapbox: ['https://account.mapbox.com/access-tokens/', 'https://account.mapbox.com/statistics/'],
  shopify: ['https://admin.shopify.com/settings/apps/development', null],
  firecrawl: ['https://www.firecrawl.dev/app/api-keys', 'https://www.firecrawl.dev/app/usage'],
  railway: ['https://railway.com/account/tokens', 'https://railway.com/workspace/usage'],
};
const dash = (name) => {
  const d = DASH[String(name).toLowerCase().replace(/[^a-z0-9]/g, '')];
  return d ? { revoke: d[0], usage: d[1] } : null;
};

// ---------- TruffleHog 位置與安裝 ----------

function version(bin) {
  return new Promise((res) => execFile(bin, ['--version'], { timeout: 10000 }, (e, out, err) => res(e ? null : `${out}${err}`.trim())));
}

async function truffle() {
  // 先用 key-check 自己的那份（可能是補了 AQ. 偵測的自編版），再用系統裝的
  for (const bin of [LOCAL_BIN, 'trufflehog']) {
    const v = await version(bin);
    if (v) return { bin, version: v.replace(/^trufflehog\s*/, '') };
  }
  return null;
}

const ARCH = { arm64: 'arm64', x64: 'amd64' };
const OS = { darwin: 'darwin', linux: 'linux', win32: 'windows' };

// 從 GitHub 官方 release 下載，比對 checksums.txt 的 SHA-256，解壓到 ~/.cache/key-check/bin（不需要 sudo）
async function install(log) {
  const os_ = OS[process.platform], arch = ARCH[process.arch];
  if (!os_ || !arch) throw new Error(`unsupported platform ${process.platform}/${process.arch}`);
  log('release', 'latest');
  const rel = await (await fetch('https://api.github.com/repos/trufflesecurity/trufflehog/releases/latest')).json();
  const ver = rel.tag_name.replace(/^v/, '');
  const name = `trufflehog_${ver}_${os_}_${arch}.tar.gz`;
  const asset = rel.assets.find((a) => a.name === name);
  const sums = rel.assets.find((a) => a.name.endsWith('_checksums.txt'));
  if (!asset || !sums) throw new Error(`${name} not found in the latest release`);

  log('download', ver);
  const r = await fetch(asset.browser_download_url);
  const total = Number(r.headers.get('content-length')) || asset.size;
  const chunks = [];
  let got = 0, last = -1;
  for await (const c of r.body) {
    chunks.push(c);
    got += c.length;
    const pct = Math.floor((got / total) * 100);
    if (pct !== last) { last = pct; log('progress', pct); }
  }
  const buf = Buffer.concat(chunks);

  log('verify', 'sha256');
  const want = (await (await fetch(sums.browser_download_url)).text()).split('\n').find((l) => l.trim().endsWith(name))?.split(/\s+/)[0];
  const have = crypto.createHash('sha256').update(buf).digest('hex');
  if (!want || want !== have) throw new Error('SHA-256 mismatch, install aborted');

  log('extract', 'tar');
  const dir = path.dirname(LOCAL_BIN);
  fs.mkdirSync(dir, { recursive: true });
  const tgz = path.join(dir, name);
  fs.writeFileSync(tgz, buf);
  await new Promise((res, rej) => execFile('tar', ['-xzf', tgz, '-C', dir, path.basename(LOCAL_BIN)], (e) => (e ? rej(e) : res())));
  fs.rmSync(tgz);
  fs.chmodSync(LOCAL_BIN, 0o755);
  log('done', ver);
}

// ---------- 掃描 ----------

function scan(bin, text) {
  return new Promise((resolve) => {
    const p = spawn(bin, ['stdin', '--json', '--results=verified,unverified,unknown', '--no-update', '--no-color']);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)));
    p.stdin.end(text + '\n');
  });
}

const mask = (k) => (k.length > 14 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••');

// 官方 TruffleHog 還不認得 Google 新版 AQ. 開頭的 Gemini key（trufflehog#5437，修正在 PR #5440），沒認到時自己查：無效時回 401「API key not valid」
// 新版 key 依官方文件放 x-goog-api-key 標頭
const AQ = /AQ\.[A-Za-z0-9_\-]{16,}/g;
async function geminiAQ(k) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': k }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  const body = r ? await r.text() : '';
  const state = r?.status === 200 ? 'valid' : /API key not valid|API_KEY_INVALID/.test(body) ? 'dead' : 'unknown';
  return { key: mask(k), service: 'Gemini', note: 'AQ. key', state, error: state === 'unknown' ? `HTTP ${r?.status ?? 'request failed'}` : null, extra: {}, links: dash('gemini') };
}

// 一段輸入（一行，或一整份 JSON）的所有結果
async function check(bin, text) {
  const results = [];
  const seen = new Set();
  for (const f of await scan(bin, text)) {
    const raw = f.Raw ?? '';
    if (seen.has(f.DetectorName + raw)) continue;
    seen.add(f.DetectorName + raw);
    results.push({
      key: mask(raw),
      service: f.DetectorName,
      state: f.Verified ? 'valid' : f.VerificationError ? 'unknown' : 'dead',
      error: f.VerificationError ?? null,
      extra: f.ExtraData ?? {},
      links: dash(f.DetectorName),
    });
  }
  if (!results.some((r) => r.service === 'GoogleGeminiAPIKey')) for (const k of new Set(text.match(AQ))) results.push(await geminiAQ(k));
  if (!results.length) {
    const v = text.includes('=') && !text.trim().startsWith('{') ? text.split('=').slice(1).join('=').trim() : text.trim();
    results.push({ key: mask(v), service: null, state: 'unrecognized', error: null, extra: {}, links: null });
  }
  return results;
}

// ---------- HTTP ----------

const readJSON = async (req) => { let b = ''; for await (const c of req) b += c; return JSON.parse(b || '{}'); };
const send = (res, obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  // 擋 DNS rebinding 與跨站請求：只認本機 Host，API 一律要自訂標頭（跨站要先過 preflight，這裡不回 CORS）
  if (req.headers.host !== `127.0.0.1:${PORT}` && req.headers.host !== `localhost:${PORT}`) return res.writeHead(403).end();
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(new URL('./index.html', import.meta.url)));
  }
  if (req.method === 'GET' && req.url === '/sharks.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return res.end(fs.readFileSync(new URL('./sharks.js', import.meta.url)));
  }
  if (req.headers['x-key-check'] !== '1') return res.writeHead(403).end();

  if (req.method === 'GET' && req.url === '/status') {
    return send(res, { trufflehog: await truffle(), installable: !!(OS[process.platform] && ARCH[process.arch]) });
  }
  if (req.method === 'POST' && req.url === '/install') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    const log = (step, value) => res.write(JSON.stringify({ step, value }) + '\n');
    try { await install(log); } catch (e) { log('error', e.message); }
    return res.end();
  }
  if (req.method === 'POST' && req.url === '/scan') {
    const t = await truffle();
    if (!t) return send(res, { error: 'trufflehog-missing' });
    const { text = '' } = await readJSON(req);
    return send(res, { results: await check(t.bin, text) });
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`key-check → http://127.0.0.1:${PORT}`));
