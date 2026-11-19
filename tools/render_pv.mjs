// PV を MP4 へ書き出す。
//   node tools/render_pv.mjs                      → pv/out/pv.mp4（BGM は pv/media/bgm.* があれば合成）
//   node tools/render_pv.mjs --stills 1.5,8,15    → 指定秒の静止画を pv/out/still_*.jpg へ出力
//   node tools/render_pv.mjs --prep               → 動画素材のフレーム展開のみ（プレビュー前に実行）
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'pv/out');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;

// 動画素材をフレーム画像へ展開（素材が未変更なら省略）
const PV = path.join(ROOT, 'pv');
const shots = JSON.parse(fs.readFileSync(path.join(PV, 'shots.json'), 'utf8'));
const CACHE = path.join(OUT, 'cache');
const idxFile = path.join(CACHE, 'index.json');
const index = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
for (const [slot, v] of Object.entries(shots.slots)) {
  if (!/\.(mp4|mov|webm|m4v)$/i.test(v.src)) { delete index[slot]; continue; }
  const file = path.join(PV, v.src), mtime = fs.statSync(file).mtimeMs;
  if (index[slot]?.src === v.src && index[slot]?.mtime === mtime) continue;
  const dir = path.join(CACHE, slot);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  console.log(`展開中: ${slot} ← ${v.src}`);
  execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', "fps=30,scale='if(gt(ih,iw),min(1200,iw),-2)':'if(gt(ih,iw),-2,min(1200,ih))'", '-q:v', '3', path.join(dir, '%05d.jpg')]);
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
  const dim = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(dir, frames[0])]).toString().trim().split(',').map(Number);
  index[slot] = { src: v.src, mtime, count: frames.length, w: dim[0], h: dim[1] };
}
fs.mkdirSync(CACHE, { recursive: true });
fs.writeFileSync(idxFile, JSON.stringify(index, null, 1));
if (args.includes('--prep')) { console.log('展開完了'); process.exit(0); }

const server = await serve(8769);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
  protocolTimeout: 600000,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || m.text().startsWith('経路')) console.log('console', m.text()); });
  await page.goto('http://localhost:8769/pv/index.html?render');
  await page.waitForFunction('window.PV && window.PV.ready', { timeout: 60000 });
  const { FPS, DUR } = await page.evaluate(() => ({ FPS: window.PV.FPS, DUR: window.PV.DUR }));
  const frame = async (t) => Buffer.from((await page.evaluate((x) => window.PV.renderAt(x), t)).split(',')[1], 'base64');

  if (stillsArg) {
    for (const s of stillsArg.split(',').map(Number)) {
      const f = path.join(OUT, `still_${s.toFixed(2)}.jpg`);
      fs.writeFileSync(f, await frame(s));
      console.log(f);
    }
  } else {
    const bgm = fs.existsSync(path.join(ROOT, 'pv/media')) ? fs.readdirSync(path.join(ROOT, 'pv/media')).find((f) => /^bgm\.(mp3|m4a|wav|aac)$/i.test(f)) : null;
    const out = path.join(OUT, 'pv.mp4');
    const ff = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
    if (bgm) ff.push('-i', path.join(ROOT, 'pv/media', bgm), '-af', `afade=t=out:st=${DUR - 2}:d=2`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    ff.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', '-t', String(DUR), out);
    const proc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(DUR * FPS), t0 = Date.now();
    for (let i = 0; i < total; i++) {
      const buf = await frame(i / FPS);
      if (!proc.stdin.write(buf)) await new Promise((r) => proc.stdin.once('drain', r));
      if (i % 90 === 0) console.log(`frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    proc.stdin.end();
    await new Promise((r) => proc.on('close', r));
    console.log(`${out}${bgm ? '（BGM: ' + bgm + '）' : '（BGM なし）'}`);
  }
} finally { await browser.close(); server.close(); }
