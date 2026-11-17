// targets/manifest.json の画像を地点別に .mind へコンパイルする。使い方: node tools/compile.mjs [地点番号...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'targets/manifest.json'), 'utf8'));
const points = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest);
const server = await serve(8765);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'], protocolTimeout: 1800000,
});
try {
  for (const p of points) {
    const page = await browser.newPage();
    page.on('console', (m) => { const t = m.text(); if (!t.startsWith('progress') || t.endsWith('0')) process.stdout.write(`[p${p}] ${t}\n`); });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto('http://localhost:8765/tools/compile.html');
    await page.waitForFunction('window.ready === true');
    const t0 = Date.now();
    const b64 = await page.evaluate((files) => window.compilePoint(files), manifest[p].map((m) => m.file));
    const out = path.join(ROOT, `targets/p${p}.mind`);
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`p${p}: ${manifest[p].length} targets -> ${(fs.statSync(out).size / 1024).toFixed(0)} KB (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    await page.close();
  }
} finally { await browser.close(); server.close(); }
