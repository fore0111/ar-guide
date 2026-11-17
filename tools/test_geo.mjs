// 位置・方位を模擬して全域版を検証する。使い方: node tools/test_geo.mjs 緯度,経度,方位 映像.mjpeg 出力.png
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const [sim, cam, shot] = process.argv.slice(2);
const server = await serve(8767);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${cam}`],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:8767/index.html?sim=${sim}`);
  await new Promise((r) => setTimeout(r, 2500));
  const out = await page.evaluate(() => ({
    front: document.getElementById('front').innerText.replace(/\n/g, ' | '),
    labels: [...document.querySelectorAll('.label')].filter((e) => e.style.display !== 'none').map((e) => e.innerText.replace(/\n/g, ' | ')),
    sensor: document.getElementById('sensor').textContent,
  }));
  console.log(JSON.stringify({ sim, ...out, errors }, null, 1));
  if (shot) await page.screenshot({ path: shot });
} finally { await browser.close(); server.close(); }
