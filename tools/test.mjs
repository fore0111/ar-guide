// 擬似カメラで認識を検証する。使い方: node tools/test.mjs 地点番号 映像.mjpeg [スクリーンショット.png]
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const [point, cam, shot] = process.argv.slice(2);
const server = await serve(8766);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${cam}`,
    '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:8766/image.html?p=${point}&debug`);
  await page.waitForFunction('window.__ar && window.__ar.ready', { timeout: 60000 });
  let found = [];
  for (let i = 0; i < 40 && !found.length; i++) {
    await new Promise((r) => setTimeout(r, 500));
    found = await page.evaluate(() => [...window.__ar.found]);
  }
  console.log(JSON.stringify({ point, found, status: await page.$eval('#status', (e) => e.textContent), errors }));
  if (shot) await page.screenshot({ path: shot });
} finally { await browser.close(); server.close(); }
